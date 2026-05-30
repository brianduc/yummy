/**
 * Postgres migration helper — run via `pnpm db:migrate`.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db } from './client.js';

const MIGRATIONS_DIR = join(import.meta.dirname, '../../drizzle');

if (!existsSync(MIGRATIONS_DIR)) {
  throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
}

await migrate(db, { migrationsFolder: MIGRATIONS_DIR });

console.log(`Applied Postgres migrations from ${MIGRATIONS_DIR}`);
