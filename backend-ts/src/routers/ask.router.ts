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
 */
import { createRoute, OpenAPIHono, type z } from '@hono/zod-openapi';
import { stream } from 'hono/streaming';
import { type Bindings, createDb, type Db } from '../db/client.js';
import { repoRepo } from '../db/repositories/repo.repo.js';
import { sessionsRepo } from '../db/repositories/sessions.repo.js';
import { requireKnowledgeBase, requireSession } from '../lib/guards.js';
import { nowIso } from '../lib/time.js';
import { type AskRequest, AskRequestSchema, AskSyncResponseSchema } from '../schemas/ask.schema.js';
import { ErrorSchema } from '../schemas/common.schema.js';
import { callAI, streamAI } from '../services/ai/dispatcher.js';
import { track } from '../services/ai/track.js';

type KbSnapshot = Awaited<ReturnType<typeof requireKnowledgeBase>>;

export const askRouter = new OpenAPIHono<{ Bindings: Bindings }>();

const json = <T extends z.ZodTypeAny>(schema: T) => ({
  'application/json': { schema },
});

// ─── _build_rag_prompt ───────────────────────────────────
interface TraceInfo {
  intent: string;
  retrieval_method: string;
  source_chunks: Array<{ files: string[]; summary_preview: string }>;
}

interface SessionLike {
  chatHistory: Array<{ role: string; text: string; timestamp?: string; trace?: unknown }>;
}

function chatMessage(role: string, text: string, trace?: unknown): SessionLike['chatHistory'][number] {
  const message: SessionLike['chatHistory'][number] = { role, text, timestamp: nowIso() };
  if (trace !== undefined) message.trace = trace;
  return message;
}

function buildRagPrompt(
  repoName: string,
  session: SessionLike,
  kb: KbSnapshot,
  req: AskRequest,
): { prompt: string; instruction: string; trace: TraceInfo } {
  const retrieved = kb.insights.slice(0, 2);
  const trace: TraceInfo = {
    intent: 'Code Structure Query',
    retrieval_method: 'top-k (k=2)',
    source_chunks: retrieved.map((c) => ({
      files: c.files,
      summary_preview: `${c.summary.slice(0, 200)}...`,
    })),
  };

  const kbContext = `${kb.project_summary}\n\n=== TOP INSIGHTS ===\n${retrieved.map((c) => c.summary).join('\n')}`;

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

  const instruction =
    `You are a technical expert on the '${repoName}' project. ` +
    'Answer the question based on the provided context. ' +
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

async function appendAssistantMessage(
  db: Db,
  sessionId: string,
  answer: string,
  trace?: unknown,
): Promise<void> {
  if (!answer) return;
  const fresh = await sessionsRepo.get(db, sessionId);
  if (!fresh) return;

  await sessionsRepo.update(db, sessionId, {
    chatHistory: [...fresh.chatHistory, chatMessage('assistant', answer, trace)],
  });
}

// ─── POST /ask  (SSE) ────────────────────────────────────
askRouter.post('/ask', async (c) => {
  const db = createDb(c.env?.DB);
  const body = (await c.req.json()) as Partial<AskRequest>;
  const req = AskRequestSchema.parse(body);

  const session = await requireSession(db, req.session_id);
  const kb = await requireKnowledgeBase(db);
  const repoName = (await repoRepo.get(db))?.repo ?? 'project';
  const { prompt, instruction, trace } = buildRagPrompt(repoName, session, kb, req);

  // Persist user message immediately (matches Python).
  const newHistory = [...session.chatHistory, chatMessage('user', req.question)];
  await sessionsRepo.update(db, req.session_id, { chatHistory: newHistory });

  // Set SSE headers
  for (const [k, v] of Object.entries(sseHeaders())) c.header(k, v);

  return stream(c, async (s) => {
    const start = Date.now();
    const chunks: string[] = [];
    let assistantPersisted = false;

    const persistAssistant = async (): Promise<string> => {
      const answer = chunks.join('');
      if (!assistantPersisted) {
        await appendAssistantMessage(db, req.session_id, answer, trace);
        assistantPersisted = true;
      }
      return answer;
    };

    try {
      for await (const chunk of streamAI(prompt, instruction)) {
        chunks.push(chunk);
        const safe = chunk.replace(/\n/g, '\\n');
        await s.write(sseLine(safe));
      }
    } catch (e) {
      await persistAssistant();
      await s.write(sseLine(`[ERROR] ${(e as Error).message}`));
      return;
    }

    const answer = await persistAssistant();

    // Record metrics (streamAI does NOT track — Python parity).
    await track(db, {
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
  const db = createDb(c.env?.DB);
  const body = (await c.req.json()) as Partial<AskRequest>;
  const req = AskRequestSchema.parse(body);

  const session = await requireSession(db, req.session_id);

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
  await sessionsRepo.update(db, req.session_id, {
    chatHistory: [...session.chatHistory, chatMessage('user', req.question)],
  });

  for (const [k, v] of Object.entries(sseHeaders())) c.header(k, v);

  return stream(c, async (s) => {
    const start = Date.now();
    const chunks: string[] = [];
    let assistantPersisted = false;

    const persistAssistant = async (): Promise<string> => {
      const answer = chunks.join('');
      if (!assistantPersisted) {
        await appendAssistantMessage(db, req.session_id, answer);
        assistantPersisted = true;
      }
      return answer;
    };

    try {
      for await (const chunk of streamAI(prompt, instruction)) {
        chunks.push(chunk);
        const safe = chunk.replace(/\n/g, '\\n');
        await s.write(sseLine(safe));
      }
    } catch (e) {
      await persistAssistant();
      await s.write(sseLine(`[ERROR] ${(e as Error).message}`));
      return;
    }

    const answer = await persistAssistant();

    await track(db, {
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
    const db = createDb(c.env?.DB);
    const req = c.req.valid('json');
    const session = await requireSession(db, req.session_id);
    const kb = await requireKnowledgeBase(db);
    const repoName = (await repoRepo.get(db))?.repo ?? 'project';
    const { prompt, instruction, trace } = buildRagPrompt(repoName, session, kb, req);

    const answer = await callAI('EXPERT', prompt, instruction, undefined, db);

    await sessionsRepo.update(db, req.session_id, {
      chatHistory: [
        ...session.chatHistory,
        chatMessage('user', req.question),
        chatMessage('assistant', answer, trace),
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
