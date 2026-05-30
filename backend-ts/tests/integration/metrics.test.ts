import './_setup.js';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { createDb } from '../../src/db/client.js';

const db = createDb();

import { logsRepo } from '../../src/db/repositories/logs.repo.js';

const app = createApp();

async function seedLogs() {
  await logsRepo.add(db, {
    id: 1,
    time: '10:00:00',
    agent: 'BA',
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    inTokens: 100,
    outTokens: 50,
    latency: 0.5,
    cost: 0.001,
  });
  await logsRepo.add(db, {
    id: 2,
    time: '10:00:05',
    agent: 'BA',
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    inTokens: 200,
    outTokens: 100,
    latency: 0.7,
    cost: 0.002,
  });
  await logsRepo.add(db, {
    id: 3,
    time: '10:00:10',
    agent: 'SA',
    provider: 'openai',
    model: 'gpt-4o',
    inTokens: 300,
    outTokens: 150,
    latency: 1.0,
    cost: 0.005,
  });
}

describe('metrics integration', () => {
  it('GET /metrics with no logs returns zero state', async () => {
    const res = await app.request('/metrics');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      total_requests: number;
      total_cost_usd: number;
      agent_breakdown: Record<string, unknown>;
      logs: unknown[];
    };
    expect(body.total_requests).toBe(0);
    expect(body.total_cost_usd).toBe(0);
    expect(body.logs).toEqual([]);
    expect(body.agent_breakdown).toEqual({});
  });

  it('GET /metrics aggregates and returns logs newest-first', async () => {
    await seedLogs();
    const res = await app.request('/metrics');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      total_requests: number;
      total_cost_usd: number;
      agent_breakdown: Record<string, { calls: number; cost: number; total_tokens: number }>;
      logs: Array<{ id: number; agent: string; in_tokens: number }>;
    };
    expect(body.total_requests).toBe(3);
    expect(body.total_cost_usd).toBeCloseTo(0.008, 6);

    expect(body.agent_breakdown.BA?.calls).toBe(2);
    expect(body.agent_breakdown.BA?.total_tokens).toBe(450); // 100+50+200+100
    expect(body.agent_breakdown.BA?.cost).toBeCloseTo(0.003, 6);
    expect(body.agent_breakdown.SA?.calls).toBe(1);
    expect(body.agent_breakdown.SA?.total_tokens).toBe(450);

    // Newest-first ordering
    expect(body.logs[0]?.id).toBe(3);
    expect(body.logs[1]?.id).toBe(2);
    expect(body.logs[2]?.id).toBe(1);

    // snake_case keys at boundary
    expect(body.logs[0]?.in_tokens).toBe(300);
  });

  it('DELETE /metrics clears all logs', async () => {
    await seedLogs();
    const del = await app.request('/metrics', { method: 'DELETE' });
    expect(del.status).toBe(200);
    const body = (await del.json()) as { status: string };
    expect(body.status).toBe('ok');

    const after = await app.request('/metrics');
    const body2 = (await after.json()) as { total_requests: number };
    expect(body2.total_requests).toBe(0);
  });
});
