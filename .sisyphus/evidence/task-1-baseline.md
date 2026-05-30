# Task 1: Pre-migration Baseline and Cloudflare Inventory
# Captured: 2026-05-30
# ============================================================

## Test Baseline

### Backend (backend-ts/)
- Command: `cd backend-ts && pnpm test`
- Test Files: **12 passed, 0 failed**
- Tests: **95 passed, 0 failed**
- Exit code: 0
- Duration: 8.38s
- Full output: `.sisyphus/evidence/task-1-backend-test-baseline.txt`

### Frontend (frontend/)
- Command: `cd frontend && npm test`
- Test Files: **30 passed, 0 failed**
- Tests: **163 passed, 0 failed**
- Exit code: 0
- Duration: 4.63s
- Full output: `.sisyphus/evidence/task-1-frontend-test-baseline.txt`

---

## Cloudflare Inventory Summary

Full classified inventory: `.sisyphus/evidence/task-1-cloudflare-inventory.txt`

| Classification     | Count | Key Files |
|--------------------|-------|-----------|
| RUNTIME-CRITICAL   | 6     | `backend-ts/src/db/client.ts` (D1Database import + createDb D1 overload), `backend-ts/src/app.ts:43` (c.env?.DB seam) |
| BUILD-DEPLOY-ONLY  | 15    | `backend-ts/wrangler.jsonc`, `backend-ts/package.json` (deploy/worker scripts+deps), `backend-ts/src/worker.ts`, `frontend/open-next.config.ts`, `frontend/wrangler.jsonc`, `frontend/package.json` (deploy/upload/cf-typegen scripts+deps) |
| GENERATED-ARTIFACT | 30+   | `backend-ts/dist/*`, `backend-ts/pnpm-lock.yaml`, `frontend/.open-next/**` (entire directory, committed to source) |
| DOCS-ONLY          | 5     | Comments in `env.ts` and `migrate.ts`, `instruction.md`, plan/boulder files |

---

## gitnexus Impact Analysis

### createDb (backend-ts/src/db/client.ts)
- Risk: **MEDIUM**
- Direct callers (d=1, WILL BREAK): 7 router files
  - `backend-ts/src/routers/world.router.ts`
  - `backend-ts/src/routers/sessions.router.ts`
  - `backend-ts/src/routers/sdlc.router.ts`
  - `backend-ts/src/routers/metrics.router.ts`
  - `backend-ts/src/routers/kb.router.ts`
  - `backend-ts/src/routers/config.router.ts`
  - `backend-ts/src/routers/ask.router.ts`
- Indirect (d=2): `backend-ts/src/app.ts`
- Transitive (d=3): `backend-ts/src/worker.ts`, `backend-ts/src/index.ts`

### createApp (backend-ts/src/app.ts)
- Risk: **LOW**
- Direct callers (d=1, WILL BREAK): 2 files
  - `backend-ts/src/worker.ts` (Cloudflare Worker entrypoint)
  - `backend-ts/src/index.ts` (Node.js entrypoint)

---

## Key Findings

1. **The database seam** is `backend-ts/src/app.ts:43`: `createDb(c.env?.DB)`.
   In Node.js mode (`index.ts`), `c.env` is undefined → falls through to local SQLite via `_localDbGetter`.
   In Worker mode (`worker.ts`), `c.env.DB` is the D1 binding. Replacing D1 with pg-node targets this line.

2. **frontend/.open-next/ is committed to source** — not gitignored. Contains 3 Durable Object classes
   (DOShardedTagCache, DOQueueHandler, BucketCachePurge) and the full Worker runtime. Task 11 must remove/gitignore this.

3. **Frontend "build" script is already standard Next.js** — `opennextjs-cloudflare` is only invoked via "deploy"
   and "upload" scripts. Standard `npm run build` does not trigger Cloudflare packaging.

4. **backend-ts/src/worker.ts** is a 3-line file that just exports `createApp()`. It is the sole Cloudflare Worker
   entrypoint and is safe to gate/remove independently without touching the rest of the app.

5. **All 95 backend tests and 163 frontend tests pass** at baseline. Zero failures.
