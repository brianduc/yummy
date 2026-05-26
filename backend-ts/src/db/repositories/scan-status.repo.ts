/**
 * Scan status — singleton row id=1.
 * Returns undefined when no scan has been initialized (Python's `None`).
 */
import { eq } from 'drizzle-orm';
import type { Db } from '../client.js';
import { type ScanStatusRow, scanStatus } from '../schema.js';

type DB = Db;
export interface ScanStatus {
  running: boolean;
  text: string;
  progress: number;
  error: boolean;
}

const ROW_ID = 1;

export const scanStatusRepo = {
  async get(db: DB): Promise<ScanStatus | undefined> {
    const row = await db.select().from(scanStatus).where(eq(scanStatus.id, ROW_ID)).get();
    if (!row?.initialized) return undefined;
    return {
      running: row.running,
      text: row.text,
      progress: row.progress,
      error: row.error,
    };
  },

  async set(db: DB, s: ScanStatus): Promise<void> {
    const row: ScanStatusRow = {
      id: ROW_ID,
      running: s.running,
      text: s.text,
      progress: s.progress,
      error: s.error,
      initialized: true,
    };
    const existing = await db.select().from(scanStatus).where(eq(scanStatus.id, ROW_ID)).get();
    if (existing) {
      await db.update(scanStatus).set(row).where(eq(scanStatus.id, ROW_ID)).run();
    } else {
      await db.insert(scanStatus).values(row).run();
    }
  },

  async patch(db: DB, patch: Partial<ScanStatus>): Promise<void> {
    const cur = await this.get(db);
    await this.set(db, {
      running: patch.running ?? cur?.running ?? false,
      text: patch.text ?? cur?.text ?? '',
      progress: patch.progress ?? cur?.progress ?? 0,
      error: patch.error ?? cur?.error ?? false,
    });
  },

  async clear(db: DB): Promise<void> {
    await db.delete(scanStatus).where(eq(scanStatus.id, ROW_ID)).run();
  },
};
