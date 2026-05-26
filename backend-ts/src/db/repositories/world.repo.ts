/**
 * World config repository — singleton row id=1.
 * Persists runtime-mutable world/MCP settings to SQLite.
 */
import { asc, eq } from 'drizzle-orm';
import type { Db } from '../client.js';
import {
  type WorldConfigInsert,
  type WorldConfigRow,
  type WorldServerInsert,
  type WorldServerRow,
  worldConfig,
  worldServers,
} from '../schema.js';

type DB = Db;

function defaultWorldConfig(): WorldConfigRow {
  return {
    id: 1,
    mcpServerToken: '',
    mcpServerEnabled: false,
    mcpServerPort: '',
    updatedAt: new Date().toISOString(),
  };
}

export async function getWorldConfig(db: DB): Promise<WorldConfigRow> {
  const row = await db.select().from(worldConfig).limit(1).get();
  return row ?? defaultWorldConfig();
}

export async function getWorldServer(
  db: DB,
  serverId: string,
): Promise<WorldServerRow | undefined> {
  return await db.select().from(worldServers).where(eq(worldServers.id, serverId)).get();
}

export async function listWorldServers(db: DB): Promise<WorldServerRow[]> {
  return await db.select().from(worldServers).orderBy(asc(worldServers.createdAt)).all();
}

export async function createWorldServer(
  db: DB,
  insert: WorldServerInsert,
): Promise<WorldServerRow> {
  await db.insert(worldServers).values(insert).run();
  return (await getWorldServer(db, insert.id)) as WorldServerRow;
}

export async function updateWorldServer(
  db: DB,
  id: string,
  partial: Partial<WorldServerInsert>,
): Promise<WorldServerRow | undefined> {
  if (Object.keys(partial).length === 0) return await getWorldServer(db, id);
  await db.update(worldServers).set(partial).where(eq(worldServers.id, id)).run();
  return await getWorldServer(db, id);
}

export async function updateWorldServerStatus(db: DB, id: string, status: string): Promise<void> {
  await db.update(worldServers).set({ lastStatus: status }).where(eq(worldServers.id, id)).run();
}

export async function deleteWorldServer(db: DB, id: string): Promise<void> {
  await db.delete(worldServers).where(eq(worldServers.id, id)).run();
}

export async function updateWorldConfig(
  db: DB,
  partial: Partial<WorldConfigInsert>,
): Promise<WorldConfigRow> {
  const existing = await db.select().from(worldConfig).where(eq(worldConfig.id, 1)).get();
  const patch = {
    ...partial,
    updatedAt: new Date().toISOString(),
  };

  if (existing) {
    await db.update(worldConfig).set(patch).where(eq(worldConfig.id, 1)).run();
  } else {
    await db
      .insert(worldConfig)
      .values({ id: 1, ...partial })
      .run();
  }

  return await getWorldConfig(db);
}
