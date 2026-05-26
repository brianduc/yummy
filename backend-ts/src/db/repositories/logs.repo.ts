/**
 * Request logs — newest-first ordering (matches Python `insert(0, ...)`).
 */
import { desc } from 'drizzle-orm';
import type { Db } from '../client.js';
import { type RequestLogInsert, type RequestLogRow, requestLogs } from '../schema.js';

type DB = Db;
export type RequestLog = RequestLogRow;

export const logsRepo = {
  async list(db: DB): Promise<RequestLog[]> {
    return await db.select().from(requestLogs).orderBy(desc(requestLogs.id)).all();
  },

  async add(db: DB, log: RequestLogInsert): Promise<void> {
    await db.insert(requestLogs).values(log).run();
  },

  async clear(db: DB): Promise<void> {
    await db.delete(requestLogs).run();
  },

  async count(db: DB): Promise<number> {
    const rows = await db.select({ id: requestLogs.id }).from(requestLogs).all();
    return rows.length;
  },

  async totalCost(db: DB): Promise<number> {
    const rows = await db.select({ cost: requestLogs.cost }).from(requestLogs).all();
    return rows.reduce((sum, r) => sum + (r.cost ?? 0), 0);
  },
};
