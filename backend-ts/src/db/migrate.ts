/**
 * D1 migration helper — run via `pnpm db:migrate`.
 * Applies SQL migrations from drizzle/ to the D1 database.
 *
 * Usage: npx tsx src/db/migrate.ts
 * Or via wrangler: wrangler d1 migrations apply yummy-db --remote
 *
 * This script runs locally, not inside Cloudflare Workers, so Node.js fs/path
 * imports are intentionally allowed here.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(import.meta.dirname, '../../drizzle');

const files = existsSync(MIGRATIONS_DIR)
  ? readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith('.sql'))
      .sort()
  : [];

console.log(`Found ${files.length} migration(s) in ${MIGRATIONS_DIR}`);
console.log('Run migrations with: npx wrangler d1 migrations apply yummy-db --local');
console.log('Files:');
for (const file of files) {
  console.log(`  - ${file}`);
}
