import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

process.env.DATABASE_URL = ':memory:';

import { resolve } from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { db, getLocalDb } from '../../src/db/client.js';
import { kbRepo } from '../../src/db/repositories/kb.repo.js';
import { repoRepo } from '../../src/db/repositories/repo.repo.js';
import { sessionsRepo } from '../../src/db/repositories/sessions.repo.js';
import {
  requireKnowledgeBase,
  requireRepo,
  requireSession,
  requireWorkflowState,
} from '../../src/lib/guards.js';

beforeAll(() => {
  migrate(getLocalDb(), { migrationsFolder: resolve(__dirname, '../../drizzle') });
});

beforeEach(async () => {
  // wipe between tests
  const sessions = await sessionsRepo.list(db);
  for (const s of sessions) await sessionsRepo.delete(db, s.id);
  await repoRepo.clear(db);
  await kbRepo.resetAll(db);
});

describe('guards', () => {
  it('requireSession throws 404 with FastAPI-style detail', async () => {
    await expect(requireSession(db, 'nope')).rejects.toMatchObject({
      status: 404,
      detail: expect.stringContaining("Session 'nope' not found"),
    });
  });

  it('requireSession returns the session when present', async () => {
    await sessionsRepo.create(db, 's1', 'WS');
    expect((await requireSession(db, 's1')).id).toBe('s1');
  });

  it('requireRepo throws 400 when not configured', async () => {
    await expect(requireRepo(db)).rejects.toThrow(/GitHub repo not configured/);
  });

  it('requireKnowledgeBase throws 400 when empty', async () => {
    await expect(requireKnowledgeBase(db)).rejects.toThrow(/Knowledge base is empty/);
  });

  it('requireKnowledgeBase passes when insights exist', async () => {
    await kbRepo.addInsight(db, { id: 1, files: ['a.ts'], summary: 's', createdAt: 1 });
    const kb = await requireKnowledgeBase(db);
    expect(kb.insights).toHaveLength(1);
  });

  it('requireWorkflowState throws 400 on mismatch', async () => {
    const s = await sessionsRepo.create(db, 's2', 'WS');
    expect(() => requireWorkflowState(s, 'waiting_ba_approval')).toThrow(
      /Current workflow state is 'idle'/,
    );
  });

  it('requireWorkflowState passes on match', async () => {
    const s = await sessionsRepo.create(db, 's3', 'WS');
    expect(() => requireWorkflowState(s, 'idle')).not.toThrow();
  });
});
