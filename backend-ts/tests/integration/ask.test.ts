import './_setup.js';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { createDb } from '../../src/db/client.js';

const db = createDb();
import { kbRepo } from '../../src/db/repositories/kb.repo.js';
import { repoRepo } from '../../src/db/repositories/repo.repo.js';
import { sessionsRepo } from '../../src/db/repositories/sessions.repo.js';
import { setAIResponse } from './_setup.js';

const app = createApp();

async function createSession() {
  const r = await app.request('/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'AskTest' }),
  });
  return ((await r.json()) as { id: string }).id;
}

async function seedKb() {
  // Repo info is needed for buildRagPrompt? Check guards — only requireKnowledgeBase.
  // We seed a small KB directly to bypass scan.
  await repoRepo.set(db, {
    url: 'https://github.com/mock/mock',
    owner: 'mock',
    repo: 'mock',
    branch: 'main',
    githubToken: '',
    maxScanLimit: 100,
  });
  await kbRepo.replaceTree(db, [{ path: 'README.md', name: 'README.md', status: 'done' }]);
  await kbRepo.addInsight(db, {
    id: 1,
    files: ['README.md'],
    summary: 'project does X',
    createdAt: Date.now(),
  });
  await kbRepo.setProjectSummary(db, '# Project Mock\nA mock project.');
}

async function readStream(res: Response): Promise<string> {
  expect(res.body).toBeTruthy();
  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  let text = '';

  if (!reader) return text;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }

  return text;
}

describe('ask integration', () => {
  it('POST /ask/sync returns 404 for unknown session', async () => {
    await seedKb();
    const res = await app.request('/ask/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session_id: 'nope', question: 'hi' }),
    });
    expect(res.status).toBe(404);
  });

  it('POST /ask/sync returns 400 when KB is empty', async () => {
    const sid = await createSession();
    const res = await app.request('/ask/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session_id: sid, question: 'hi' }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /ask/sync returns answer + appends to chat history', async () => {
    await seedKb();
    const sid = await createSession();
    setAIResponse('EXPERT', 'The answer is 42.');

    const res = await app.request('/ask/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        session_id: sid,
        question: 'What is the meaning?',
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      question: string;
      answer: string;
      session_id: string;
      trace: unknown;
    };
    expect(body.answer).toBe('The answer is 42.');
    expect(body.question).toBe('What is the meaning?');
    expect(body.session_id).toBe(sid);
    expect(body.trace).toBeDefined();

    // History has 2 new entries appended
    const histRes = await app.request(`/sessions/${sid}`);
    const hist = (await histRes.json()) as {
      chat_history: Array<{ role: string; text: string; timestamp?: string }>;
    };
    expect(hist.chat_history).toHaveLength(2);
    expect(hist.chat_history[0]?.role).toBe('user');
    expect(hist.chat_history[1]?.role).toBe('assistant');
    expect(hist.chat_history[1]?.text).toBe('The answer is 42.');
    expect(hist.chat_history[0]?.timestamp).toBeDefined();
    expect(hist.chat_history[1]?.timestamp).toBeDefined();
    expect(hist.chat_history[0]?.timestamp?.localeCompare(hist.chat_history[1]?.timestamp ?? '')).toBeLessThanOrEqual(
      0,
    );
  });

  it('GET /sessions/{id} returns chat history ordered by timestamp', async () => {
    const sid = await createSession();
    await sessionsRepo.update(db, sid, {
      chatHistory: [
        { role: 'assistant', text: 'second', timestamp: '2026-05-29T09:00:02.000000' },
        { role: 'user', text: 'first', timestamp: '2026-05-29T09:00:01.000000' },
      ],
    });

    const histRes = await app.request(`/sessions/${sid}`);
    const hist = (await histRes.json()) as {
      chat_history: Array<{ role: string; text: string; timestamp?: string }>;
    };

    expect(hist.chat_history.map((m) => m.text)).toEqual(['first', 'second']);
    expect(hist.chat_history.map((m) => m.timestamp)).toEqual([
      '2026-05-29T09:00:01.000000',
      '2026-05-29T09:00:02.000000',
    ]);
  });

  it('POST /ask/free streaming persists the assistant response', async () => {
    const sid = await createSession();

    const res = await app.request('/ask/free', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session_id: sid, question: 'hello' }),
    });

    expect(res.status).toBe(200);
    expect(await readStream(res)).toContain('data: [DONE]');

    const histRes = await app.request(`/sessions/${sid}`);
    const hist = (await histRes.json()) as {
      chat_history: Array<{ role: string; text: string; timestamp?: string }>;
    };

    expect(hist.chat_history).toHaveLength(2);
    expect(hist.chat_history[0]).toMatchObject({ role: 'user', text: 'hello' });
    expect(hist.chat_history[1]).toMatchObject({
      role: 'assistant',
      text: 'mock streamed response',
    });
    expect(hist.chat_history[1]?.timestamp).toBeDefined();
  });
});
