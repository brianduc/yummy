import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';
import { newSessionId } from '../../lib/id.js';
import { kbRepo } from '../../db/repositories/kb.repo.js';
import { repoRepo } from '../../db/repositories/repo.repo.js';
import { sessionsRepo } from '../../db/repositories/sessions.repo.js';
import { callAI } from '../ai/dispatcher.js';

const TOOL_DEFINITIONS: Tool[] = [
  {
    name: 'yummy.rag_ask',
    description: 'Ask a question against the indexed knowledge base using RAG.',
    inputSchema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'The question to ask' },
        session_id: { type: 'string', description: 'Optional session ID for context' },
      },
      required: ['question'],
    },
  },
  {
    name: 'yummy.rag_ask_free',
    description: 'Free-form chat with AI without requiring a knowledge base scan.',
    inputSchema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'The question or prompt' },
      },
      required: ['question'],
    },
  },
  {
    name: 'yummy.get_kb_insights',
    description: 'Get AI-generated insights from the indexed knowledge base.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'yummy.get_kb_summary',
    description: 'Get the project summary from the knowledge base.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'yummy.session_create',
    description: 'Create a new Yummy session.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Optional session name' },
      },
      required: [],
    },
  },
  {
    name: 'yummy.session_list',
    description: 'List all Yummy sessions.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'yummy.sdlc_start',
    description: 'Start the SDLC workflow with a change request.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'Session ID to run SDLC in' },
        change_request: { type: 'string', description: 'The change request or feature description' },
      },
      required: ['session_id', 'change_request'],
    },
  },
  {
    name: 'yummy.sdlc_status',
    description: 'Get the current SDLC workflow status for a session.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'Session ID to check' },
      },
      required: ['session_id'],
    },
  },
];

function textResult(text: string, isError?: true): CallToolResult {
  return isError ? { content: [{ type: 'text', text }], isError } : { content: [{ type: 'text', text }] };
}

function getHistoryText(sessionId?: string): string {
  if (!sessionId) return '';
  const session = sessionsRepo.get(sessionId);
  if (!session) return '';

  return session.chatHistory
    .slice(-8)
    .map((message) => `${message.role.toUpperCase()}: ${message.text}`)
    .join('\n');
}

function buildRagPrompt(question: string, sessionId?: string): { prompt: string; instruction: string } {
  const insights = kbRepo.listInsights().slice(0, 2);
  const summary = kbRepo.getProjectSummary();
  const kbContext = `${summary}\n\n=== TOP INSIGHTS ===\n${insights.map((insight) => insight.summary).join('\n')}`;
  const history = getHistoryText(sessionId);
  const repoName = repoRepo.get()?.repo ?? 'project';

  return {
    prompt: `=== REPO KNOWLEDGE (RAG Context) ===\n${kbContext}\n\n=== CHAT HISTORY ===\n${history}\n\n=== QUESTION ===\n${question}`,
    instruction:
      `You are a technical expert on the '${repoName}' project. ` +
      'Answer the question based on the provided context. ' +
      'If information is insufficient, say so clearly. ' +
      'Reply in natural Markdown, concise and precise.',
  };
}

function buildFreePrompt(question: string): { prompt: string; instruction: string } {
  return {
    prompt: `=== QUESTION ===\n${question}`,
    instruction:
      'You are YUMMY, a helpful AI assistant for software development. ' +
      'Answer clearly and concisely in Markdown. ' +
      'You can discuss any topic — code, architecture, concepts, or general questions.',
  };
}

export function getAllToolDefinitions(): Tool[] {
  return TOOL_DEFINITIONS;
}

export async function executeToolCall(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  switch (name) {
    case 'yummy.rag_ask': {
      const question = String(args.question ?? '');
      const sessionId = args.session_id ? String(args.session_id) : undefined;
      const { prompt, instruction } = buildRagPrompt(question, sessionId);
      const answer = await callAI('EXPERT', prompt, instruction);
      return textResult(answer);
    }
    case 'yummy.rag_ask_free': {
      const question = String(args.question ?? '');
      const { prompt, instruction } = buildFreePrompt(question);
      const answer = await callAI('EXPERT', prompt, instruction);
      return textResult(answer);
    }
    case 'yummy.get_kb_insights': {
      const insights = kbRepo.listInsights();
      const text = insights.map((insight) => `[${insight.files.join(', ')}]: ${insight.summary}`).join('\n\n');
      return textResult(text || 'No insights available.');
    }
    case 'yummy.get_kb_summary': {
      const summary = kbRepo.getProjectSummary();
      return textResult(summary || 'No project summary available.');
    }
    case 'yummy.session_create': {
      const name = args.name ? String(args.name) : `Session ${sessionsRepo.list().length + 1}`;
      const session = sessionsRepo.create(newSessionId(), name);
      return textResult(JSON.stringify({ id: session.id, name: session.name }));
    }
    case 'yummy.session_list': {
      const sessions = sessionsRepo.list();
      return textResult(JSON.stringify(sessions.map((session) => ({ id: session.id, name: session.name }))));
    }
    case 'yummy.sdlc_start': {
      const sessionId = String(args.session_id ?? '');
      const changeRequest = String(args.change_request ?? '');
      return textResult(
        `SDLC workflow initiated for session ${sessionId} with request: "${changeRequest}". Use /sdlc/${sessionId}/status to check progress.`,
      );
    }
    case 'yummy.sdlc_status': {
      const sessionId = String(args.session_id ?? '');
      const session = sessionsRepo.get(sessionId);
      if (!session) return textResult(`Session ${sessionId} not found.`, true);
      return textResult(JSON.stringify({ session_id: sessionId, workflow_state: session.workflowState }));
    }
    default:
      return textResult(`Unknown tool: ${name}`, true);
  }
}
