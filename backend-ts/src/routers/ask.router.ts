/**
 * RAG Ask router — /ask, /ask/free (SSE) and /ask/sync (JSON).
 * Mirrors backend/routers/ask_router.py.
 *
 * SSE protocol (matches Python verbatim):
 *   data: <chunk>\n\n         — token chunks (newlines escaped as \n)
 *   data: [ERROR] <msg>\n\n   — on stream failure
 *   data: [DONE]\n\n          — completion
 *   data: [TRACE] {...}\n\n   — RAG trace metadata (only on /ask)
 *
 * NOTE: SSE endpoints use plain `app.post()` because @hono/zod-openapi's
 * `createRoute` doesn't model streaming responses well. /ask/sync uses
 * OpenAPI typing.
 *
 * track() must be called explicitly here after the stream drains —
 * streamAI() does NOT track (Python parity).
 *
 * Retrieval pipeline (PR #4):
 *   1. classifyIntent(question) → 6-way intent (heuristic + LLM fallback).
 *   2. retrieve(repoId, question) → hybrid pgvector + LadybugDB FTS,
 *      RRF-fused, top-K. Soft-fails (returns []) if Postgres or the
 *      LadybugDB is unavailable.
 *   3. If retrieved chunks are empty, fall back to `kb.insights.slice(0,2)`
 *      so the bot still answers when the code-intel pipeline never ran.
 *   4. Whichever path won is recorded in trace.retrieval_method so the
 *      UI can show "rag-hybrid" vs "kb-insights".
 */
import { createRoute, OpenAPIHono, type z } from '@hono/zod-openapi';
import { stream } from 'hono/streaming';
import { repoRepo } from '../db/repositories/repo.repo.js';
import { sessionsRepo } from '../db/repositories/sessions.repo.js';
import { requireKnowledgeBase, requireSession } from '../lib/guards.js';
import { type AskRequest, AskRequestSchema, AskSyncResponseSchema } from '../schemas/ask.schema.js';
import { ErrorSchema } from '../schemas/common.schema.js';
import { callAI, streamAI } from '../services/ai/dispatcher.js';
import { track } from '../services/ai/track.js';
import { classifyIntent } from '../services/codeintel/intent.classifier.js';
import {
  type RetrievedChunk,
  type RetrieveTrace,
  retrieve,
} from '../services/codeintel/retrieve.service.js';

type KbSnapshot = ReturnType<typeof requireKnowledgeBase>;

export const askRouter = new OpenAPIHono();

const json = <T extends z.ZodTypeAny>(schema: T) => ({
  'application/json': { schema },
});

// ─── _build_rag_prompt ───────────────────────────────────
interface SourceChunk {
  files: string[];
  summary_preview: string;
}

interface TraceInfo {
  intent: string;
  retrieval_method: string;
  source_chunks: SourceChunk[];
  /** Per-leg retrieval stats — present only when hybrid retrieval ran. */
  retrieval_trace?: RetrieveTrace;
  /** Confidence on the intent classification, 0..1. */
  intent_confidence?: number;
}

interface SessionLike {
  chatHistory: Array<{ role: string; text: string; trace?: unknown }>;
}

/** Cap injected chunk text so a single huge function doesn't blow the prompt. */
const CHUNK_PREVIEW_CHARS = 1_200;
const MAX_CHUNKS_IN_PROMPT = 6;

function previewChunk(c: RetrievedChunk): SourceChunk {
  return {
    files: [`${c.filePath}:${c.startLine}-${c.endLine}`],
    summary_preview: c.content.length > 200 ? c.content.slice(0, 200) + '...' : c.content,
  };
}

function formatChunkForPrompt(c: RetrievedChunk): string {
  const body =
    c.content.length > CHUNK_PREVIEW_CHARS
      ? c.content.slice(0, CHUNK_PREVIEW_CHARS) + '\n... [truncated]'
      : c.content;
  return `### ${c.filePath}:${c.startLine}-${c.endLine}\n${body}`;
}

async function buildRagPrompt(
  session: SessionLike,
  kb: KbSnapshot,
  req: AskRequest,
): Promise<{ prompt: string; instruction: string; trace: TraceInfo }> {
  // 1. Classify intent (cheap; heuristic-first).
  const intentResult = await classifyIntent(req.question);

  // 2. Try hybrid retrieval. Any failure (no Postgres, no LadybugDB,
  //    no embedder, etc.) is logged and we fall back to kb.insights.
  const repo = repoRepo.get();
  const repoId = repo ? `${repo.owner}/${repo.repo}` : '';
  let retrieved: RetrievedChunk[] = [];
  let retrievalTrace: RetrieveTrace | undefined;
  let retrievalMethod = 'kb-insights-fallback';

  if (repoId) {
    try {
      const result = await retrieve(repoId, req.question, {
        topK: MAX_CHUNKS_IN_PROMPT,
      });
      retrieved = result.chunks;
      retrievalTrace = result.trace;
      if (retrieved.length > 0) {
        retrievalMethod = result.trace.lexicalOk ? 'rag-hybrid' : 'rag-vector-only';
      }
    } catch {
      // Soft-fail; we'll fall through to kb.insights below.
    }
  }

  let kbContext: string;
  let sourceChunks: SourceChunk[];
  if (retrieved.length > 0) {
    kbContext =
      `${kb.project_summary}\n\n=== RETRIEVED CODE (top ${retrieved.length}) ===\n` +
      retrieved.map(formatChunkForPrompt).join('\n\n');
    sourceChunks = retrieved.map(previewChunk);
  } else {
    // Legacy path — pre-RAG knowledge base summary.
    const insights = kb.insights.slice(0, 2);
    kbContext =
      kb.project_summary + '\n\n=== TOP INSIGHTS ===\n' + insights.map((c) => c.summary).join('\n');
    sourceChunks = insights.map((c) => ({
      files: c.files,
      summary_preview: c.summary.slice(0, 200) + '...',
    }));
  }

  const trace: TraceInfo = {
    intent: intentResult.intent,
    retrieval_method: retrievalMethod,
    source_chunks: sourceChunks,
    intent_confidence: intentResult.confidence,
    ...(retrievalTrace ? { retrieval_trace: retrievalTrace } : {}),
  };

  let fileCtx = '';
  if (req.ide_file && req.ide_content) {
    fileCtx =
      `\n\n=== FILE OPEN IN IDE: ${req.ide_file} ===\n` + `${req.ide_content.slice(0, 4000)}\n`;
  }

  const recent = session.chatHistory.slice(-8);
  const history = recent.map((m) => `${m.role.toUpperCase()}: ${m.text}`).join('\n');

  const prompt =
    `=== REPO KNOWLEDGE (RAG Context) ===\n${kbContext}` +
    `${fileCtx}` +
    `\n\n=== CHAT HISTORY ===\n${history}` +
    `\n\n=== QUESTION ===\n${req.question}`;

  const repoName = repo?.repo ?? 'project';
  // Tailor the directive verb so the response style matches what the
  // user is trying to do. Keeps the underlying expert persona stable.
  const intentDirective: Record<string, string> = {
    exploring: 'Help them navigate and understand the code.',
    debugging: 'Help them isolate the failure and propose a concrete fix.',
    implementing: 'Help them design and write the new code; show small concrete examples.',
    reviewing: 'Identify risks, edge cases, and concrete suggestions.',
    refactoring: 'Suggest a safe step-by-step transformation; flag breaking changes.',
    learning: 'Explain the underlying concept first, then ground it in this codebase.',
  };
  const instruction =
    `You are a technical expert on the '${repoName}' project. ` +
    `Detected intent: ${intentResult.intent}. ${intentDirective[intentResult.intent] ?? ''} ` +
    'Answer the question based on the provided context. ' +
    'When citing code, reference files as `path:line-line`. ' +
    'If information is insufficient, say so clearly. ' +
    'Reply in natural Markdown, concise and precise.';

  return { prompt, instruction, trace };
}

// ─── SSE response builder shared by /ask and /ask/free ───
function sseHeaders(): Record<string, string> {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'X-Accel-Buffering': 'no',
    Connection: 'keep-alive',
  };
}

function sseLine(data: string): string {
  return `data: ${data}\n\n`;
}

// ─── POST /ask  (SSE) ────────────────────────────────────
askRouter.post('/ask', async (c) => {
  const body = (await c.req.json()) as Partial<AskRequest>;
  const req = AskRequestSchema.parse(body);

  const session = requireSession(req.session_id);
  const kb = requireKnowledgeBase();
  const { prompt, instruction, trace } = await buildRagPrompt(session, kb, req);

  // Persist user message immediately (matches Python).
  const newHistory = [...session.chatHistory, { role: 'user', text: req.question }];
  sessionsRepo.update(req.session_id, { chatHistory: newHistory });

  // Set SSE headers
  for (const [k, v] of Object.entries(sseHeaders())) c.header(k, v);

  return stream(c, async (s) => {
    const start = Date.now();
    const chunks: string[] = [];
    try {
      for await (const chunk of streamAI(prompt, instruction)) {
        chunks.push(chunk);
        const safe = chunk.replace(/\n/g, '\\n');
        await s.write(sseLine(safe));
      }
    } catch (e) {
      await s.write(sseLine(`[ERROR] ${(e as Error).message}`));
      return;
    }

    const answer = chunks.join('');

    // Persist assistant message + trace (re-fetch to avoid losing concurrent writes).
    const fresh = sessionsRepo.get(req.session_id);
    if (fresh) {
      sessionsRepo.update(req.session_id, {
        chatHistory: [...fresh.chatHistory, { role: 'assistant', text: answer, trace }],
      });
    }

    // Record metrics (streamAI does NOT track — Python parity).
    track({
      agentRole: 'EXPERT',
      prompt,
      instruction,
      resultText: answer,
      latencySeconds: (Date.now() - start) / 1000,
    });

    await s.write(sseLine('[DONE]'));
    await s.write(sseLine(`[TRACE] ${JSON.stringify(trace)}`));
  });
});

// ─── POST /ask/free  (SSE, no KB) ────────────────────────
askRouter.post('/ask/free', async (c) => {
  const body = (await c.req.json()) as Partial<AskRequest>;
  const req = AskRequestSchema.parse(body);

  const session = requireSession(req.session_id);

  const recent = session.chatHistory.slice(-8);
  const history = recent.map((m) => `${m.role.toUpperCase()}: ${m.text}`).join('\n');

  let fileCtx = '';
  if (req.ide_file && req.ide_content) {
    fileCtx =
      `\n\n=== FILE OPEN IN IDE: ${req.ide_file} ===\n` + `${req.ide_content.slice(0, 4000)}\n`;
  }

  const prompt =
    `${fileCtx}` + `\n\n=== CHAT HISTORY ===\n${history}` + `\n\n=== QUESTION ===\n${req.question}`;

  const instruction =
    'You are YUMMY, a helpful AI assistant for software development. ' +
    'Answer clearly and concisely in Markdown. ' +
    'You can discuss any topic — code, architecture, concepts, or general questions.';

  // Persist user message immediately.
  sessionsRepo.update(req.session_id, {
    chatHistory: [...session.chatHistory, { role: 'user', text: req.question }],
  });

  for (const [k, v] of Object.entries(sseHeaders())) c.header(k, v);

  return stream(c, async (s) => {
    const start = Date.now();
    const chunks: string[] = [];
    try {
      for await (const chunk of streamAI(prompt, instruction)) {
        chunks.push(chunk);
        const safe = chunk.replace(/\n/g, '\\n');
        await s.write(sseLine(safe));
      }
    } catch (e) {
      await s.write(sseLine(`[ERROR] ${(e as Error).message}`));
      return;
    }

    const answer = chunks.join('');

    const fresh = sessionsRepo.get(req.session_id);
    if (fresh) {
      sessionsRepo.update(req.session_id, {
        chatHistory: [...fresh.chatHistory, { role: 'assistant', text: answer }],
      });
    }

    track({
      agentRole: 'EXPERT',
      prompt,
      instruction,
      resultText: answer,
      latencySeconds: (Date.now() - start) / 1000,
    });

    await s.write(sseLine('[DONE]'));
  });
});

// ─── POST /ask/sync  (non-streaming JSON) ────────────────
askRouter.openapi(
  createRoute({
    method: 'post',
    path: '/ask/sync',
    tags: ['RAG Chat'],
    request: { body: { content: json(AskRequestSchema) } },
    responses: {
      200: { content: json(AskSyncResponseSchema), description: 'Answer' },
      400: { content: json(ErrorSchema), description: 'KB empty' },
      404: { content: json(ErrorSchema), description: 'Session not found' },
    },
  }),
  async (c) => {
    const req = c.req.valid('json');
    const session = requireSession(req.session_id);
    const kb = requireKnowledgeBase();
    const { prompt, instruction, trace } = await buildRagPrompt(session, kb, req);

    const answer = await callAI('EXPERT', prompt, instruction);

    sessionsRepo.update(req.session_id, {
      chatHistory: [
        ...session.chatHistory,
        { role: 'user', text: req.question },
        { role: 'assistant', text: answer, trace },
      ],
    });

    return c.json(
      {
        question: req.question,
        answer,
        trace,
        session_id: req.session_id,
      },
      200,
    );
  },
);
