/**
 * Postgres migration helper — run via `pnpm db:migrate`.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { closePostgresClient, createDb } from './client.js';

const MIGRATIONS_DIR = join(import.meta.dirname, 'migrations');

if (!existsSync(MIGRATIONS_DIR)) {
  throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
}

try {
  await migrate(createDb(), { migrationsFolder: MIGRATIONS_DIR });
  console.log(`Applied Postgres migrations from ${MIGRATIONS_DIR}`);
} finally {
  await closePostgresClient();
}
