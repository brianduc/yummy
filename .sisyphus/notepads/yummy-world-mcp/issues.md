# Issues — yummy-world-mcp

## [2026-04-29] Session Start
(No issues yet — execution starting)

## [2026-04-29] Migration/verification notes
- `pnpm install` updated `backend-ts/pnpm-lock.yaml` and removed a few transitive deps from the lockfile; dependency addition itself succeeded.
- `pnpm db:migrate` succeeded on both fresh and existing DB states; evidence captured in `.sisyphus/evidence/task-1-migration-fresh.txt` and `.sisyphus/evidence/task-1-migration-existing.txt`.
- `lsp_diagnostics` could not run cleanly because Biome LSP is not installed, and `.sql` has no configured LSP server in this environment.
- `pnpm exec biome check src tests` reports many pre-existing formatting/lint issues across backend-ts (imports/formatting in multiple files, including generated snapshots); no fixes were applied as part of this task.

## 2026-04-29 — Verification gaps
- GitNexus MCP server unavailable in loaded skills and local gitnexus CLI failed via npx with npm package install error, so impact analysis could not be completed through GitNexus tooling.
- typescript-language-server is not installed, so lsp_diagnostics could not run. Used npx tsc --noEmit instead and it passed.
- pnpm test currently fails in tests/integration/sdlc.test.ts: SSE JSON parsing and missing response fields for approve-ba/PM fallback; failures appear outside MCP world-client changes.

## T8 verification notes
- `lsp_diagnostics` could not run because `typescript-language-server` is not installed in this environment; `npx tsc --noEmit` passed and served as compiler verification.
- Initial `pnpm test` was blocked by `no such table: world_servers`; Drizzle migration journal did not include an existing world migration. Regenerated migration metadata, after which tests reached the expected route/workflow failures.
- Final `pnpm test`: 6 failures remain (3 pre-existing `sdlc.test.ts` failures plus 3 `/world/servers` 404 failures because the world router is not mounted yet). Registry implementation introduced no type-check errors.

## T11 integration setup notes
- `world.test.ts` currently returns 404s because the world router is not yet mounted in `createApp()`; the test file is ready for that router to land.
- `lsp_diagnostics` remains unavailable in this environment due to missing `typescript-language-server`.

## 2026-04-30 — Frontend world API client notes
- `lsp_diagnostics` could not run because the TypeScript language server is not installed here; used `next build` as the compiler check.
- No other files were modified.

## 2026-04-30 Task 17 integration tests
- TypeScript LSP diagnostics could not run because typescript-language-server is not installed in the environment.
- Backend pnpm test still reports the 3 pre-existing sdlc.test.ts failures; all other suites pass.
