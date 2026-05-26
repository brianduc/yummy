/**
 * Local SQLite migration helper — run via `pnpm db:migrate`.
 *
 * Cloudflare D1 migrations still use Wrangler:
 *   pnpm db:migrate:local
 *   pnpm db:migrate:remote
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { getLocalDb } from './client.local.js';

const MIGRATIONS_DIR = join(import.meta.dirname, '../../drizzle');

if (!existsSync(MIGRATIONS_DIR)) {
  throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
}

migrate(getLocalDb(), { migrationsFolder: MIGRATIONS_DIR });

console.log(`Applied local SQLite migrations from ${MIGRATIONS_DIR}`);
