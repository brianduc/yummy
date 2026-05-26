import './_setup.js';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { db } from '../../src/db/client.local.js';
import { kbRepo } from '../../src/db/repositories/kb.repo.js';
import { repoRepo } from '../../src/db/repositories/repo.repo.js';
import { setAIResponse, setDefaultAIResponse } from './_setup.js';

const app = createApp();

async function seedKb() {
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
    summary: 'mock',
    createdAt: Date.now(),
  });
  await kbRepo.setProjectSummary(db, '# Mock Project');
}

async function createSession() {
  const r = await app.request('/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'SDLCTest' }),
  });
  return ((await r.json()) as { id: string }).id;
}

function parseSse(text: string): Record<string, unknown>[] {
  const events: Record<string, unknown>[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('data: ')) {
      events.push(JSON.parse(trimmed.slice(6)) as Record<string, unknown>);
    }
  }
  return events;
}

async function finalSseEvent(res: Response): Promise<Record<string, unknown>> {
  const events = parseSse(await res.text());
  return events.at(-1) ?? {};
}

describe('sdlc workflow integration', () => {
  it('rejects approve-ba before /start', async () => {
    const sid = await createSession();
    const res = await app.request('/sdlc/approve-ba', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session_id: sid }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown session on state', async () => {
    const res = await app.request('/sdlc/nope/state');
    expect(res.status).toBe(404);
  });

  it('runs full BA → SA → Dev Lead → DEV/SEC/QA/SRE pipeline', async () => {
    await seedKb();
    const sid = await createSession();

    setAIResponse('BA', 'BRD content here');
    setAIResponse('SA', 'Architecture here');
    setAIResponse('PM', '```json\n{"epics":[{"epic":"E1","stories":["S1","S2"]}]}\n```');
    setAIResponse('DEV_LEAD', 'Implementation plan');
    setAIResponse('DEV', 'Code commits');
    setAIResponse('SECURITY', 'No CVEs');
    setAIResponse('QA', 'All tests pass');
    setAIResponse('SRE', 'Deployed to prod');
    setDefaultAIResponse('default');

    // 1. /sdlc/start → BA
    const start = await app.request('/sdlc/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session_id: sid, requirement: 'Build feature X' }),
    });
    expect(start.status).toBe(200);
    const startBody = await finalSseEvent(start);
    expect(startBody.state).toBe('waiting_ba_approval');
    expect((startBody.agent_outputs as Record<string, unknown>).ba).toBe('mock streamed response');

    // 2. approve-ba → SA + PM (parallel) → backlog
    const ba = await app.request('/sdlc/approve-ba', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session_id: sid }),
    });
    expect(ba.status).toBe(200);
    const baBody = await finalSseEvent(ba);
    expect(baBody.state).toBe('waiting_sa_approval');
    expect((baBody.agent_outputs as Record<string, unknown>).sa).toBe('mock streamed response');
    expect(baBody.jira_backlog).toEqual([{ epic: 'E1', stories: ['S1', 'S2'] }]);

    // 3. approve-sa → Dev Lead
    const sa = await app.request('/sdlc/approve-sa', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session_id: sid }),
    });
    expect(sa.status).toBe(200);
    const saBody = await finalSseEvent(sa);
    expect(saBody.state).toBe('waiting_dev_lead_approval');
    expect((saBody.agent_outputs as Record<string, unknown>).dev_lead).toBe(
      'mock streamed response',
    );

    // 4. approve-dev-lead → DEV/SEC/QA/SRE
    const dl = await app.request('/sdlc/approve-dev-lead', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session_id: sid }),
    });
    expect(dl.status).toBe(200);
    const dlBody = await finalSseEvent(dl);
    const dlOutputs = dlBody.agent_outputs as Record<string, unknown>;
    expect(dlBody.state).toBe('done');
    expect(dlOutputs.dev).toBe('mock streamed response');
    expect(dlOutputs.security).toBe('mock streamed response');
    expect(dlOutputs.qa).toBe('mock streamed response');
    expect(dlOutputs.sre).toBe('mock streamed response');

    // Final state reflects everything
    const state = await app.request(`/sdlc/${sid}/state`);
    const stateBody = (await state.json()) as {
      workflow_state: string;
      agent_outputs: Record<string, unknown>;
      jira_backlog: unknown[];
    };
    expect(stateBody.workflow_state).toBe('done');
    expect(stateBody.agent_outputs.requirement).toBe('Build feature X');
    expect(stateBody.agent_outputs.ba).toBe('mock streamed response');
    expect(stateBody.agent_outputs.sa).toBe('mock streamed response');
    expect(stateBody.agent_outputs.dev_lead).toBe('mock streamed response');
    expect(stateBody.agent_outputs.dev).toBe('mock streamed response');
    expect(stateBody.jira_backlog).toHaveLength(1);
  });

  it('approve-ba accepts edited_content override', async () => {
    await seedKb();
    const sid = await createSession();
    setAIResponse('BA', 'original BA');
    setAIResponse('SA', 'sa');
    setAIResponse('PM', '[]');

    await finalSseEvent(
      await app.request('/sdlc/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ session_id: sid, requirement: 'X' }),
      }),
    );

    await finalSseEvent(
      await app.request('/sdlc/approve-ba', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ session_id: sid, edited_content: 'EDITED BRD' }),
      }),
    );

    const state = await app.request(`/sdlc/${sid}/state`);
    const body = (await state.json()) as {
      agent_outputs: Record<string, unknown>;
    };
    expect(body.agent_outputs.ba).toBe('EDITED BRD');
  });

  it('PM JSON parse failure falls back to []', async () => {
    await seedKb();
    const sid = await createSession();
    setAIResponse('BA', 'ba');
    setAIResponse('SA', 'sa');
    setAIResponse('PM', 'not valid json at all');

    await finalSseEvent(
      await app.request('/sdlc/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ session_id: sid, requirement: 'X' }),
      }),
    );
    const ba = await app.request('/sdlc/approve-ba', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session_id: sid }),
    });
    const body = await finalSseEvent(ba);
    expect(body.jira_backlog).toEqual([]);
  });
});
