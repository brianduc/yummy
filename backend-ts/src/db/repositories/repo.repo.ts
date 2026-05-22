/**
 * Repo info — singleton row id=1. Returns undefined if not configured.
 */
import { eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schema from '../schema.js';
import { type RepoInfoRow, repoInfo } from '../schema.js';

type DB = DrizzleD1Database<typeof schema>;
export type RepoInfo = RepoInfoRow;

export const repoRepo = {
  async get(db: DB): Promise<RepoInfo | undefined> {
    return await db.select().from(repoInfo).where(eq(repoInfo.id, 1)).get();
  },

  async set(db: DB, info: Omit<RepoInfo, 'id'>): Promise<RepoInfo> {
    const existing = await this.get(db);
    if (existing) {
      await db.update(repoInfo).set(info).where(eq(repoInfo.id, 1)).run();
    } else {
      await db
        .insert(repoInfo)
        .values({ id: 1, ...info })
        .run();
    }
    return { id: 1, ...info };
  },

  async setBranch(db: DB, branch: string): Promise<void> {
    await db.update(repoInfo).set({ branch }).where(eq(repoInfo.id, 1)).run();
  },

  /** Token getter — returns "" when no repo configured. */
  async getGithubToken(db: DB): Promise<string> {
    return (await this.get(db))?.githubToken ?? '';
  },

  /** Update only the github token; no-op when no repo row exists. */
  async setGithubToken(db: DB, token: string): Promise<void> {
    if (!(await this.get(db))) return;
    await db.update(repoInfo).set({ githubToken: token }).where(eq(repoInfo.id, 1)).run();
  },

  async clear(db: DB): Promise<void> {
    await db.delete(repoInfo).run();
  },
};
