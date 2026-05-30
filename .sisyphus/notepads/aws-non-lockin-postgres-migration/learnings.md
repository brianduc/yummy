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

## Frontend Standard Next.js Container Build (Task 10)
- Replaced `opennext-cloudflare` with standard Next.js standalone output and Docker build.
- Confirmed Next.js `output: 'standalone'` correctly produces a self-contained Node server.
- The dynamic routing (`[sessionId]`) strictly requires this SSR/Node.js runtime, making static export impossible.
- Removed Cloudflare workers config from Next and deployed as a standard Next.js Docker container using `node:20-slim`.
- API base URL behavior (`NEXT_PUBLIC_API_URL`) requires baked-in build args; implemented this in Dockerfile.

## T11: Cloudflare Tooling Gating (2026-05-30)

- **backend-ts/package.json**: Removed `wrangler` and `@cloudflare/workers-types` from devDependencies. Renamed `deploy`, `dev:worker`, `db:migrate:local`, `db:migrate:remote` scripts to `:legacy` suffix — they remain in the file but are clearly non-default.
- **frontend/open-next.config.ts**: Replaced Cloudflare provider config with legacy-gate comment block. `@opennextjs/cloudflare` was already removed in T10 so importing it would fail.
- **backend-ts/wrangler.jsonc**: Added LEGACY header comment. D1 config retained for reference only.
- **backend-ts/src/worker.ts**: Added LEGACY header comment. File still re-exports `createApp()` so it remains syntactically valid.
- **frontend/.open-next/**: Pre-built Cloudflare artifact directory exists in working tree. Added `frontend/.open-next/` to root `.gitignore` to prevent accidental commits.
- **backend build**: `pnpm build` exits 0 — tsc clean after removing `@cloudflare/workers-types`.
- **Key pattern**: Gate strategy = rename scripts to `:legacy` + comment headers on files, not deletion. Preserves intent for potential future reference without polluting active paths.

## T12: Docker Compose Local Parity (2026-05-30)

### What was created/changed

- `docker-compose.yml` — replaced legacy Python `./backend` context with 3-service stack: `postgres` (postgres:16-alpine), `backend` (builds from `backend-ts/Dockerfile`), `frontend` (builds from `frontend/Dockerfile`). `postgres` uses healthcheck with `pg_isready`. Backend `depends_on postgres: condition: service_healthy`. Frontend `depends_on backend: condition: service_healthy`. Postgres host port defaults to 5433 via `${POSTGRES_HOST_PORT:-5433}` to avoid conflicts.
- `backend-ts/Dockerfile` — multi-stage (deps stage: pnpm install; runner stage: node:20-slim, pnpm@9, curl, non-root user `hono:nodejs` uid/gid 1001). CMD: `sh -c "pnpm db:migrate && pnpm start"`. HEALTHCHECK on `/health`.
- `README.md` — added Docker Compose section documenting all 3 services, ports, verification commands, and override for `NEXT_PUBLIC_API_URL`.

### Key patterns

- `POSTGRES_HOST_PORT` env var allows overriding host-side Postgres port (default 5433). Useful when local Postgres already uses 5432 or 5433.
- Backend `DATABASE_URL` is set in `docker-compose.yml` environment block pointing to `postgres` service hostname (internal Docker network). Never baked into image.
- `pnpm db:migrate && pnpm start` as CMD ensures migrations run before serving. If migration fails (bad DB URL), `pnpm db:migrate` exits non-zero and the container exits — clear failure signal.
- `env_file: path: .env, required: false` allows optional root `.env` to inject provider keys without breaking fresh installs.
- `NEXT_PUBLIC_API_URL` must be a build ARG (baked at build time). Default is `http://localhost:8000` for local compose usage.

### Verification results

- `curl -fsS http://localhost:8000/health` → `{"status":"ok","db":"ok"}` ✓
- `curl http://localhost:3000/` → HTTP 200, YUMMY HTML ✓
- Bad `DATABASE_URL` → migration fails with `ECONNREFUSED`, container exits with code 1 ✓

### Evidence

- `.sisyphus/evidence/task-12-compose-health.txt` — health + frontend 200 output
- `.sisyphus/evidence/task-12-compose-db-failure.txt` — bad-URL startup failure

## T13: OpenTofu AWS Foundation Modules (2026-05-30)

### Module structure created

```
infra/
  dev/
    terraform.tf    — S3+DynamoDB backend, aws + random providers, required_version >= 1.6
    variables.tf    — all variables (aws_region, project, env, vpc_cidr, azs, subnets, github_repo, app_secrets)
    main.tf         — locals (name_prefix, common_tags) + 5 module calls
    outputs.tf      — vpc_id, subnet_ids, ecr_urls, iam_role_arns, sg_ids, db_secret_arn
  modules/
    vpc/            — VPC, IGW, public + private subnets, EIP, single NAT GW, route tables
    ecr/            — backend + frontend repos, lifecycle policy (keep last 10)
    iam/            — ECS task execution role + managed policy, GitHub OIDC provider + role
    secrets/        — random_password for DB, aws_secretsmanager_secret for DB + app secrets
    security/       — ALB SG (80/443), ECS SG (from ALB), RDS SG (5432 from ECS)
```

### Key patterns

- `nonsensitive(toset(keys(var.app_secrets)))` required for `for_each` on sensitive map — Terraform rejects sensitive values as `for_each` keys directly.
- GitHub OIDC thumbprints `6938fd4d98bab03faadb97b34396831e3780aea1` + `1c58a3a8518e8759bf075b76b750d4f2df264fcd` — these are the two known GitHub Actions OIDC CA thumbprints as of 2024 per AWS docs.
- Single NAT GW in public subnet[0] is intentional for dev cost savings. Prod should use one per AZ.
- `recovery_window_in_days = 0` can be set if you need to immediately delete Secrets Manager secrets in dev (no recovery window).
- Remote state bootstrap is a manual one-time step — document in `docs/aws/REMOTE_STATE_BOOTSTRAP.md` before first `tofu init`.
- `terraform init -backend=false` + `terraform validate` passes with `terraform` binary (no `tofu` required on local Mac).

### Validation result

`terraform validate` → `Success! The configuration is valid.` (evidence: `.sisyphus/evidence/task-13-tofu-validate.txt`)

### Secret scan result

No AWS access keys, secret keys, 12-digit account IDs, or hardcoded AZ names in any `.tf` source file. (evidence: `.sisyphus/evidence/task-13-secret-scan.txt`)

## T14: ECS/RDS/ALB OpenTofu Deployment Modules (2026-05-30)

- Added three deployment modules under `infra/modules/`: `rds` (PostgreSQL 16 RDS), `alb` (public ALB + target groups/listener/rules), and `ecs` (Fargate cluster, backend/frontend task definitions, services, log groups).
- RDS is explicitly private-only: subnet group receives `module.vpc.private_subnet_ids`, `publicly_accessible = false`, and only the existing RDS security group is attached.
- The existing secrets module generates a password-only secret; ECS needs a complete `DATABASE_URL`. The RDS module now creates a separate `${name_prefix}/db/database-url` Secrets Manager secret after the endpoint is known, and ECS injects that secret as `DATABASE_URL` instead of using a plaintext environment variable.
- ALB idle timeout defaults to 4000 seconds via `alb_idle_timeout_seconds` for SSE. Backend target group health check is `/health`; frontend target group health check is `/`; both default to 30 second intervals.
- Required `/api/*` backend listener rule is present. Because the current Hono backend routes are mounted at root (`/ask`, `/sdlc`, `/sessions`, etc.) and the frontend API client currently sends root paths, the ALB module also adds explicit backend rules for those existing root API prefixes.
- ECS tasks run in private subnets with `assign_public_ip = false`, launch type `FARGATE`, default CPU 256/memory 512, and CloudWatch log groups `/ecs/${name_prefix}/backend` and `/ecs/${name_prefix}/frontend`.
- Local environment lacks `tofu` and `terraform-ls`; validation used Terraform-compatible fallback: `terraform fmt -recursive`, `terraform init -backend=false`, and `terraform validate` all succeeded. Plan smoke is still blocked locally by the configured S3 backend/AWS access; placeholder evidence saved in `.sisyphus/evidence/task-14-aws-health.txt`.
