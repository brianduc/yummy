import type { D1Database, D1Result } from '@cloudflare/workers-types';
import type { RunResult } from 'better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { type DrizzleD1Database, drizzle as drizzleD1 } from 'drizzle-orm/d1';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import * as schema from './schema.js';

export type Bindings = {
  DB: D1Database;
};

let _localDbGetter: (() => BetterSQLite3Database<typeof schema>) | undefined;

export function _registerLocalDb(getter: () => BetterSQLite3Database<typeof schema>): void {
  _localDbGetter = getter;
}

export function createDb(d1: D1Database): DrizzleD1Database<typeof schema>;
export function createDb(d1?: undefined): BetterSQLite3Database<typeof schema>;
export function createDb(
  d1?: D1Database,
): DrizzleD1Database<typeof schema> | BetterSQLite3Database<typeof schema> {
  if (d1) {
    return drizzleD1(d1, { schema });
  }

  if (_localDbGetter) {
    return _localDbGetter();
  }

  throw new Error(
    'No local DB registered. Import ./db/client.local.ts before starting the Node server.',
  );
}

export type Db = BaseSQLiteDatabase<'async' | 'sync', D1Result | RunResult, typeof schema>;

export { schema };
