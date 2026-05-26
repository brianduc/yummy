import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

// Use in-memory DB for tests
process.env.DATABASE_URL = ':memory:';

import { resolve } from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { db, getLocalDb } from '../../src/db/client.js';
import { kbRepo } from '../../src/db/repositories/kb.repo.js';
import { logsRepo } from '../../src/db/repositories/logs.repo.js';
import { repoRepo } from '../../src/db/repositories/repo.repo.js';
import { scanStatusRepo } from '../../src/db/repositories/scan-status.repo.js';
import { sessionsRepo } from '../../src/db/repositories/sessions.repo.js';

beforeAll(() => {
  migrate(getLocalDb(), { migrationsFolder: resolve(__dirname, '../../drizzle') });
});

beforeEach(async () => {
  const sessions = await sessionsRepo.list(db);
  for (const s of sessions) await sessionsRepo.delete(db, s.id);
  await kbRepo.resetAll(db);
  await repoRepo.clear(db);
  await scanStatusRepo.clear(db);
  await logsRepo.clear(db);
});

describe('sessionsRepo', () => {
  it('creates, gets, updates, resets, and deletes a session', async () => {
    const s = await sessionsRepo.create(db, 's1', 'Workspace A');
    expect(s.id).toBe('s1');
    expect(s.workflowState).toBe('idle');
    expect(s.logs).toHaveLength(1);
    expect(s.logs[0]?.role).toBe('system');

    const got = await sessionsRepo.get(db, 's1');
    expect(got?.name).toBe('Workspace A');

    await sessionsRepo.update(db, 's1', { workflowState: 'running_ba', metrics: { tokens: 42 } });
    expect((await sessionsRepo.get(db, 's1'))?.workflowState).toBe('running_ba');
    expect((await sessionsRepo.get(db, 's1'))?.metrics.tokens).toBe(42);

    await sessionsRepo.reset(db, 's1');
    expect((await sessionsRepo.get(db, 's1'))?.workflowState).toBe('idle');
    expect((await sessionsRepo.get(db, 's1'))?.agentOutputs).toEqual({});

    expect(await sessionsRepo.delete(db, 's1')).toBe(true);
    expect(await sessionsRepo.get(db, 's1')).toBeUndefined();
  });
});

describe('kbRepo', () => {
  it('manages tree, insights, project summary', async () => {
    expect(await kbRepo.isEmpty(db)).toBe(true);

    await kbRepo.replaceTree(db, [
      { path: 'src/a.ts', name: 'a.ts' },
      { path: 'src/b.ts', name: 'b.ts' },
    ]);
    expect(await kbRepo.listTree(db)).toHaveLength(2);

    await kbRepo.updateTreeStatus(db, 'src/a.ts', 'done');
    const tree = await kbRepo.listTree(db);
    expect(tree.find((t) => t.path === 'src/a.ts')?.status).toBe('done');

    await kbRepo.addInsight(db, {
      id: 1,
      files: ['src/a.ts'],
      summary: 'A summary',
      createdAt: 100,
    });
    await kbRepo.addInsight(db, {
      id: 2,
      files: ['src/b.ts'],
      summary: 'B summary',
      createdAt: 200,
    });
    expect(await kbRepo.listInsights(db)).toHaveLength(2);
    expect(await kbRepo.isEmpty(db)).toBe(false);

    await kbRepo.setProjectSummary(db, '# Wiki');
    expect(await kbRepo.getProjectSummary(db)).toBe('# Wiki');

    const snap = await kbRepo.snapshot(db);
    expect(snap.tree).toHaveLength(2);
    expect(snap.insights).toHaveLength(2);
    expect(snap.project_summary).toBe('# Wiki');

    await kbRepo.resetAll(db);
    expect(await kbRepo.isEmpty(db)).toBe(true);
    expect(await kbRepo.listTree(db)).toHaveLength(0);
    expect(await kbRepo.getProjectSummary(db)).toBe('');
  });
});

describe('repoRepo + scanStatusRepo + logsRepo', () => {
  it('repoRepo upserts singleton', async () => {
    expect(await repoRepo.get(db)).toBeUndefined();
    await repoRepo.set(db, {
      owner: 'octocat',
      repo: 'hello',
      branch: null,
      url: 'https://github.com/octocat/hello',
      githubToken: '',
      maxScanLimit: 5000,
    });
    expect((await repoRepo.get(db))?.owner).toBe('octocat');
    await repoRepo.setBranch(db, 'main');
    expect((await repoRepo.get(db))?.branch).toBe('main');
    await repoRepo.clear(db);
    expect(await repoRepo.get(db)).toBeUndefined();
  });

  it('scanStatusRepo returns undefined until set', async () => {
    expect(await scanStatusRepo.get(db)).toBeUndefined();
    await scanStatusRepo.set(db, { running: true, text: 'go', progress: 10, error: false });
    expect(await scanStatusRepo.get(db)).toEqual({
      running: true,
      text: 'go',
      progress: 10,
      error: false,
    });
    await scanStatusRepo.patch(db, { progress: 50 });
    expect((await scanStatusRepo.get(db))?.progress).toBe(50);
    await scanStatusRepo.clear(db);
    expect(await scanStatusRepo.get(db)).toBeUndefined();
  });

  it('logsRepo orders newest first', async () => {
    await logsRepo.add(db, {
      id: 1,
      time: '00:00:01',
      agent: 'A',
      provider: 'gemini',
      model: 'm',
      inTokens: 1,
      outTokens: 1,
      latency: 0.1,
      cost: 0.001,
    });
    await logsRepo.add(db, {
      id: 2,
      time: '00:00:02',
      agent: 'B',
      provider: 'gemini',
      model: 'm',
      inTokens: 2,
      outTokens: 2,
      latency: 0.2,
      cost: 0.002,
    });
    const logs = await logsRepo.list(db);
    expect(logs[0]?.id).toBe(2);
    expect(logs[1]?.id).toBe(1);
    expect(await logsRepo.count(db)).toBe(2);
    expect(await logsRepo.totalCost(db)).toBeCloseTo(0.003);
    await logsRepo.clear(db);
    expect(await logsRepo.count(db)).toBe(0);
  });
});
