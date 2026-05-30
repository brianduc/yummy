# Frontend AWS Runtime Assessment: SSR vs Static Export

**Date:** 2026-05-30  
**Scope:** `frontend/` — Next.js 14+ App Router, React 19  
**Decision:** **SSR / Node.js container required**

---

## Executive Summary

The YUMMY frontend **cannot be deployed as a static export** (`output: 'export'`). The primary blocker is the `[sessionId]` dynamic route segment, which routes to user-created sessions that only exist at runtime — making static pre-generation impossible. The app is already configured as `output: 'standalone'`, which requires a Node.js server runtime.

**Verdict: SSR/container required.** Static export is not safe.

---

## Route Inventory

All routes live under `frontend/app/`. Every file is a client component (`'use client'` or implicit via hooks). No server components perform data fetching; all API calls are made client-side via `frontend/lib/api.ts`.

| Route | File | Runtime | Dynamic? | Static Export Safe? |
|---|---|---|---|---|
| `/` | `app/page.tsx` | Client | No | ✅ Would be safe alone |
| `/workspace/[sessionId]` | `app/workspace/[sessionId]/page.tsx` | Client | **YES** | ❌ Blocked |
| `/workspace/[sessionId]/explorer` | `.../explorer/page.tsx` | Client | **YES** | ❌ Blocked |
| `/workspace/[sessionId]/wiki` | `.../wiki/page.tsx` | Client | **YES** | ❌ Blocked |
| `/workspace/[sessionId]/sdlc` | `.../sdlc/page.tsx` | Client | **YES** | ❌ Blocked |
| `/workspace/[sessionId]/jira` | `.../jira/page.tsx` | Client | **YES** | ❌ Blocked |
| `/workspace/[sessionId]/history` | `.../history/page.tsx` | Client | **YES** | ❌ Blocked |
| `/workspace/[sessionId]/graph` | `.../graph/page.tsx` | Client | **YES** | ❌ Blocked |
| `/workspace/[sessionId]/insight` | `.../insight/page.tsx` | Client | **YES** | ❌ Blocked |
| `/workspace/[sessionId]/tracing` | `.../tracing/page.tsx` | Client | **YES** | ❌ Blocked |
| `/workspace/[sessionId]/settings` | `.../settings/page.tsx` | Client | **YES** | ❌ Blocked |
| `/workspace/[sessionId]/world` | `.../world/page.tsx` | Client | **YES** | ❌ Blocked |
| `/workspace/[sessionId]/sessions` | `.../sessions/page.tsx` | Client | **YES** | ❌ Blocked |
| `/workspace/[sessionId]/database` | `.../database/page.tsx` | Client | **YES** | ❌ Blocked |

**Root layout** (`app/layout.tsx`): Server component by default, but contains only `<Metadata>` export and `<html><body>` shell — no server API calls.

---

## Server Runtime Feature Audit

### cookies() / headers() (next/headers)
- **Status: NOT FOUND**
- Grep of all `*.tsx`, `*.ts` under `frontend/`: 0 matches
- No server-side cookie reading or request header access

### Server Actions ('use server')
- **Status: NOT FOUND**
- No `'use server'` directive anywhere in the frontend
- All mutations happen via client-side `fetch()` calls to the Hono backend

### Dynamic Route — `[sessionId]` ❌ BLOCKS STATIC EXPORT
- **File:** `frontend/app/workspace/[sessionId]/` (entire subtree)
- **Issue:** No `generateStaticParams()` export exists anywhere in this segment
- **Root cause:** Session IDs are created by users at runtime via `POST /sessions`. It is architecturally impossible to enumerate them at build time.
- **Static export requirement:** Next.js `output: 'export'` requires `generateStaticParams()` for all dynamic segments. Without it, the build fails or falls back to error pages.
- **Reference:** `frontend/app/workspace/[sessionId]/layout.tsx` — uses `React.use(params)` to resolve `sessionId` at render time

### export const dynamic / dynamicParams
- **Status: NOT FOUND**
- No `export const dynamic` or `export const dynamicParams` overrides in any route file

### ISR / revalidation
- **Status: NOT FOUND**
- No `export const revalidate` in any page

### Next.js Image Optimization (`next/image`)
- **Status: NOT USED**
- Zero imports of `next/image` across all frontend files
- No image optimization configuration in `next.config.mjs`
- Static export would be safe for this feature alone

### Rewrites / Redirects (next.config.mjs)
- **Status: NOT CONFIGURED**
- `next.config.mjs` has no `rewrites()`, `redirects()`, or `headers()` async functions
- Config only sets: `output: 'standalone'`, `reactCompiler: true`, `typescript.ignoreBuildErrors: true`, `allowedDevOrigins`

### Edge Middleware
- **Status: NOT PRESENT**
- No `frontend/middleware.ts` file exists

### Current `output` Mode
- **File:** `frontend/next.config.mjs` line 9
- **Value:** `output: 'standalone'`
- **Meaning:** Next.js produces a self-contained Node.js server at `.next/standalone/`. Requires Node.js runtime. The Dockerfile runner stage executes `node server.js`.

---

## NEXT_PUBLIC_API_URL Behavior

**Variable:** `NEXT_PUBLIC_API_URL`  
**Consumer:** `frontend/lib/api.ts` line 12 (sole usage)

```typescript
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
```

### Build-time Inlining (Critical for Deployment)

`NEXT_PUBLIC_*` variables in Next.js are **inlined at build time** by the compiler. The value is substituted as a string literal into the JavaScript bundle during `next build`. **Setting this env var at container start time has no effect** — the JS bundle already contains the baked value.

**Dockerfile evidence** (`frontend/Dockerfile` lines 16-18):
```dockerfile
# Baked at build time — must match your public API URL (e.g. https://api.yourdomain.com)
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build
```

The Dockerfile comment itself acknowledges this constraint.

### Deployment Requirements

- **For AWS (App Runner, ECS, EC2):** Pass API URL as a **Docker build argument**, not a task/service environment variable:
  ```
  docker build --build-arg NEXT_PUBLIC_API_URL=https://api.yourdomain.com .
  ```
- **Multi-environment:** Separate image builds are required for staging and production if the API URL differs
- **Alternative (not implemented):** Runtime config via `/config.json` endpoint — would require frontend code changes

---

## Blocking Features Summary

Features that **block static export** (`output: 'export'`):

| Feature | File | Line | Why It Blocks |
|---|---|---|---|
| `[sessionId]` dynamic route | `frontend/app/workspace/[sessionId]/` | — | No `generateStaticParams`; sessions are runtime-created |
| `output: 'standalone'` | `frontend/next.config.mjs` | 9 | Explicitly sets Node.js server mode |

These are **architectural blockers** — they cannot be resolved without changing the application's fundamental routing design (sessions cannot be pre-enumerated at build time).

---

## Current Build Pipeline

From `frontend/package.json`:
```json
"build": "npm run build:next && opennextjs-cloudflare build --skipNextBuild",
"build:next": "next build",
```

The build runs two phases:
1. `next build` — standard Next.js build with `output: 'standalone'`
2. `opennextjs-cloudflare build` — packages the standalone output for Cloudflare Workers

For AWS deployment, phase 1 alone (`npm run build:next`) + the Dockerfile runner stage produces a valid container image. The OpenNext Cloudflare phase is only needed for Cloudflare Workers hosting.

---

## Recommendation

**Deploy as a Node.js container** using the existing `frontend/Dockerfile`:
- The `output: 'standalone'` mode and the dynamic `[sessionId]` routing are correct and intentional
- The app is fully functional as a server-rendered Next.js app
- No static export conversion is warranted or possible

**For AWS specifically:**
- AWS App Runner or ECS Fargate can run the container directly
- Pass `NEXT_PUBLIC_API_URL` as a `--build-arg` during image build in CI/CD
- The Node.js server listens on port 3000 (`ENV PORT=3000` in Dockerfile)
