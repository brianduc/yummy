#!/usr/bin/env tsx
/// <reference types="../../backend-ts/node_modules/@types/node" />
/**
 * Validate a SQLite/D1 to Postgres migration.
 *
 * Checks:
 * - row counts per table match between SQLite and Postgres
 * - SQLite JSON text columns parse successfully and Postgres columns are jsonb objects/arrays as expected
 * - boolean target columns are real Postgres booleans, not integer compatibility leftovers
 * - timestamptz columns are materialized as Postgres timestamp with time zone values
 *
 * Rollback: if any check fails, keep traffic on the frozen SQLite source, restore the Postgres target from
 * the `pg_dump --format=custom` or RDS snapshot captured before import, fix the transform, and rerun import.
 */
import { createRequire } from 'node:module';

type SqlFragment = object;
type SqliteStatement = {
  get: (...params: unknown[]) => unknown;
  all: (...params: unknown[]) => unknown[];
};
type SqliteDatabase = {
  prepare: (sql: string) => SqliteStatement;
  close: () => void;
};
type DatabaseConstructor = new (
  path: string,
  options?: { readonly?: boolean; fileMustExist?: boolean },
) => SqliteDatabase;
type PostgresSql = {
  <T extends unknown[] = unknown[]>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  (identifier: string): SqlFragment;
  end: () => Promise<void>;
};
type PostgresFactory = (url: string, options?: { max?: number }) => PostgresSql;

const requireFromBackend = createRequire(new URL('../../backend-ts/package.json', import.meta.url));
const Database = requireFromBackend('better-sqlite3') as DatabaseConstructor;
const postgres = requireFromBackend('postgres') as PostgresFactory;

type JsonColumnCheck = {
  table: string;
  column: string;
  expected?: 'array' | 'object';
  nullable?: boolean;
};

type BooleanColumnCheck = {
  table: string;
  column: string;
};

type TimestampColumnCheck = {
  table: string;
  column: string;
};

type Args = {
  sqlitePath?: string;
  databaseUrl?: string;
};

const tables = [
  'sessions',
  'kb_tree',
  'kb_insights',
  'kb_meta',
  'repo_info',
  'world_servers',
  'scan_status',
  'request_logs',
  'provider_config',
  'world_config',
] as const;

const jsonColumns: JsonColumnCheck[] = [
  { table: 'sessions', column: 'logs', expected: 'array' },
  { table: 'sessions', column: 'chat_history', expected: 'array' },
  { table: 'sessions', column: 'agent_outputs', expected: 'object' },
  { table: 'sessions', column: 'jira_backlog', expected: 'array' },
  { table: 'sessions', column: 'metrics', expected: 'object' },
  { table: 'kb_insights', column: 'files', expected: 'array' },
  { table: 'world_servers', column: 'args', expected: 'array', nullable: true },
  { table: 'world_servers', column: 'headers_json', expected: 'object', nullable: true },
];

const booleanColumns: BooleanColumnCheck[] = [
  { table: 'world_servers', column: 'enabled' },
  { table: 'scan_status', column: 'running' },
  { table: 'scan_status', column: 'error' },
  { table: 'scan_status', column: 'initialized' },
  { table: 'world_config', column: 'mcp_server_enabled' },
];

const timestampColumns: TimestampColumnCheck[] = [
  { table: 'world_servers', column: 'created_at' },
  { table: 'world_config', column: 'updated_at' },
];

function parseArgs(argv: string[]): Args {
  const args: Args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === '--sqlite') {
      args.sqlitePath = requireValue(arg, next);
      index += 1;
    } else if (arg === '--database-url') {
      args.databaseUrl = requireValue(arg, next);
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  args.sqlitePath ??= process.env.SQLITE_DATABASE_PATH;
  args.databaseUrl ??= process.env.DATABASE_URL;

  return args;
}

function requireValue(flag: string, value: string | undefined): string {
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value.`);
  }

  return value;
}

function printUsage(): void {
  console.log(`Usage: tsx scripts/db/validate-migration.ts --sqlite <path> --database-url <url>

Environment fallbacks:
  SQLITE_DATABASE_PATH
  DATABASE_URL
`);
}

function tableExists(sqlite: SqliteDatabase, table: string): boolean {
  const row = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table);

  return Boolean(row);
}

function sqliteCount(sqlite: SqliteDatabase, table: string): number {
  if (!tableExists(sqlite, table)) {
    return 0;
  }

  const row = sqlite.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number };
  return row.count;
}

function validateSqliteJson(sqlite: SqliteDatabase, check: JsonColumnCheck): void {
  if (!tableExists(sqlite, check.table)) {
    return;
  }

  const rows = sqlite
    .prepare(`SELECT rowid AS rowid, ${check.column} AS value FROM ${check.table}`)
    .all() as Array<{ rowid: number; value: string | null }>;

  for (const row of rows) {
    if (row.value === null && check.nullable) {
      continue;
    }

    if (typeof row.value !== 'string') {
      throw new Error(`${check.table}.${check.column} row ${row.rowid} is not JSON text.`);
    }

    const parsed = JSON.parse(row.value) as unknown;
    assertJsonShape(parsed, check, `SQLite ${check.table}.${check.column} row ${row.rowid}`);
  }
}

function assertJsonShape(value: unknown, check: JsonColumnCheck, label: string): void {
  if (value === null && check.nullable) {
    return;
  }

  if (check.expected === 'array' && !Array.isArray(value)) {
    throw new Error(`${label} expected array JSON.`);
  }

  if (
    check.expected === 'object' &&
    (typeof value !== 'object' || value === null || Array.isArray(value))
  ) {
    throw new Error(`${label} expected object JSON.`);
  }
}

async function validateRowCounts(
  sqlite: SqliteDatabase,
  sql: PostgresSql,
): Promise<void> {
  for (const table of tables) {
    const sourceCount = sqliteCount(sqlite, table);
    const [target] = await sql<{ count: string }[]>`select count(*)::text as count from ${sql(table)}`;

    if (!target) {
      throw new Error(`No Postgres count returned for ${table}.`);
    }

    const targetCount = Number(target.count);
    console.log(`${table}: SQLite=${sourceCount} Postgres=${targetCount}`);

    if (sourceCount !== targetCount) {
      throw new Error(`${table} row count mismatch: SQLite=${sourceCount}, Postgres=${targetCount}`);
    }
  }
}

async function validatePostgresJson(sql: PostgresSql): Promise<void> {
  for (const check of jsonColumns) {
    const [badType] = await sql<{ count: string }[]>`
      select count(*)::text as count
      from ${sql(check.table)}
      where ${sql(check.column)} is not null
        and jsonb_typeof(${sql(check.column)}) <> ${check.expected ?? 'object'}
    `;

    if (badType && Number(badType.count) > 0) {
      throw new Error(`${check.table}.${check.column} has ${badType.count} invalid JSON shape row(s).`);
    }

    if (!check.nullable) {
      const [nulls] = await sql<{ count: string }[]>`
        select count(*)::text as count
        from ${sql(check.table)}
        where ${sql(check.column)} is null
      `;

      if (nulls && Number(nulls.count) > 0) {
        throw new Error(`${check.table}.${check.column} has ${nulls.count} unexpected null row(s).`);
      }
    }
  }
}

async function validatePostgresBooleans(sql: PostgresSql): Promise<void> {
  for (const check of booleanColumns) {
    const [metadata] = await sql<{ data_type: string }[]>`
      select data_type
      from information_schema.columns
      where table_schema = 'public'
        and table_name = ${check.table}
        and column_name = ${check.column}
    `;

    if (!metadata) {
      throw new Error(`${check.table}.${check.column} is missing in Postgres.`);
    }

    if (metadata.data_type !== 'boolean') {
      throw new Error(`${check.table}.${check.column} expected boolean, got ${metadata.data_type}.`);
    }
  }
}

async function validatePostgresTimestamps(sql: PostgresSql): Promise<void> {
  for (const check of timestampColumns) {
    const [metadata] = await sql<{ data_type: string }[]>`
      select data_type
      from information_schema.columns
      where table_schema = 'public'
        and table_name = ${check.table}
        and column_name = ${check.column}
    `;

    if (!metadata) {
      throw new Error(`${check.table}.${check.column} is missing in Postgres.`);
    }

    if (metadata.data_type !== 'timestamp with time zone') {
      throw new Error(`${check.table}.${check.column} expected timestamptz, got ${metadata.data_type}.`);
    }

    const [nulls] = await sql<{ count: string }[]>`
      select count(*)::text as count
      from ${sql(check.table)}
      where ${sql(check.column)} is null
    `;

    if (nulls && Number(nulls.count) > 0) {
      throw new Error(`${check.table}.${check.column} has ${nulls.count} null timestamp row(s).`);
    }
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!args.sqlitePath) {
    throw new Error('Provide --sqlite <path> or SQLITE_DATABASE_PATH.');
  }

  if (!args.databaseUrl) {
    throw new Error('Provide --database-url <url> or DATABASE_URL.');
  }

  const sqlite = new Database(args.sqlitePath, { readonly: true, fileMustExist: true });
  const sql = postgres(args.databaseUrl, { max: 1 });

  try {
    for (const check of jsonColumns) {
      validateSqliteJson(sqlite, check);
    }

    await validateRowCounts(sqlite, sql);
    await validatePostgresJson(sql);
    await validatePostgresBooleans(sql);
    await validatePostgresTimestamps(sql);
    console.log('Migration validation passed.');
  } finally {
    sqlite.close();
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
