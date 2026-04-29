/**
 * World config repository — singleton row id=1.
 * Persists runtime-mutable world/MCP settings to SQLite.
 */
import { asc, eq, sql } from 'drizzle-orm';
import { db } from '../client.js';
import {
  worldConfig,
  worldServers,
  type WorldConfigInsert,
  type WorldConfigRow,
  type WorldServerInsert,
  type WorldServerRow,
} from '../schema.js';

function defaultWorldConfig(): WorldConfigRow {
  return {
    id: 1,
    mcpServerToken: '',
    mcpServerEnabled: false,
    mcpServerPort: '',
    updatedAt: new Date().toISOString(),
  };
}

export async function getWorldConfig(): Promise<WorldConfigRow> {
  const row = db.select().from(worldConfig).limit(1).get();
  return row ?? defaultWorldConfig();
}

export async function getWorldServer(serverId: string): Promise<WorldServerRow | undefined> {
  return db.select().from(worldServers).where(eq(worldServers.id, serverId)).get();
}

export async function listWorldServers(): Promise<WorldServerRow[]> {
  return db.select().from(worldServers).orderBy(asc(worldServers.createdAt)).all();
}

export async function createWorldServer(insert: WorldServerInsert): Promise<WorldServerRow> {
  db.insert(worldServers).values(insert).run();
  return (await getWorldServer(insert.id)) as WorldServerRow;
}

export async function updateWorldServer(
  id: string,
  partial: Partial<WorldServerInsert>,
): Promise<WorldServerRow | undefined> {
  if (Object.keys(partial).length === 0) return getWorldServer(id);
  db.update(worldServers).set(partial).where(eq(worldServers.id, id)).run();
  return getWorldServer(id);
}

export async function updateWorldServerStatus(id: string, status: string): Promise<void> {
  db.update(worldServers).set({ lastStatus: status }).where(eq(worldServers.id, id)).run();
}

export async function deleteWorldServer(id: string): Promise<void> {
  db.delete(worldServers).where(eq(worldServers.id, id)).run();
}

export async function updateWorldConfig(partial: Partial<WorldConfigInsert>): Promise<WorldConfigRow> {
  const existing = db.select().from(worldConfig).where(eq(worldConfig.id, 1)).get();
  const patch = {
    ...partial,
    updatedAt: sql`(datetime('now'))`,
  };

  if (existing) {
    db.update(worldConfig).set(patch).where(eq(worldConfig.id, 1)).run();
  } else {
    db.insert(worldConfig).values({ id: 1, ...partial }).run();
  }

  return (await getWorldConfig()) ?? defaultWorldConfig();
}
