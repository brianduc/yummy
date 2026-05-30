/**
 * Knowledge base repository — combines tree + insights + project_summary.
 * Matches Python's DB["knowledge_base"] = {tree, insights, project_summary}.
 */
import { asc, eq } from 'drizzle-orm';
import type { Db } from '../client.js';
import { type KbInsightRow, type KbTreeRow, kbInsights, kbMeta, kbTree } from '../schema.js';

type DB = Db;
export type TreeEntry = KbTreeRow;
export type Insight = KbInsightRow;

export const kbRepo = {
  // ─── Tree ─────────────────────────────────────────────
  async listTree(db: DB): Promise<TreeEntry[]> {
    return await db.select().from(kbTree);
  },

  async replaceTree(
    db: DB,
    entries: Array<Omit<TreeEntry, 'status'> & { status?: string }>,
  ): Promise<void> {
    await db.delete(kbTree);
    if (entries.length === 0) return;
    await db
      .insert(kbTree)
      .values(entries.map((e) => ({ path: e.path, name: e.name, status: e.status ?? 'pending' })));
  },

  async updateTreeStatus(db: DB, path: string, status: string): Promise<void> {
    await db.update(kbTree).set({ status }).where(eq(kbTree.path, path));
  },

  async clearTree(db: DB): Promise<void> {
    await db.delete(kbTree);
  },

  // ─── Insights ─────────────────────────────────────────
  async listInsights(db: DB): Promise<Insight[]> {
    return await db.select().from(kbInsights).orderBy(asc(kbInsights.createdAt));
  },

  async addInsight(db: DB, insight: Insight): Promise<void> {
    await db.insert(kbInsights).values(insight);
  },

  async clearInsights(db: DB): Promise<void> {
    await db.delete(kbInsights);
  },

  // ─── Project summary (singleton) ──────────────────────
  async getProjectSummary(db: DB): Promise<string> {
    const [row] = await db.select().from(kbMeta).where(eq(kbMeta.id, 1)).limit(1);
    return row?.projectSummary ?? '';
  },

  async setProjectSummary(db: DB, summary: string): Promise<void> {
    const [existing] = await db.select().from(kbMeta).where(eq(kbMeta.id, 1)).limit(1);
    if (existing) {
      await db.update(kbMeta).set({ projectSummary: summary }).where(eq(kbMeta.id, 1));
    } else {
      await db.insert(kbMeta).values({ id: 1, projectSummary: summary });
    }
  },

  /** Reset everything — used by DELETE /kb and at scan start. */
  async resetAll(db: DB): Promise<void> {
    await db.delete(kbTree);
    await db.delete(kbInsights);
    await db.delete(kbMeta);
  },

  /** Whole-KB snapshot for /kb GET. */
  async snapshot(
    db: DB,
  ): Promise<{ tree: TreeEntry[]; insights: Insight[]; project_summary: string }> {
    return {
      tree: await this.listTree(db),
      insights: await this.listInsights(db),
      project_summary: await this.getProjectSummary(db),
    };
  },

  async isEmpty(db: DB): Promise<boolean> {
    const [r] = await db.select({ id: kbInsights.id }).from(kbInsights).limit(1);
    return r === undefined;
  },
};
