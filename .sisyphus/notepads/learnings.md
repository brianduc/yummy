- T11: Refactored `Button` to Tailwind semantic tokens cleanly, changing `font-mono` to `font-sans`.
- Wave 4 semantic primitives need token parity across `globals.css` and `tailwind.config.js`; add aliases in both places to keep utility names and CSS vars aligned.
- T23: Radix Avatar wrapper follows the same compound pattern as ScrollArea; `AvatarFallback` only renders inside `Avatar`, and tests should cover the wrapper rather than standalone fallback usage.
- T26: `frontend/lib/utils.ts` already exposes `cn()` via `clsx` + `tailwind-merge`; skeleton can stay minimal and rely on that merge helper.
## 2026-05-14
- Radix separator wrapper follows the same forwardRef pattern as other ui primitives: default `decorative=true`, base `shrink-0 bg-border`, and orientation-specific sizing classes.
- Frontend Vitest suite currently has unrelated failing avatar tests; separator component tests pass.
## 2026-05-14 T49
- Default theme now flips to `kinetic-light` when saved theme is missing or invalid.
- Added regression tests for empty storage, saved override, and invalid fallback.

## F3 QA Run — 2026-05-14
- Vitest 421/421 pass, 48 files — all green
- Next.js 16.2.3 Turbopack build exits 0, TypeScript clean
- Dev server /workspace/[sessionId] returns 200; data-theme is CSR-applied (not in SSR HTML)
- ALL_THEME_IDS has 8 entries; parametrized over 9 KEY_PANELS = 72 cases
- Total gzipped JS ~291 KB (980 KB raw) — reasonable for 24-panel platform
- Evidence at: .sisyphus/evidence/final-qa/
- F2 review fix: `AICopilot.tsx` no longer needs `as any` once the textarea ref and key handler are typed to `HTMLTextAreaElement`; `useWorkspaceStatus.ts` empty catches now document intentional retry-on-failure behavior.

- Updated `frontend/lib/workspace-navigation.ts` as the canonical workspace nav source: added graph/wiki/insight/history/jira, renamed chat label+breadcrumb to Dashboard, and expanded route labels to match all 13 items.
- Added `frontend/test/workspace-navigation-update.test.tsx` to pin the 13-item contract, graph route building/active state, new item suffix alignment, and Dashboard rename.
- Verification: frontend diagnostics were clean and `npm test -- workspace-navigation-update` passed 5/5.
# 2026-05-26
- Route tests in `frontend/test/workspace/*-route.test.tsx` mock `next/navigation` and workspace hooks first, then import the page last to keep client components isolated.
- For RED-phase route work, a skeletal `page.tsx` can satisfy existence checks while the rendering expectation stays failing until the next implementation step.
- T5 wiki route: `frontend/test/workspace/wiki-route.test.tsx` mirrors the session route pattern with `useParams`, `useWorkspaceStatus`, and a `WikiPanel` stub; keeping the page skeleton minimal preserves the RED phase until the real panel wiring is added.
- T8 jira route: `BacklogPanel` can be stubbed with a `data-testid` shell, and the route test should assert the client wrapper, stub presence, and mount safety while keeping the page implementation minimal.
T12 explorer page: the route page should stay thin and consume `FileOpenContext` from the workspace layout instead of duplicating file-loading state. `useWorkspaceStatus()` supplies `kb.tree`, and `IdePanel` remains the only render target for the explorer route.
T13 graph page: the route page stays thin and renders `NodeGraph` directly from `useWorkspaceStatus()` data (`kb.tree` + `status.repo`), keeping graph-specific logic inside the shared workspace hook.
## 2026-05-26 — Insight route page
- `frontend/app/workspace/[sessionId]/insight/page.tsx` is a minimal client wrapper: `useWorkspaceStatus()` supplies `kb`, and the page renders `InsightsPanel` inside a `data-testid="insight-page"` container.
- The workspace insight route test expects only the wrapper plus the panel mount; no `InsightsPanel` changes were needed.
## 2026-05-26 — Jira route page
- `frontend/app/workspace/[sessionId]/jira/page.tsx` follows the same thin route pattern: `useWorkspaceSession(sessionId)` supplies `session`, and the page renders `BacklogPanel` with `session?.jira_backlog || []`.
- The jira route test only needs the client wrapper and backlog panel mount; `BacklogPanel` itself stays unchanged.

## 2026-05-26 — T20 route-based workspace layout
-  no longer owns active tab/activity state; workspace navigation is route-driven.
-  should not require active navigation props when  only renders , , route children, and .
- Verification: layout diagnostics clean, WorkspaceLayout diagnostics clean, and  in  passed with all workspace routes listed.

## 2026-05-26 — T20 route-based workspace layout
- frontend/app/workspace/[sessionId]/layout.tsx no longer owns active tab/activity state; workspace navigation is route-driven.
- WorkspaceLayoutProps should not require active navigation props when WorkspaceLayout only renders AppSidebar, AppHeader, route children, and CopilotSheet.
- Verification: layout diagnostics clean, WorkspaceLayout diagnostics clean, and npm run build in frontend/ passed with all workspace routes listed.

## 2026-05-30 — Backend Biome autofix
- `pnpm biome check --write src tests` in `backend-ts/` fixed 14 files with no logic changes.
- Follow-up verification: `pnpm build` passed; `pnpm biome check src tests` reported no fixes needed.
- `pnpm test` currently fails in existing DB setup because `DATABASE_URL` is not a valid URL for the Postgres client (`Invalid URL` from `postgres.js`), so the failure is environmental rather than formatter-related.
