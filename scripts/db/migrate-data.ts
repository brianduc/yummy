#!/usr/bin/env tsx
/// <reference types="../../backend-ts/node_modules/@types/node" />
/**
 * One-shot SQLite/D1 export to Postgres import helper.
 *
 * Rollback guidance:
 * 1. Before importing, freeze writes and snapshot both sides:
 *    - SQLite/D1: copy/export the source database file or D1 export artifact.
 *    - Postgres/RDS: `pg_dump --format=custom --file=pre-yummy-import.dump "$DATABASE_URL"`.
 * 2. If import/validation fails before cutover, restore the target with:
 *    `dropdb <target> && createdb <target> && pg_restore --clean --if-exists --dbname="$DATABASE_URL" pre-yummy-import.dump`.
 * 3. If cutover fails after traffic moves, stop writes, restore the RDS snapshot or dump, switch app config
 *    back to the frozen SQLite/D1 source, and replay only audited writes captured during the failed window.
 *
 * Migration drift decision:
 * Historical SQLite migration `0002_yummy_world.sql` may add `request_logs.kind`, but the current pg-core
 * schema intentionally does not include that column. This script does not import it into Postgres. If found,
 * it reports a value summary and, when `--drift-report <file>` is provided, writes the preserved values to
 * a restricted JSON artifact for audit/backfill before the column is intentionally dropped from the live DB.
 */
import { Buffer } from 'node:buffer';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type SqliteValue = null | string | number | bigint | boolean | Buffer;
type SqliteRow = Record<string, SqliteValue>;
type PgRow = Record<string, JsonValue | Date>;
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
  (rows: readonly PgRow[], ...columns: string[]): SqlFragment;
  begin: <T>(fn: (transaction: PostgresSql) => Promise<T>) => Promise<T>;
  end: () => Promise<void>;
};
type PostgresFactory = (url: string, options?: { max?: number }) => PostgresSql;

const requireFromBackend = createRequire(new URL('../../backend-ts/package.json', import.meta.url));
const Database = requireFromBackend('better-sqlite3') as DatabaseConstructor;
const postgres = requireFromBackend('postgres') as PostgresFactory;

type ColumnTransform = {
  name: string;
  nullable?: boolean;
  defaultValue?: JsonValue;
  transform?: (value: SqliteValue, context: TransformContext) => JsonValue | Date;
};

type TableTransform = {
  name: string;
  columns: ColumnTransform[];
};

type TransformContext = {
  table: string;
  column: string;
  row: SqliteRow;
};

type Args = {
  sqlitePath?: string;
  databaseUrl?: string;
  dryRun: boolean;
  driftReport?: string;
};

const tableTransforms: TableTransform[] = [
  {
    name: 'sessions',
    columns: [
      { name: 'id' },
      { name: 'name' },
      { name: 'created_at' },
      { name: 'logs', defaultValue: [], transform: parseJsonColumn },
      { name: 'chat_history', defaultValue: [], transform: parseJsonColumn },
      { name: 'agent_outputs', defaultValue: {}, transform: parseJsonColumn },
      { name: 'jira_backlog', defaultValue: [], transform: parseJsonColumn },
      { name: 'metrics', defaultValue: { tokens: 0 }, transform: parseJsonColumn },
      { name: 'workflow_state', defaultValue: 'idle' },
    ],
  },
  {
    name: 'kb_tree',
    columns: [
      { name: 'path' },
      { name: 'name' },
      { name: 'status', defaultValue: 'pending' },
    ],
  },
  {
    name: 'kb_insights',
    columns: [
      { name: 'id', transform: parseIntegerColumn },
      { name: 'files', transform: parseJsonColumn },
      { name: 'summary' },
      { name: 'created_at', transform: parseIntegerColumn },
    ],
  },
  {
    name: 'kb_meta',
    columns: [
      { name: 'id', defaultValue: 1, transform: parseIntegerColumn },
      { name: 'project_summary', defaultValue: '' },
    ],
  },
  {
    name: 'repo_info',
    columns: [
      { name: 'id', defaultValue: 1, transform: parseIntegerColumn },
      { name: 'owner' },
      { name: 'repo' },
      { name: 'branch', nullable: true },
      { name: 'url' },
      { name: 'github_token', defaultValue: '' },
      { name: 'max_scan_limit', defaultValue: 10000, transform: parseIntegerColumn },
    ],
  },
  {
    name: 'world_servers',
    columns: [
      { name: 'id' },
      { name: 'name' },
      { name: 'transport' },
      { name: 'command', nullable: true },
      { name: 'args', nullable: true, transform: parseNullableJsonColumn },
      { name: 'url', nullable: true },
      { name: 'headers_json', nullable: true, transform: parseNullableJsonColumn },
      { name: 'enabled', defaultValue: true, transform: parseBooleanColumn },
      { name: 'created_at', transform: parseTimestampColumn },
      { name: 'last_status', defaultValue: 'unknown' },
    ],
  },
  {
    name: 'scan_status',
    columns: [
      { name: 'id', defaultValue: 1, transform: parseIntegerColumn },
      { name: 'running', defaultValue: false, transform: parseBooleanColumn },
      { name: 'text', defaultValue: '' },
      { name: 'progress', defaultValue: 0, transform: parseIntegerColumn },
      { name: 'error', defaultValue: false, transform: parseBooleanColumn },
      { name: 'initialized', defaultValue: false, transform: parseBooleanColumn },
    ],
  },
  {
    name: 'request_logs',
    columns: [
      { name: 'id', transform: parseIntegerColumn },
      { name: 'time' },
      { name: 'agent' },
      { name: 'provider' },
      { name: 'model' },
      { name: 'in_tokens', transform: parseIntegerColumn },
      { name: 'out_tokens', transform: parseIntegerColumn },
      { name: 'latency', transform: parseNumberColumn },
      { name: 'cost', transform: parseNumberColumn },
    ],
  },
  {
    name: 'provider_config',
    columns: [
      { name: 'id', defaultValue: 1, transform: parseIntegerColumn },
      { name: 'provider', defaultValue: 'gemini' },
      { name: 'gemini_key', defaultValue: '' },
      { name: 'gemini_model', defaultValue: '' },
      { name: 'ollama_base_url', defaultValue: '' },
      { name: 'ollama_model', defaultValue: '' },
      { name: 'copilot_token', defaultValue: '' },
      { name: 'copilot_model', defaultValue: '' },
      { name: 'openai_key', defaultValue: '' },
      { name: 'openai_model', defaultValue: '' },
      { name: 'openai_base_url', defaultValue: '' },
      { name: 'bedrock_access_key', defaultValue: '' },
      { name: 'bedrock_secret_key', defaultValue: '' },
      { name: 'bedrock_region', defaultValue: '' },
      { name: 'bedrock_model', defaultValue: '' },
    ],
  },
  {
    name: 'world_config',
    columns: [
      { name: 'id', defaultValue: 1, transform: parseIntegerColumn },
      { name: 'mcp_server_token', defaultValue: '' },
      { name: 'mcp_server_enabled', defaultValue: false, transform: parseBooleanColumn },
      { name: 'mcp_server_port', defaultValue: '' },
      { name: 'updated_at', transform: parseTimestampColumn },
    ],
  },
];

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: true };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === '--sqlite') {
      args.sqlitePath = requireValue(arg, next);
      index += 1;
    } else if (arg === '--database-url') {
      args.databaseUrl = requireValue(arg, next);
      index += 1;
    } else if (arg === '--execute') {
      args.dryRun = false;
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--drift-report') {
      args.driftReport = requireValue(arg, next);
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
  console.log(`Usage: tsx scripts/db/migrate-data.ts --sqlite <path> [--database-url <url>] [--dry-run|--execute] [--drift-report <file>]

Defaults:
  --dry-run              Transform and validate source rows without writing to Postgres.
  SQLITE_DATABASE_PATH   Fallback for --sqlite.
  DATABASE_URL           Fallback for --database-url.
`);
}

function parseJsonColumn(value: SqliteValue, context: TransformContext): JsonValue {
  const textValue = requireText(value, context);

  try {
    return JSON.parse(textValue) as JsonValue;
  } catch (error) {
    throw new Error(`${context.table}.${context.column} contains invalid JSON: ${(error as Error).message}`);
  }
}

function parseNullableJsonColumn(value: SqliteValue, context: TransformContext): JsonValue {
  if (value === null) {
    return null;
  }

  return parseJsonColumn(value, context);
}

function parseBooleanColumn(value: SqliteValue, context: TransformContext): boolean {
  if (value === true || value === 1 || value === '1') {
    return true;
  }

  if (value === false || value === 0 || value === '0') {
    return false;
  }

  throw new Error(`${context.table}.${context.column} expected SQLite boolean 0/1, got ${String(value)}`);
}

function parseIntegerColumn(value: SqliteValue, context: TransformContext): number {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === 'bigint') {
    const numberValue = Number(value);
    if (Number.isSafeInteger(numberValue)) {
      return numberValue;
    }
  }

  if (typeof value === 'string' && /^-?\d+$/.test(value)) {
    const numberValue = Number(value);
    if (Number.isSafeInteger(numberValue)) {
      return numberValue;
    }
  }

  throw new Error(`${context.table}.${context.column} expected integer, got ${String(value)}`);
}

function parseNumberColumn(value: SqliteValue, context: TransformContext): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const numberValue = Number(value);
    if (Number.isFinite(numberValue)) {
      return numberValue;
    }
  }

  throw new Error(`${context.table}.${context.column} expected number, got ${String(value)}`);
}

function parseTimestampColumn(value: SqliteValue, context: TransformContext): Date {
  const textValue = requireText(value, context);
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(textValue)
    ? `${textValue.replace(' ', 'T')}Z`
    : textValue;
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${context.table}.${context.column} expected parseable timestamp, got ${textValue}`);
  }

  return date;
}

function requireText(value: SqliteValue, context: TransformContext): string {
  if (typeof value !== 'string') {
    throw new Error(`${context.table}.${context.column} expected text, got ${String(value)}`);
  }

  return value;
}

function tableExists(sqlite: SqliteDatabase, table: string): boolean {
  const row = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table);

  return Boolean(row);
}

function getTableColumns(sqlite: SqliteDatabase, table: string): Set<string> {
  const rows = sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return new Set(rows.map((row) => row.name));
}

function applyDefault(value: SqliteValue | undefined, column: ColumnTransform): SqliteValue {
  if (value !== undefined && value !== null) {
    return value;
  }

  if (value === null && column.nullable) {
    return null;
  }

  if (column.defaultValue !== undefined) {
    return serializeDefault(column.defaultValue);
  }

  if (column.nullable) {
    return null;
  }

  throw new Error(`${column.name} is required and no SQLite value/default exists.`);
}

function serializeDefault(value: JsonValue): SqliteValue {
  if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
    return JSON.stringify(value);
  }

  return value;
}

function transformRow(table: TableTransform, row: SqliteRow): PgRow {
  const pgRow: PgRow = {};

  for (const column of table.columns) {
    const rawValue = applyDefault(row[column.name], column);
    const context = { table: table.name, column: column.name, row };
    pgRow[column.name] = column.transform ? column.transform(rawValue, context) : normalizeScalar(rawValue, context);
  }

  return pgRow;
}

function normalizeScalar(value: SqliteValue, context: TransformContext): JsonValue {
  if (Buffer.isBuffer(value)) {
    throw new Error(`${context.table}.${context.column} cannot migrate Buffer values.`);
  }

  if (typeof value === 'bigint') {
    const numberValue = Number(value);
    if (!Number.isSafeInteger(numberValue)) {
      throw new Error(`${context.table}.${context.column} bigint is outside safe integer range.`);
    }

    return numberValue;
  }

  return value;
}

function readRows(sqlite: SqliteDatabase, table: TableTransform): PgRow[] {
  if (!tableExists(sqlite, table.name)) {
    console.warn(`Skipping missing SQLite table ${table.name}; treating as 0 rows.`);
    return [];
  }

  const rows = sqlite.prepare(`SELECT * FROM ${table.name}`).all() as SqliteRow[];
  return rows.map((row) => transformRow(table, row));
}

async function importRows(sql: PostgresSql, table: TableTransform, rows: PgRow[]): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const columnNames = table.columns.map((column) => column.name);
  await sql`insert into ${sql(table.name)} ${sql(rows, ...columnNames)}`;
}

function summarizeRequestLogKind(sqlite: SqliteDatabase): Array<Record<string, JsonValue>> {
  if (!tableExists(sqlite, 'request_logs')) {
    return [];
  }

  const columns = getTableColumns(sqlite, 'request_logs');
  if (!columns.has('kind')) {
    return [];
  }

  return sqlite
    .prepare('SELECT kind, COUNT(*) AS count FROM request_logs GROUP BY kind ORDER BY count DESC')
    .all() as Array<Record<string, JsonValue>>;
}

async function writeDriftReport(path: string, sqlite: SqliteDatabase): Promise<void> {
  if (!tableExists(sqlite, 'request_logs') || !getTableColumns(sqlite, 'request_logs').has('kind')) {
    return;
  }

  const rows = sqlite.prepare('SELECT id, kind FROM request_logs ORDER BY id').all();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify({ request_logs_kind: rows }, null, 2)}\n`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!args.sqlitePath) {
    throw new Error('Provide --sqlite <path> or SQLITE_DATABASE_PATH.');
  }

  if (!args.dryRun && !args.databaseUrl) {
    throw new Error('Provide --database-url <url> or DATABASE_URL when using --execute.');
  }

  const sqlite = new Database(args.sqlitePath, { readonly: true, fileMustExist: true });
  const transformed = new Map<string, PgRow[]>();

  try {
    for (const table of tableTransforms) {
      const rows = readRows(sqlite, table);
      transformed.set(table.name, rows);
      console.log(`${table.name}: transformed ${rows.length} row(s)`);
    }

    const driftSummary = summarizeRequestLogKind(sqlite);
    if (driftSummary.length > 0) {
      console.warn('Detected SQLite-only request_logs.kind values; not imported into current Postgres schema.');
      console.warn(JSON.stringify(driftSummary, null, 2));
    }

    if (args.driftReport) {
      await writeDriftReport(args.driftReport, sqlite);
    }

    if (args.dryRun) {
      console.log('Dry-run complete. No Postgres rows were written. Re-run with --execute after snapshotting.');
      return;
    }

    const sql = postgres(args.databaseUrl as string, { max: 1 });
    try {
      await sql.begin(async (transaction) => {
        for (const table of tableTransforms) {
          await importRows(transaction, table, transformed.get(table.name) ?? []);
        }
      });
    } finally {
      await sql.end();
    }

    console.log('Import complete. Run scripts/db/validate-migration.ts before cutover.');
  } finally {
    sqlite.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
