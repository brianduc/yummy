/**
 * Repo info — singleton row id=1. Returns undefined if not configured.
 */
import { eq } from 'drizzle-orm';
import type { Db } from '../client.js';
import { type RepoInfoRow, repoInfo } from '../schema.js';

type DB = Db;
export type RepoInfo = RepoInfoRow;

export const repoRepo = {
  async get(db: DB): Promise<RepoInfo | undefined> {
    const [row] = await db.select().from(repoInfo).where(eq(repoInfo.id, 1)).limit(1);
    return row;
  },

  async set(db: DB, info: Omit<RepoInfo, 'id'>): Promise<RepoInfo> {
    const existing = await this.get(db);
    if (existing) {
      await db.update(repoInfo).set(info).where(eq(repoInfo.id, 1));
    } else {
      await db.insert(repoInfo).values({ id: 1, ...info });
    }
    return { id: 1, ...info };
  },

  async setBranch(db: DB, branch: string): Promise<void> {
    await db.update(repoInfo).set({ branch }).where(eq(repoInfo.id, 1));
  },

  /** Token getter — returns "" when no repo configured. */
  async getGithubToken(db: DB): Promise<string> {
    return (await this.get(db))?.githubToken ?? '';
  },

  /** Update only the github token; no-op when no repo row exists. */
  async setGithubToken(db: DB, token: string): Promise<void> {
    if (!(await this.get(db))) return;
    await db.update(repoInfo).set({ githubToken: token }).where(eq(repoInfo.id, 1));
  },

  async clear(db: DB): Promise<void> {
    await db.delete(repoInfo);
  },
};
