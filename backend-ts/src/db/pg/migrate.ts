/**
 * Apply Postgres migrations from src/db/pg/migrations.
 * Run via `pnpm db:pg:migrate`.
 *
 * Also ensures the `vector` extension is enabled — must run before any
 * migration that creates a vector column.
 */

import { resolve } from 'node:path';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

import { pg, rawPg } from './client.js';

const migrationsFolder = resolve(import.meta.dirname, 'migrations');

async function main() {
  console.log('[migrate:pg] Ensuring pgvector extension is enabled...');
  await pg.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);

  console.log(`[migrate:pg] Applying migrations from ${migrationsFolder}`);
  await migrate(pg, { migrationsFolder });
  console.log('[migrate:pg] ✅ Done');
}

main()
  .catch((err) => {
    console.error('[migrate:pg] ❌ Failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await rawPg.end({ timeout: 5 });
  });
