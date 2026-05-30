# Postgres schema mapping and data migration design

Source of truth: `backend-ts/src/db/schema.ts` plus SQLite migration history in `backend-ts/src/db/migrations/*.sql`. This is a design document only; existing SQLite schema and migration files are intentionally unchanged.

## Global conversion rules

| SQLite / D1 pattern | Postgres target | Conversion rule / rationale |
| --- | --- | --- |
| `sqliteTable(...)` from `drizzle-orm/sqlite-core` | `pgTable(...)` from `drizzle-orm/pg-core` | Regenerate Postgres migrations from a Postgres Drizzle schema; do not line-by-line translate historical SQLite SQL. |
| `text(...)` for ordinary strings | `text(...)` | Preserve snake_case DB/API field names and application string semantics. |
| `text(..., { mode: 'json' })` and text columns containing serialized JSON | `jsonb(...)` | Export SQLite text, `JSON.parse` valid strings into objects/arrays, import as jsonb. Invalid JSON must fail the transform before import. |
| `integer(..., { mode: 'boolean' })` and SQL `integer DEFAULT true/false` | `boolean` | Convert `0/1` and `false/true` SQLite values to `false/true`. Use `DEFAULT false` / `DEFAULT true`. |
| `integer` for counts / limits / millisecond epoch IDs | `integer` or `bigint` as noted per column | Keep numeric semantics. Use `bigint` when values are epoch milliseconds or token counters that can exceed 32-bit limits. |
| `real` | `double precision` | Preserve floating-point latency/cost values. |
| `text DEFAULT (datetime('now'))` | `timestamp with time zone DEFAULT now()` | SQLite returns a UTC-ish text timestamp; Postgres should store an actual timestamp. Export text via date parser, import as timestamptz. Application currently also writes ISO strings for these fields, so code should be updated in the implementation phase to pass `Date` or use Drizzle timestamp mode. |
| SQLite backtick identifiers | Postgres quoted identifiers only when needed | Prefer unquoted lowercase snake_case identifiers. |
| `CREATE TABLE IF NOT EXISTS` | Drizzle-generated `CREATE TABLE` migration | Postgres migrations should be deterministic and generated for a fresh database. |
| `INSERT OR IGNORE` singleton seed | `INSERT ... ON CONFLICT DO NOTHING` | Used for singleton `world_config` row initialization. |
| `ALTER TABLE ... ADD` historical migrations | Regenerated Postgres baseline plus forward migrations | Do not replay SQLite syntax. Preserve final current columns plus explicitly handle migration-history drift. |
| `AUTOINCREMENT` | Not present | No schema or migration uses `AUTOINCREMENT`. Existing integer primary keys are app-supplied or singleton IDs; do not introduce generated sequences unless a future schema intentionally changes ownership of ID generation. |

## Table and column mapping

### `sessions`

Primary key: application-supplied text session ID. No sequence/identity.

| Column | SQLite definition | Postgres target | Default | Conversion / notes |
| --- | --- | --- | --- | --- |
| `id` | `text PRIMARY KEY NOT NULL` | `text PRIMARY KEY` | none | Preserve existing IDs. |
| `name` | `text NOT NULL` | `text NOT NULL` | none | Direct copy. |
| `created_at` | `text NOT NULL` | `text NOT NULL` initially, or `timestamptz NOT NULL` if repository code is updated | none | Repository writes `nowIso()`. Safest migration keeps text for API parity; a later code migration may parse ISO strings to timestamptz. |
| `logs` | `text({ mode: 'json' }) NOT NULL DEFAULT '[]'` | `jsonb NOT NULL` | `'[]'::jsonb` | `JSON.parse(logs)`; expected array of `{ role, text }`. |
| `chat_history` | `text({ mode: 'json' }) NOT NULL DEFAULT '[]'` | `jsonb NOT NULL` | `'[]'::jsonb` | `JSON.parse(chat_history)`; repository sorts by optional string `timestamp`. |
| `agent_outputs` | `text({ mode: 'json' }) NOT NULL DEFAULT '{}'` | `jsonb NOT NULL` | `'{}'::jsonb` | `JSON.parse(agent_outputs)`; object keyed by agent. |
| `jira_backlog` | `text({ mode: 'json' }) NOT NULL DEFAULT '[]'` | `jsonb NOT NULL` | `'[]'::jsonb` | `JSON.parse(jira_backlog)`; array. |
| `metrics` | `text({ mode: 'json' }) NOT NULL DEFAULT '{"tokens":0}'` | `jsonb NOT NULL` | `'{"tokens":0}'::jsonb` | `JSON.parse(metrics)`; object currently shaped like `{ tokens: number }`. |
| `workflow_state` | `text NOT NULL DEFAULT 'idle'` | `text NOT NULL` | `'idle'` | Direct copy. |

### `kb_tree`

Primary key: path string. No sequence/identity.

| Column | SQLite definition | Postgres target | Default | Conversion / notes |
| --- | --- | --- | --- | --- |
| `path` | `text PRIMARY KEY NOT NULL` | `text PRIMARY KEY` | none | Direct copy. |
| `name` | `text NOT NULL` | `text NOT NULL` | none | Direct copy. |
| `status` | `text NOT NULL DEFAULT 'pending'` | `text NOT NULL` | `'pending'` | Direct copy. Optional future check constraint: `pending`, `processing`, `done`. |

### `kb_insights`

Primary key: app-supplied integer ID. Repository inserts the full `Insight` row, so do not auto-generate unless repository ownership changes.

| Column | SQLite definition | Postgres target | Default | Conversion / notes |
| --- | --- | --- | --- | --- |
| `id` | `integer PRIMARY KEY NOT NULL` | `bigint PRIMARY KEY` | none | Preserve app-supplied IDs. If IDs are known to stay 32-bit, `integer` is acceptable; `bigint` is safer. |
| `files` | `text({ mode: 'json' }) NOT NULL` | `jsonb NOT NULL` | none | `JSON.parse(files)`; expected `string[]`. |
| `summary` | `text NOT NULL` | `text NOT NULL` | none | Direct copy. |
| `created_at` | `integer NOT NULL` | `bigint NOT NULL` | none | Millisecond epoch used for ordering. Preserve numeric sort semantics. |

### `kb_meta`

Singleton table. Primary key is always `1`; no sequence/identity.

| Column | SQLite definition | Postgres target | Default | Conversion / notes |
| --- | --- | --- | --- | --- |
| `id` | `integer PRIMARY KEY DEFAULT 1 NOT NULL` | `integer PRIMARY KEY` | `1` | Preserve singleton `id = 1`; use `INSERT ... ON CONFLICT (id) DO UPDATE/NOTHING` in seed/upsert logic. |
| `project_summary` | `text NOT NULL DEFAULT ''` | `text NOT NULL` | `''` | Direct copy. |

### `repo_info`

Singleton table. Primary key is always `1`; no sequence/identity.

| Column | SQLite definition | Postgres target | Default | Conversion / notes |
| --- | --- | --- | --- | --- |
| `id` | `integer PRIMARY KEY DEFAULT 1 NOT NULL` | `integer PRIMARY KEY` | `1` | Preserve singleton `id = 1`. |
| `owner` | `text NOT NULL` | `text NOT NULL` | none | Direct copy. |
| `repo` | `text NOT NULL` | `text NOT NULL` | none | Direct copy. |
| `branch` | `text` | `text` | `NULL` | Direct copy, nullable. |
| `url` | `text NOT NULL` | `text NOT NULL` | none | Direct copy. |
| `github_token` | `text NOT NULL DEFAULT ''` | `text NOT NULL` | `''` | Direct copy. Treat as sensitive during export/import. |
| `max_scan_limit` | `integer NOT NULL DEFAULT 10000` | `integer NOT NULL` | `10000` | Direct copy. |

### `world_servers`

Primary key: application-supplied text server ID. No sequence/identity.

| Column | SQLite definition | Postgres target | Default | Conversion / notes |
| --- | --- | --- | --- | --- |
| `id` | `text PRIMARY KEY NOT NULL` | `text PRIMARY KEY` | none | Preserve existing IDs. |
| `name` | `text NOT NULL` | `text NOT NULL` | none | Direct copy. |
| `transport` | `text NOT NULL` | `text NOT NULL` | none | Direct copy. Optional future check: supported MCP transports. |
| `command` | `text` | `text` | `NULL` | Direct copy. |
| `args` | `text` | `jsonb` | `NULL` | Repository serializes an array with `JSON.stringify`; world client parses it as JSON array. Convert non-null strings with `JSON.parse(args)`. |
| `url` | `text` | `text` | `NULL` | Direct copy. |
| `headers_json` | `text` | `jsonb` | `NULL` | World client parses JSON object headers. Convert non-null strings with `JSON.parse(headers_json)`. API field name remains `headers_json`. |
| `enabled` | `integer({ mode: 'boolean' }) NOT NULL DEFAULT true` | `boolean NOT NULL` | `true` | Convert `1/0` to `true/false`. |
| `created_at` | `text NOT NULL DEFAULT (datetime('now'))` | `timestamptz NOT NULL` | `now()` | Parse SQLite text/ISO values to timestamp with time zone. Repository/test seed currently writes ISO strings. |
| `last_status` | `text NOT NULL DEFAULT 'unknown'` | `text NOT NULL` | `'unknown'` | Direct copy. |

### `scan_status`

Singleton table. Primary key is always `1`; no sequence/identity.

| Column | SQLite definition | Postgres target | Default | Conversion / notes |
| --- | --- | --- | --- | --- |
| `id` | `integer PRIMARY KEY DEFAULT 1 NOT NULL` | `integer PRIMARY KEY` | `1` | Preserve singleton `id = 1`. |
| `running` | `integer({ mode: 'boolean' }) NOT NULL DEFAULT false` | `boolean NOT NULL` | `false` | Convert `1/0` to `true/false`. |
| `text` | `text NOT NULL DEFAULT ''` | `text NOT NULL` | `''` | Direct copy. |
| `progress` | `integer NOT NULL DEFAULT 0` | `integer NOT NULL` | `0` | Direct copy. |
| `error` | `integer({ mode: 'boolean' }) NOT NULL DEFAULT false` | `boolean NOT NULL` | `false` | Convert `1/0` to `true/false`. |
| `initialized` | `integer({ mode: 'boolean' }) NOT NULL DEFAULT false` | `boolean NOT NULL` | `false` | Convert `1/0` to `true/false`; repository returns `undefined` when false. |

### `request_logs`

Primary key: app-supplied millisecond epoch ID, sorted descending for newest-first display. No sequence/identity.

| Column | SQLite definition | Postgres target | Default | Conversion / notes |
| --- | --- | --- | --- | --- |
| `id` | `integer PRIMARY KEY NOT NULL` | `bigint PRIMARY KEY` | none | Millisecond epoch from app logic; preserve values and descending sort. |
| `time` | `text NOT NULL` | `text NOT NULL` | none | HH:MM:SS display string; direct copy. |
| `agent` | `text NOT NULL` | `text NOT NULL` | none | Direct copy. |
| `provider` | `text NOT NULL` | `text NOT NULL` | none | Direct copy. |
| `model` | `text NOT NULL` | `text NOT NULL` | none | Direct copy. |
| `in_tokens` | `integer NOT NULL` | `integer NOT NULL` or `bigint NOT NULL` | none | `integer` matches current schema; `bigint` is safer for long-running aggregate logs. |
| `out_tokens` | `integer NOT NULL` | `integer NOT NULL` or `bigint NOT NULL` | none | Same as `in_tokens`. |
| `latency` | `real NOT NULL` | `double precision NOT NULL` | none | Direct numeric copy. |
| `cost` | `real NOT NULL` | `double precision NOT NULL` | none | Direct numeric copy. |

Migration-history drift: `0002_yummy_world.sql` adds `request_logs.kind text DEFAULT 'ai_call' NOT NULL`, but current `schema.ts` does not declare `kind`. Before final Postgres migration, inspect deployed SQLite databases. If `kind` exists and still has data value, choose one of: preserve it in the Postgres schema, export/archive it, or intentionally drop it with a signed data-loss decision.

### `provider_config`

Singleton table. Primary key is always `1`; no sequence/identity.

| Column | SQLite definition | Postgres target | Default | Conversion / notes |
| --- | --- | --- | --- | --- |
| `id` | `integer PRIMARY KEY DEFAULT 1 NOT NULL` | `integer PRIMARY KEY` | `1` | Preserve singleton `id = 1`. |
| `provider` | `text NOT NULL DEFAULT 'gemini'` | `text NOT NULL` | `'gemini'` | Direct copy. |
| `gemini_key` | `text NOT NULL DEFAULT ''` | `text NOT NULL` | `''` | Direct copy; sensitive. |
| `gemini_model` | `text NOT NULL DEFAULT ''` | `text NOT NULL` | `''` | Direct copy. |
| `ollama_base_url` | `text NOT NULL DEFAULT ''` | `text NOT NULL` | `''` | Direct copy. |
| `ollama_model` | `text NOT NULL DEFAULT ''` | `text NOT NULL` | `''` | Direct copy. |
| `copilot_token` | `text NOT NULL DEFAULT ''` | `text NOT NULL` | `''` | Direct copy; sensitive. |
| `copilot_model` | `text NOT NULL DEFAULT ''` | `text NOT NULL` | `''` | Direct copy. |
| `openai_key` | `text NOT NULL DEFAULT ''` | `text NOT NULL` | `''` | Direct copy; sensitive. |
| `openai_model` | `text NOT NULL DEFAULT ''` | `text NOT NULL` | `''` | Direct copy. |
| `openai_base_url` | `text NOT NULL DEFAULT ''` | `text NOT NULL` | `''` | Added by `0003_openai_base_url.sql`; direct copy. |
| `bedrock_access_key` | `text NOT NULL DEFAULT ''` | `text NOT NULL` | `''` | Direct copy; sensitive. |
| `bedrock_secret_key` | `text NOT NULL DEFAULT ''` | `text NOT NULL` | `''` | Direct copy; sensitive. |
| `bedrock_region` | `text NOT NULL DEFAULT ''` | `text NOT NULL` | `''` | Direct copy. |
| `bedrock_model` | `text NOT NULL DEFAULT ''` | `text NOT NULL` | `''` | Direct copy. |

### `world_config`

Singleton table. Primary key is always `1`; no sequence/identity.

| Column | SQLite definition | Postgres target | Default | Conversion / notes |
| --- | --- | --- | --- | --- |
| `id` | `integer PRIMARY KEY DEFAULT 1 NOT NULL` | `integer PRIMARY KEY` | `1` | Preserve singleton `id = 1`; seed with `ON CONFLICT DO NOTHING`. |
| `mcp_server_token` | `text NOT NULL DEFAULT ''` | `text NOT NULL` | `''` | Direct copy; sensitive. |
| `mcp_server_enabled` | `integer({ mode: 'boolean' }) NOT NULL DEFAULT false` | `boolean NOT NULL` | `false` | Convert `1/0` to `true/false`. |
| `mcp_server_port` | `text NOT NULL DEFAULT ''` | `text NOT NULL` | `''` | Direct copy. |
| `updated_at` | `text NOT NULL DEFAULT (datetime('now'))` | `timestamptz NOT NULL` | `now()` | Parse SQLite text/ISO values to timestamp with time zone. Repository currently writes ISO strings. |

## JSON-as-text inventory

Use `jsonb` for these columns and validate every exported value with `JSON.parse` before import:

- `sessions.logs` → default `'[]'::jsonb`
- `sessions.chat_history` → default `'[]'::jsonb`
- `sessions.agent_outputs` → default `'{}'::jsonb`
- `sessions.jira_backlog` → default `'[]'::jsonb`
- `sessions.metrics` → default `'{"tokens":0}'::jsonb`
- `kb_insights.files` → no default; required array
- `world_servers.args` → nullable jsonb array, currently serialized manually by `world.router.ts`
- `world_servers.headers_json` → nullable jsonb object/string-compatible payload, currently parsed by `services/world/client.ts`

## Integer boolean inventory

Convert with `value === 1 || value === true` and reject unexpected non-null values:

- `world_servers.enabled`: default `true`
- `scan_status.running`: default `false`
- `scan_status.error`: default `false`
- `scan_status.initialized`: default `false`
- `world_config.mcp_server_enabled`: default `false`

## Timestamp/default inventory

- `world_servers.created_at`: `text DEFAULT (datetime('now'))` → `timestamptz DEFAULT now()`; transform existing text with a strict date parser.
- `world_config.updated_at`: `text DEFAULT (datetime('now'))` → `timestamptz DEFAULT now()`; transform existing text with a strict date parser.
- `sessions.created_at`: text ISO generated by app, not a SQLite `datetime('now')` default. Keep text unless implementation phase updates app types.
- `kb_insights.created_at` and `request_logs.id`: integer millisecond epoch values, not SQL timestamps.

## Primary key semantics

- No current schema or migration uses `AUTOINCREMENT`.
- Text primary keys (`sessions.id`, `kb_tree.path`, `world_servers.id`) are app-supplied and must remain app-supplied.
- Singleton integer primary keys (`kb_meta.id`, `repo_info.id`, `scan_status.id`, `provider_config.id`, `world_config.id`) are always `1`; use defaults and upsert/seed semantics, not generated identity.
- App-supplied integer primary keys (`kb_insights.id`, `request_logs.id`) should be `bigint PRIMARY KEY` when preserving millisecond-ish or externally generated numeric IDs. Do not add `SERIAL` / `GENERATED AS IDENTITY` unless repository code changes to omit IDs.

## SQLite-only SQL and Postgres replacements

| SQLite source | Postgres replacement |
| --- | --- |
| Backtick identifiers in migration SQL | Drizzle-generated lowercase identifiers; quote only if necessary. |
| `CREATE TABLE IF NOT EXISTS` in `0002_yummy_world.sql` | Generated baseline migration with ordinary `CREATE TABLE`; deployment migration runner handles idempotence. |
| `INSERT OR IGNORE INTO world_config (id) VALUES (1)` | `INSERT INTO world_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING`. |
| `datetime('now')` | `now()` for Postgres `timestamptz` defaults. |
| `integer DEFAULT false/true` booleans | `boolean DEFAULT false/true`. |
| SQLite `real` | Postgres `double precision`. |
| SQLite JSON stored in `text` | Postgres `jsonb` with parsed JSON import. |
| Historical `ALTER TABLE ... ADD` | Regenerated Postgres migrations; include final columns only after resolving drift such as `request_logs.kind`. |

## Data migration design

1. **Prepare**
   - Freeze writes to the SQLite/D1 database.
   - Take an RDS/Postgres snapshot target baseline and a copy of the source SQLite file/D1 export.
   - Generate a fresh Postgres Drizzle schema/migration instead of replaying SQLite migrations.
   - Create the Postgres schema in an empty database and seed singleton defaults with `ON CONFLICT DO NOTHING` where needed.

2. **Export**
   - Export each SQLite table to newline-delimited JSON or CSV with exact column names.
   - Also inspect `PRAGMA table_info(request_logs)` to detect the historical `kind` column.
   - Store checksums and row counts per table before transformation.

3. **Transform**
   - Parse JSON text columns into native objects/arrays for jsonb columns.
   - Convert integer booleans from `0/1` to `false/true`; reject any other values.
   - Parse `world_servers.created_at` and `world_config.updated_at` into ISO timestamps for `timestamptz`.
   - Preserve app-supplied primary keys exactly.
   - Preserve sensitive config values only in encrypted migration artifacts with restricted access.

4. **Import**
   - Load parent-independent tables in any order because no foreign keys are currently declared.
   - Use explicit column lists and `ON CONFLICT` only for singleton seed rows.
   - Import jsonb values with parameterized queries or `COPY` from valid JSON, not stringified JSON inside text columns.

5. **Validate**
   - Compare row counts for every table.
   - Validate primary-key set equality for every table.
   - Validate JSON columns round-trip by comparing normalized JSON (`jsonb` canonical form vs parsed source).
   - Validate boolean counts for true/false/null where applicable.
   - Validate newest-first request log ordering by `id DESC`.
   - Run backend repository/integration tests against Postgres once implementation changes exist.

6. **Rollback**
   - Keep the source SQLite/D1 database read-only and intact until validation and application cutover pass.
   - If import or validation fails before cutover, drop/recreate the Postgres target from the pre-migration RDS snapshot and rerun transform/import.
   - If cutover fails after traffic moves, stop writes, restore the RDS snapshot or return application config to SQLite/D1 using the frozen source, then replay only audited writes captured during the failed window.
