/**
 * Scan status — singleton row id=1.
 * Returns undefined when no scan has been initialized (Python's `None`).
 */
import { eq } from 'drizzle-orm';
import { db } from '../client.js';
import { scanStatus, type ScanStatusRow } from '../schema.js';

export interface ScanStatus {
  running: boolean;
  text: string;
  progress: number;
  error: boolean;
  /**
   * Code-intel (gitnexus + embeddings) health.
   *   - `null`  : scan hasn't reached the code-intel phase yet (or never).
   *   - `true`  : RAG is fully operational (chunks + graph populated).
   *   - `false` : code-intel failed — `/ask` is in degraded `kb-insights`-only mode.
   * Kept distinct from `error` so legacy AI-insights success doesn't mask an
   * RAG outage (and vice versa).
   */
  codeIntelOk?: boolean | null;
  /** Human-readable explanation when codeIntelOk === false. */
  codeIntelMessage?: string;
}

const ROW_ID = 1;

export const scanStatusRepo = {
  get(): ScanStatus | undefined {
    const row = db.select().from(scanStatus).where(eq(scanStatus.id, ROW_ID)).get();
    if (!row || !row.initialized) return undefined;
    return {
      running: row.running,
      text: row.text,
      progress: row.progress,
      error: row.error,
      codeIntelOk: row.codeIntelOk ?? null,
      codeIntelMessage: row.codeIntelMessage ?? '',
    };
  },

  set(s: ScanStatus): void {
    const row: ScanStatusRow = {
      id: ROW_ID,
      running: s.running,
      text: s.text,
      progress: s.progress,
      error: s.error,
      initialized: true,
      codeIntelOk: s.codeIntelOk ?? null,
      codeIntelMessage: s.codeIntelMessage ?? '',
    };
    const existing = db.select().from(scanStatus).where(eq(scanStatus.id, ROW_ID)).get();
    if (existing) {
      db.update(scanStatus).set(row).where(eq(scanStatus.id, ROW_ID)).run();
    } else {
      db.insert(scanStatus).values(row).run();
    }
  },

  patch(patch: Partial<ScanStatus>): void {
    const cur = this.get();
    this.set({
      running: patch.running ?? cur?.running ?? false,
      text: patch.text ?? cur?.text ?? '',
      progress: patch.progress ?? cur?.progress ?? 0,
      error: patch.error ?? cur?.error ?? false,
      // For nullable codeIntelOk we must distinguish "explicitly null" from
      // "absent in patch" — `in` keeps an explicit `null` reset working.
      codeIntelOk: 'codeIntelOk' in patch ? patch.codeIntelOk ?? null : cur?.codeIntelOk ?? null,
      codeIntelMessage: patch.codeIntelMessage ?? cur?.codeIntelMessage ?? '',
    });
  },

  clear(): void {
    db.delete(scanStatus).where(eq(scanStatus.id, ROW_ID)).run();
  },
};
