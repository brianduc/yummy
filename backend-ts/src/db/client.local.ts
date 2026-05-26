/**
 * Node-only SQLite database helpers — MUST NOT be imported in the CF Worker
 * bundle chain (worker.ts or anything it imports). Safe to use from:
 * index.ts, migrate.ts, and tests.
 *
 * Side effect on import: registers the local SQLite getter with client.ts
 * so that createDb(undefined) in routers works transparently in Node mode.
 */
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import {
  type BetterSQLite3Database,
  drizzle as drizzleBetterSQLite,
} from 'drizzle-orm/better-sqlite3';
import { _registerLocalDb } from './client.js';
import * as schema from './schema.js';

let localSqlite: Database.Database | undefined;
let localDb: BetterSQLite3Database<typeof schema> | undefined;

function getLocalDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    return ':memory:';
  }

  return './data/yummy.db';
}

function ensureLocalDatabaseDirectory(databaseUrl: string): void {
  if (databaseUrl === ':memory:') {
    return;
  }

  const directory = dirname(databaseUrl);

  if (directory !== '.') {
    mkdirSync(directory, { recursive: true });
  }
}

export function getLocalSqlite(): Database.Database {
  if (!localSqlite) {
    const databaseUrl = getLocalDatabaseUrl();
    ensureLocalDatabaseDirectory(databaseUrl);
    localSqlite = new Database(databaseUrl);
  }

  return localSqlite;
}

export function getLocalDb(): BetterSQLite3Database<typeof schema> {
  if (!localDb) {
    localDb = drizzleBetterSQLite(getLocalSqlite(), { schema });
  }

  return localDb;
}

_registerLocalDb(getLocalDb);

export const db = getLocalDb();

export { schema };
