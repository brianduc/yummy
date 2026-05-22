/**
 * D1 client — Cloudflare Workers compatible.
 * Replaces the old better-sqlite3 client.
 *
 * Usage in Workers handler:
 *   const db = createDb(c.env.DB);
 *
 * For tests that need a shared instance, call createDb() once and hold the reference.
 */

import type { D1Database } from '@cloudflare/workers-types';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema.js';

export type Bindings = {
  DB: D1Database;
};

export function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type Db = ReturnType<typeof createDb>;

export { schema };
