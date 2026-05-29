/**
 * Sessions repository.
 * Mirrors Python's DB["sessions"] dict with the make_session() shape.
 */
import { eq } from 'drizzle-orm';
import { nowIso } from '../../lib/time.js';
import type { Db } from '../client.js';
import { type SessionRow, sessions } from '../schema.js';

type DB = Db;
export type Session = SessionRow;

function orderedChatHistory(chatHistory: Session['chatHistory']): Session['chatHistory'] {
  return [...chatHistory].sort((a, b) => {
    const left = a.timestamp ?? '';
    const right = b.timestamp ?? '';
    if (left === right) return 0;
    if (!left) return -1;
    if (!right) return 1;
    return left.localeCompare(right);
  });
}

function withOrderedChatHistory<T extends Session | undefined>(session: T): T {
  if (!session) return session;
  return { ...session, chatHistory: orderedChatHistory(session.chatHistory) };
}

function defaultSystemLog(name: string): Session['logs'][number] {
  return {
    role: 'system',
    text: `⚡ YUMMY\nWorkspace: ${name}\nType /help to see available commands.`,
  };
}

export const sessionsRepo = {
  async list(db: DB): Promise<Session[]> {
    return (await db.select().from(sessions).all()).map((session) => withOrderedChatHistory(session));
  },

  async get(db: DB, id: string): Promise<Session | undefined> {
    return withOrderedChatHistory(await db.select().from(sessions).where(eq(sessions.id, id)).get());
  },

  async count(db: DB): Promise<number> {
    const rows = await db.select({ id: sessions.id }).from(sessions).all();
    return rows.length;
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
    const existing = await this.get(db, id);
    if (!existing) return false;
    await db.delete(sessions).where(eq(sessions.id, id)).run();
    return true;
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
