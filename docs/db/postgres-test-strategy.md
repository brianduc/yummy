# Docker Postgres Test Strategy

_Last updated: 2026-05-30_

## Overview

This document defines the authoritative strategy for running backend integration tests against a real Postgres database. SQLite `:memory:` is **not** the default for integration tests after the Postgres migration. This strategy applies to local development and CI.

---

## 1. Docker Postgres Service

Add a `postgres-test` service to `docker-compose.yml` (or run it standalone):

```yaml
services:
  postgres-test:
    image: postgres:16-alpine
    restart: unless-stopped
    ports:
      - "5433:5432"          # 5433 on host to avoid conflicting with a running dev DB on 5432
    environment:
      POSTGRES_USER: yummy
      POSTGRES_PASSWORD: yummy
      POSTGRES_DB: yummy_test
    volumes:
      - postgres_test_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U yummy -d yummy_test"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  postgres_test_data:
```

> **Note:** Port 5433 keeps the test DB separate from a local dev DB that may run on 5432.

### Standalone (no compose)

```bash
docker run --rm -d \
  --name yummy-test-pg \
  -e POSTGRES_USER=yummy \
  -e POSTGRES_PASSWORD=yummy \
  -e POSTGRES_DB=yummy_test \
  -p 5433:5432 \
  postgres:16-alpine
```

---

## 2. DATABASE_URL

```
DATABASE_URL=postgres://yummy:yummy@localhost:5433/yummy_test
```

This value must be set **before** any module that imports `db/client.ts` is evaluated. The existing `_setup.ts` pattern (setting `process.env.DATABASE_URL` at the top of the file before any imports) continues to apply — the value simply changes from `:memory:` to the Postgres URL.

**`:memory:` is explicitly rejected as an integration test default after migration.**

---

## 3. Migration Invocation

Run migrations against Postgres before executing tests:

```bash
# Local
DATABASE_URL=postgres://yummy:yummy@localhost:5433/yummy_test pnpm db:migrate

# As a combined command
DATABASE_URL=postgres://yummy:yummy@localhost:5433/yummy_test pnpm db:migrate && \
DATABASE_URL=postgres://yummy:yummy@localhost:5433/yummy_test pnpm test
```

`pnpm db:migrate` executes `tsx src/db/migrate.ts` which must be updated (in T8) to use the Drizzle Postgres migrator when `DATABASE_URL` is a `postgres://` URL rather than `:memory:`.

---

## 4. Reset Strategy

The reset strategy depends on test isolation needs. The recommended approach is **truncate-between-tests**, which mirrors the current `_setup.ts` `beforeEach` cleanup but uses SQL TRUNCATE instead of per-repo `clear()` calls.

### Option A — Truncate between tests (RECOMMENDED)

```typescript
// In updated _setup.ts (after migration)
beforeEach(async () => {
  await db.execute(sql`
    TRUNCATE TABLE
      sessions, kb_items, repos, scan_status, logs,
      world_servers, world_config
    RESTART IDENTITY CASCADE
  `);
});
```

- Fast: TRUNCATE is faster than DELETE for large tables.
- Safe: `RESTART IDENTITY` resets sequences; `CASCADE` handles FK dependencies.
- Consistent with current behaviour: all tables cleared per test.

### Option B — Transaction rollback per test

Wrap each test in a transaction that is rolled back at the end. This is faster than truncate for test suites with many small tests but requires the Drizzle client to be transaction-aware and every repo call to share the transaction connection.

**Not recommended for the current architecture** because:
- Repositories currently accept `db` (the global client), not a transaction handle.
- Refactoring all repos to accept a transaction would be a larger change.

### Option C — Drop and recreate schema per suite

Suitable for CI where the DB container is ephemeral. Each `vitest` worker (suite file) drops and recreates the public schema, then runs migrations:

```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
```

**Not recommended for local dev** because it is slow and requires elevated Postgres privileges.

**Chosen strategy: Option A (truncate).**

---

## 5. Vitest Constraints (PRESERVED)

The following constraints from `backend-ts/vitest.config.ts` are **mandatory** and must not change:

```typescript
// vitest.config.ts
{
  pool: 'forks',          // Each test file runs in a separate forked Node process
  isolate: true,          // Module registry is isolated between test files
  fileParallelism: false, // Test FILES run serially — never in parallel
  testTimeout: 15_000,
  hookTimeout: 15_000,
}
```

**Why these constraints exist:**
- `fileParallelism: false` — Multiple suite files sharing a single Postgres database would cause race conditions (concurrent TRUNCATE / INSERT conflicts). Serial execution ensures clean state between files.
- `pool: 'forks'` — Guarantees true process isolation; module-level singletons (the Drizzle client) are fresh per file.
- `isolate: true` — Prevents module cache bleed between files in the same process pool.

**These constraints must be preserved verbatim after the Postgres migration.** Do not parallelize backend tests.

---

## 6. Updated `_setup.ts` Pattern

After the Postgres migration (T8), `_setup.ts` must change as follows:

```typescript
// Before (current — SQLite :memory:)
process.env.DATABASE_URL = ':memory:';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db, getLocalDb } from '../../src/db/client.local.js';

beforeAll(() => {
  migrate(getLocalDb(), { migrationsFolder: resolve(__dirname, '../../drizzle') });
});

// After (Postgres)
// DATABASE_URL must be set in environment before running tests
// (do NOT hard-code ':memory:' — it is rejected)
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, getMigratorDb } from '../../src/db/client.js';

beforeAll(async () => {
  await migrate(getMigratorDb(), { migrationsFolder: resolve(__dirname, '../../drizzle') });
});
```

The `_setup.ts` rule still applies: **import this file as the very first import** in every integration test file so `DATABASE_URL` is available before any `db/client.ts` evaluation.

---

## 7. Local Developer Workflow

```bash
# Step 1: Start Postgres test container
docker run --rm -d \
  --name yummy-test-pg \
  -e POSTGRES_USER=yummy \
  -e POSTGRES_PASSWORD=yummy \
  -e POSTGRES_DB=yummy_test \
  -p 5433:5432 \
  postgres:16-alpine

# Step 2: Wait for readiness
docker exec yummy-test-pg pg_isready -U yummy -d yummy_test

# Step 3: Run migrations
DATABASE_URL=postgres://yummy:yummy@localhost:5433/yummy_test pnpm --prefix backend-ts db:migrate

# Step 4: Run tests
DATABASE_URL=postgres://yummy:yummy@localhost:5433/yummy_test pnpm --prefix backend-ts test

# Step 5: Stop container when done (--rm cleans it up automatically)
docker stop yummy-test-pg
```

---

## 8. CI Approach (GitHub Actions)

Use a Postgres service container in the GitHub Actions job:

```yaml
jobs:
  backend-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: yummy
          POSTGRES_PASSWORD: yummy
          POSTGRES_DB: yummy_test
        ports:
          - 5433:5432
        options: >-
          --health-cmd "pg_isready -U yummy -d yummy_test"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - uses: pnpm/action-setup@v3
        with:
          version: latest

      - name: Install dependencies
        working-directory: backend-ts
        run: pnpm install

      - name: Run migrations
        working-directory: backend-ts
        env:
          DATABASE_URL: postgres://yummy:yummy@localhost:5433/yummy_test
        run: pnpm db:migrate

      - name: Run tests
        working-directory: backend-ts
        env:
          DATABASE_URL: postgres://yummy:yummy@localhost:5433/yummy_test
        run: pnpm test
```

### Alternative: Testcontainers

If a Postgres service container is not available (e.g., self-hosted runners without Docker socket), use [`testcontainers`](https://node.testcontainers.org/) in `_setup.ts`:

```typescript
import { PostgreSqlContainer } from '@testcontainers/postgresql';

let container: StartedPostgreSqlContainer;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine')
    .withUsername('yummy')
    .withPassword('yummy')
    .withDatabase('yummy_test')
    .start();
  process.env.DATABASE_URL = container.getConnectionUri();
  await migrate(getMigratorDb(), { migrationsFolder: resolve(__dirname, '../../drizzle') });
}, 60_000); // longer timeout for container startup

afterAll(async () => {
  await container.stop();
});
```

**Prefer GitHub Actions service containers over Testcontainers** — they start faster and require no extra runtime dependency.

---

## 9. pg-mem as Fallback Only

[pg-mem](https://github.com/oguimbal/pg-mem) is an in-process Postgres emulator. It may be used as a fallback when:
- Docker is unavailable on the developer machine.
- A quick smoke-test pass is needed without an external DB.

**pg-mem is NOT the primary strategy.** Known differences from real Postgres that affect YUMMY tests:

| Feature | pg-mem | Real Postgres |
|---|---|---|
| Full-text search (`tsvector`, `to_tsquery`) | Partial / missing | Supported |
| `TRUNCATE ... RESTART IDENTITY CASCADE` | Partial support | Full support |
| Postgres-specific JSON operators (`@>`, `#>>`) | Partial | Full |
| Drizzle `postgres-js` migrator | May fail on some DDL | Full support |
| Advisory locks | Not supported | Supported |
| `pg_isready` / connection health | Not applicable | Standard |

If pg-mem is used as a fallback, set `DATABASE_URL=pg-mem://` (a sentinel value the updated db client will detect) and import the pg-mem adapter in `_setup.ts`. Document which test files may produce false positives against pg-mem.

---

## 10. Why Not Keep `:memory:` SQLite?

The migration to Postgres changes the ORM dialect from `drizzle-orm/better-sqlite3` to `drizzle-orm/postgres-js`. After this change:
- SQLite `:memory:` no longer runs the same migration files (Postgres DDL is incompatible with SQLite).
- Type differences (e.g., `TEXT` vs `VARCHAR`, `INTEGER` vs `BIGINT`) can mask bugs only detectable against a real Postgres backend.
- Production will run Postgres (AWS RDS); tests must match production dialect to be meaningful.

**`:memory:` SQLite is explicitly removed as an integration test default.** It may remain for isolated unit tests of SQLite-specific utility functions, if any remain post-migration.
