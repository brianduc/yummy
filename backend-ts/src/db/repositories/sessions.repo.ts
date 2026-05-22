/**
 * Sessions repository.
 * Mirrors Python's DB["sessions"] dict with the make_session() shape.
 */
import { eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { nowIso } from '../../lib/time.js';
import type * as schema from '../schema.js';
import { type SessionRow, sessions } from '../schema.js';

type DB = DrizzleD1Database<typeof schema>;
export type Session = SessionRow;

function defaultSystemLog(name: string): Session['logs'][number] {
  return {
    role: 'system',
    text: `⚡ YUMMY\nWorkspace: ${name}\nType /help to see available commands.`,
  };
}

export const sessionsRepo = {
  async list(db: DB): Promise<Session[]> {
    return await db.select().from(sessions).all();
  },

  async get(db: DB, id: string): Promise<Session | undefined> {
    return await db.select().from(sessions).where(eq(sessions.id, id)).get();
  },

  async create(db: DB, id: string, name: string): Promise<Session> {
    const row: Session = {
      id,
      name,
      createdAt: nowIso(),
      logs: [defaultSystemLog(name)],
      chatHistory: [],
      agentOutputs: {},
      jiraBacklog: [],
      metrics: { tokens: 0 },
      workflowState: 'idle',
    };
    await db.insert(sessions).values(row).run();
    return row;
  },

  async update(
    db: DB,
    id: string,
    patch: Partial<Omit<Session, 'id'>>,
  ): Promise<Session | undefined> {
    if (Object.keys(patch).length === 0) return await this.get(db, id);
    await db.update(sessions).set(patch).where(eq(sessions.id, id)).run();
    return await this.get(db, id);
  },

  async delete(db: DB, id: string): Promise<boolean> {
    const res = await db.delete(sessions).where(eq(sessions.id, id)).run();
    return res.changes > 0;
  },

  /** Reset agent outputs / jira backlog / workflow state — keeps logs + chat. */
  async reset(db: DB, id: string): Promise<Session | undefined> {
    return await this.update(db, id, {
      agentOutputs: {},
      jiraBacklog: [],
      workflowState: 'idle',
    });
  },
};
