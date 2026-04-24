/**
 * Postgres client for the code-intelligence embeddings store.
 * Uses `postgres` (slonik-style, no native deps) wrapped by Drizzle.
 *
 * Requires the `vector` extension (pgvector). The migration in
 * `./migrations/0000_init.sql` enables it; in dev we also try at boot
 * so `db:pg:migrate` doesn't require superuser pre-step.
 */
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { env } from '../../config/env.js';
import * as schema from './schema.js';

const queryClient = postgres(env.POSTGRES_URL, {
  max: 10,
  idle_timeout: 30,
  prepare: false,
});

export const pg: PostgresJsDatabase<typeof schema> = drizzle(queryClient, {
  schema,
});
export const rawPg = queryClient;
export { schema as pgSchema };
