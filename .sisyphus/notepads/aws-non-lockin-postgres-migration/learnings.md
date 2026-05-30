# Learnings — AWS Non-Lockin Postgres Migration

## Task 5: Docker Postgres Test Strategy (2026-05-30)

### Current Test Infrastructure (baseline)

- `backend-ts/tests/integration/_setup.ts` hard-codes `process.env.DATABASE_URL = ':memory:'` on line 12.
- Uses `drizzle-orm/better-sqlite3/migrator` — SQLite-specific migrator, incompatible with Postgres DDL.
- DB client: `src/db/client.local.js` (BetterSQLite3Database type).
- `beforeAll`: synchronous `migrate(getLocalDb(), ...)` call.
- `beforeEach`: per-repo `.clear()` / `delete()` calls to reset all tables between tests.
- 9 integration test files; all import `_setup.js` as first import.

### Vitest Constraints (must be preserved forever)

```typescript
pool: 'forks'         // separate process per file
isolate: true         // no module cache leak
fileParallelism: false // serial file execution
testTimeout: 15_000
hookTimeout: 15_000
```

These exist because the in-memory DB (and after migration, the shared Postgres DB) is a process-level singleton. Parallelism would cause TRUNCATE/INSERT races.

### Chosen Test Strategy

**Primary**: Docker Postgres 16-alpine, dedicated test container on host port 5433.

```
DATABASE_URL=postgres://yummy:yummy@localhost:5433/yummy_test
```

**Reset**: `TRUNCATE ... RESTART IDENTITY CASCADE` in `beforeEach` (replaces per-repo `.clear()` calls).

**Migration**: `pnpm db:migrate` (must be updated in T8 to use `drizzle-orm/postgres-js/migrator`).

**CI**: GitHub Actions service container (`postgres:16-alpine`) — faster than Testcontainers.

**pg-mem**: Fallback only. Known gaps: TRUNCATE RESTART IDENTITY, pg-specific JSON operators, Drizzle postgres-js migration DDL.

### `:memory:` Rejection

After Postgres migration:
- `process.env.DATABASE_URL = ':memory:'` line in `_setup.ts` must be removed.
- `DATABASE_URL` is set externally (env var) — never hard-coded in test setup.
- SQLite `:memory:` is only permissible for isolated unit tests of SQLite-specific utilities (none currently in scope).

### _setup.ts Migration Pattern (for T8)

```typescript
// Remove: process.env.DATABASE_URL = ':memory:';
// Remove: import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
// Remove: import { db, getLocalDb } from '../../src/db/client.local.js';

// Add:
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, getMigratorDb } from '../../src/db/client.js';

beforeAll(async () => {
  await migrate(getMigratorDb(), { migrationsFolder: resolve(__dirname, '../../drizzle') });
}, 30_000); // longer timeout: DB container start + migrations
```

### Blocking Tasks

This strategy (T5) blocks:
- **T8**: Updating `_setup.ts` and `db/client.ts` for Postgres
- **T12**: Updating `docker-compose.yml` to add `postgres-test` service (currently references legacy Python `./backend`)
- **T15**: CI pipeline configuration with GitHub Actions service container

### docker-compose.yml Note

Current `docker-compose.yml` references `./backend` context (legacy Python backend) — this is a known caveat. T12 will update it to:
1. Point `backend` service to `./backend-ts` with a new Dockerfile.
2. Add `postgres-test` service (from this strategy document).
3. Optionally add a `postgres-dev` service for local dev DB on port 5432.

## Task 4: Frontend SSR/Runtime Assessment (2026-05-30)

### Verdict: SSR / Node.js Container Required

Static export (`output: 'export'`) is NOT possible due to the `[sessionId]` dynamic route at `frontend/app/workspace/[sessionId]/`. Sessions are created by users at runtime — `generateStaticParams()` cannot enumerate them at build time.

### Key Findings

1. **All pages are `'use client'`** — the entire frontend is an SPA-style app. No server components do data fetching. All API calls go through `frontend/lib/api.ts` using client-side `fetch()`.

2. **Zero server-only features** — no `cookies()`, `headers()`, server actions (`'use server'`), ISR/revalidation, rewrites/redirects, or `next/image` optimization.

3. **`output: 'standalone'`** — already set in `next.config.mjs`. Produces a Node.js server. Dockerfile runs `node server.js`.

4. **`NEXT_PUBLIC_API_URL` is baked at build time** — `NEXT_PUBLIC_*` vars are inlined by the Next.js compiler during `next build`. Container-runtime env injection has NO effect. Must be passed as `--build-arg` to `docker build`. Default is `http://localhost:8000`.

5. **Build pipeline**: `npm run build:next` (Next.js standalone) + `opennextjs-cloudflare build` (Cloudflare packaging). For AWS, only the first phase matters — the standalone output + Dockerfile runner stage is sufficient.

### Route Count
- 1 root page + 13 workspace sub-routes under `[sessionId]/`
- All 13 sub-routes are dynamic and client-only

### Deployment Action Items for AWS
- Pass `NEXT_PUBLIC_API_URL=https://api.yourdomain.com` as Docker build ARG in CI/CD
- Deploy container to App Runner or ECS Fargate — port 3000
- Do NOT set NEXT_PUBLIC_API_URL as a runtime env var (it has no effect)


## Task 6: Drizzle Postgres Schema/Client Conversion (2026-05-30)

- Required `gitnexus_impact` on `createDb` returned MEDIUM risk: 7 direct router callers (`ask`, `config`, `kb`, `metrics`, `sdlc`, `sessions`, `world`) and transitive `app.ts`/entrypoints.
- `sg` CLI was unavailable locally (`command not found`), so the required AST inventories were completed with the available AST search tool: `sqliteTable` matches were removed from `schema.ts`, and `text(..., { mode: 'json' })` matches are now zero.
- Postgres Drizzle query builders do not expose the previous SQLite `.all()`, `.get()`, and `.run()` helpers; repositories were updated to await query builders directly and use `limit(1)` destructuring for single-row reads.
- `world_servers.args` and `world_servers.headers_json` are now native `jsonb` values at the DB boundary. The public API remains unchanged: `args` is an array and `headers_json` is still accepted/returned as a JSON string.
- Active startup and migration paths no longer import `client.local.ts`; `client.local.ts` is retained only as a marked legacy SQLite helper per task requirements.
- `pnpm build` exits 0 after the conversion; evidence saved in `.sisyphus/evidence/task-6-backend-build.txt` and `.sisyphus/evidence/task-6-sqlite-d1-search.txt`.

## Task 7: Fresh Postgres migrations and SQLite data import (2026-05-30)

- `drizzle.config.ts` now writes generated Postgres migrations to `backend-ts/src/db/migrations`, matching the active migrator path.
- Fresh Drizzle output is a single Postgres baseline migration with 10 tables and native `jsonb`, `boolean`, `bigint`, `double precision`, and `timestamp with time zone` columns.
- `pnpm db:migrate` applies cleanly to Docker Postgres 16 on port 5433 after resetting `public` and `drizzle` schemas; evidence is in `.sisyphus/evidence/task-7-pg-migrations.txt`.
- Root `scripts/db/*.ts` intentionally load `better-sqlite3` and `postgres` through `backend-ts/package.json` because the monorepo has no root package manifest.
- Data import dry-run parses SQLite JSON text before import, rejects invalid JSON, converts 0/1 booleans, parses SQLite datetime strings to timestamptz-compatible `Date`, and reports SQLite-only `request_logs.kind` values as an audit/drift artifact instead of importing the dropped column.
- Validation compares row counts and checks Postgres JSON shapes, boolean column types, and timestamptz column types. Invalid JSON proof is in `.sisyphus/evidence/task-7-invalid-json.txt`.

## Task 9: Backend Node Runtime DB Wiring and Health Checks (2026-05-30)

- Node startup now creates and verifies the Postgres Drizzle client from `DATABASE_URL` before serving; missing or invalid DB config exits with a clear startup message instead of relying on Worker bindings.
- `createApp({ db })` lets the Node entrypoint pass the runtime Postgres DB for provider-config hydration while Worker-style `c.env?.DB` remains optional for route compatibility.
- `/health` intentionally skips provider-config hydration and performs a short Postgres `select 1`; healthy response evidence is saved at `.sisyphus/evidence/task-9-health-ok.json`.
- The Postgres pool must be closed in both migration and server shutdown paths; otherwise `pnpm db:migrate` and SIGTERM handling can hang after successful work.
- `/sdlc/start` SSE requires an existing session plus non-empty KB insight data before headers stream; local smoke evidence reached the SSE terminal-event path and is saved at `.sisyphus/evidence/task-9-sse-local.txt`.
- Related Vitest integration tests are still blocked by legacy `_setup.ts` forcing `DATABASE_URL=":memory:"`; full suite migration remains outside this runtime wiring task.

## T8 — Backend Integration Tests Migrated to Postgres (2026-05-30)

### What changed
- `backend-ts/tests/integration/_setup.ts` — replaced SQLite `:memory:` with Postgres. Removed `process.env.DATABASE_URL = ':memory:'`, replaced `drizzle-orm/better-sqlite3/migrator` with `drizzle-orm/postgres-js/migrator`, removed `client.local.ts` imports. Added `beforeAll` async migrate, `beforeEach` TRUNCATE RESTART IDENTITY CASCADE on all tables, `afterAll` closePostgresClient.
- `backend-ts/src/db/client.ts` — added `getMigratorDb()` export: single-connection (max: 1) Drizzle client for migrations. Caller responsible for closing `$client` after use.
- `backend-ts/tests/integration/*.test.ts` (5 files) — replaced `import { db } from 'client.local.js'` with `import { createDb } from 'client.ts'` + `const db = createDb()`.
- `backend-ts/tests/integration/config-sessions.test.ts` — replaced `db.delete(providerConfig).run()` (SQLite sync) with `await db.delete(providerConfig)` (Postgres async).
- `backend-ts/tests/integration/world.test.ts` — changed `args: '["ping"]'` (JSON string) to `args: ['ping']` (string array) to match new `jsonb` schema type.
- `backend-ts/tests/integration/world-mcp-server.test.ts` — added `await` to `resetWorldData()` call (now async).
- `backend-ts/tests/unit/repositories.test.ts` — converted from SQLite to Postgres using same pattern as integration tests.

### Key patterns
- `getMigratorDb()` uses `postgres(url, { max: 1 })` for a single-connection migrator client; close with `await migratorDb.$client.end({ timeout: 5 })` after migration.
- TRUNCATE strategy: `TRUNCATE TABLE sessions, kb_tree, ... RESTART IDENTITY CASCADE` in `beforeEach` — faster than per-repo `clear()` and handles FK dependencies.
- `resetWorldData()` is now `async` — export signature changed from `(): void` to `(): Promise<void>`.
- The `WorldServerInsert.args` field is now `string[]` not JSON string (schema changed from `text` to `jsonb`).
- Migration folder path: `src/db/migrations/` (not the old `drizzle/` folder). Use `resolve(import.meta.dirname, '../../src/db/migrations')` in tests.
- `createDb()` is safe to call at module level in forked test processes because `DATABASE_URL` is available in env before any module evaluates.

### Test results
- 95 tests / 12 files: all pass against `postgres://yummy:yummy@localhost:5433/yummy_test`
- Bad credentials: `PostgresError: password authentication failed` — 9 suites fail, clear error surfaced in `beforeAll` hook
- Vitest config (`pool: 'forks'`, `isolate: true`, `fileParallelism: false`) preserved unchanged
