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
