import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { D1Database, D1Result } from '@cloudflare/workers-types';
import Database, { type RunResult } from 'better-sqlite3';
import {
  type BetterSQLite3Database,
  drizzle as drizzleBetterSQLite,
} from 'drizzle-orm/better-sqlite3';
import { type DrizzleD1Database, drizzle as drizzleD1 } from 'drizzle-orm/d1';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import * as schema from './schema.js';

export type Bindings = {
  DB: D1Database;
};

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

export function createDb(d1: D1Database): DrizzleD1Database<typeof schema>;
export function createDb(d1?: undefined): BetterSQLite3Database<typeof schema>;
export function createDb(
  d1?: D1Database,
): DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema> {
  if (d1) {
    return drizzleD1(d1, { schema });
  }

  return getLocalDb();
}

export type Db = BaseSQLiteDatabase<'async' | 'sync', D1Result | RunResult, typeof schema>;

export const db = createDb();

export { schema };
