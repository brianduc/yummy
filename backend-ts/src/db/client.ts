import { type PostgresJsDatabase, drizzle } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';
import * as schema from './schema.js';

export type Bindings = {
  DB?: unknown;
};

export type Db = PostgresJsDatabase<typeof schema> & { $client: Sql };

let pgClient: Sql | undefined;
let pgDb: Db | undefined;

function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for the Postgres database connection.');
  }

  return databaseUrl;
}

export function getPostgresClient(): Sql {
  if (!pgClient) {
    pgClient = postgres(getDatabaseUrl(), { max: 10 });
  }

  return pgClient;
}

export function createDb(_legacyDb?: unknown): Db {
  if (!pgDb) {
    pgDb = drizzle(getPostgresClient(), { schema });
  }

  return pgDb;
}

export const db = createDb();

export { schema };
