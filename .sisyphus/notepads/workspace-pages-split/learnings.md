# Learnings

## 2026-05-15 Session Start
- Frontend: Next.js App Router, React 19, Tailwind, Vitest+jsdom
- Backend: TypeScript/Hono (backend-ts/), NO changes allowed
- State: No Redux/Zustand/Jotai - use React context/hooks only
- Tests: `cd frontend && npm test` (Vitest)
- Build: `cd frontend && npm run build`
- Lint: Biome for backend, next lint for frontend
- snake_case field names preserved (Python parity)
- WorkspacePage is 1000+ line monolith at frontend/app/workspace/[sessionId]/page.tsx
- Components in frontend/components/workspace/ (25 files)
- Existing tests: characterization.test.tsx, navigation.test.tsx, settingsSync.test.tsx in [sessionId]/
- frontend/test/world-sdlc.test.tsx, world.test.tsx exist
- frontend/hooks/useScanPoll.ts - precedent for extracted lifecycle hook
- frontend/lib/api.ts - central API client
- frontend/lib/theme.ts, uiSize.ts - persisted UI preferences
- Navigation mock spike: next/navigation with useParams/useRouter/usePathname works in Vitest when a local probe renders Link hrefs and router methods.
- Characterization baseline: WorkspacePage currently renders the IDE panel by default; SDLC tab is exposed as "SDLC Pipeline" in the UI, not "SDLC".
- Test runner evidence lives in .sisyphus/evidence/task-1-navigation-test-output.txt.

## 2026-05-15 Task 2
- Added frontend/hooks/useWorkspaceContracts.ts with type-only contracts for workspace session, status/KB/polling, chat, SDLC, and UI provider slices.
- Added frontend/test/stream-lifecycle.test.tsx as RED lifecycle characterization: child workspace route rerender preserves mocked stream signals; leaving workspace expects abort and currently fails until providers/layout own AbortController cleanup.
- Evidence captured in .sisyphus/evidence/task-2-stream-lifecycle.txt and task-2-stream-abort.txt from npm test -- --run stream-lifecycle.
- LSP diagnostics unavailable in environment: typescript-language-server command not installed.

## 2026-05-15 Task 3 — Workspace Provider Hooks
- Created three hooks: useWorkspaceSession, useWorkspaceStatus, useWorkspaceUi
- 18/18 tests passing in frontend/test/workspace-providers.test.tsx
- routerRef pattern: store useRouter() result in a ref, update each render, use routerRef.current in callbacks — removes router from useCallback deps, prevents infinite re-render when mock returns new object per render
- stopScanPollRef pattern: same idea for useScanPoll's stopScanPoll (non-memoized) — removes it from useEffect deps, prevents effect re-run on every render
- useWorkspaceUi uses getCurrentTheme() / getSavedUiSizeIndex() as useState initializer functions (lazy init)
- cancelledRef in useWorkspaceSession prevents setState after unmount
- vi.hoisted() required for mock variables accessible inside vi.mock() factory closures
- Evidence: .sisyphus/evidence/task-3-provider-tests.txt
- **Characterization Tests**: Keeping characterization tests running continuously while refactoring large pages is essential to ensure critical element hierarchy (e.g. \`WorkspaceChatProvider\` placement, conditional UI rendering) is preserved.
- **Provider Refactoring Gotcha**: When wrapping a component in a Provider during a heavy refactoring, ensure that the closing tags are syntactically valid in JSX (e.g., matching the \`<></>\` fragments correctly) and that no inner `useEffect` blocks mistakenly consume variables hoisted above the hook declarations.

## 2026-05-15 Task 5 — SDLC Provider Extraction
- Extracted SDLC streaming state into `frontend/hooks/useWorkspaceSdlc.ts`; hook owns edit buffers, streaming agent/text, tool calls, approval/restore/abort handlers, and guards state updates with `isMountedRef`.
- RED test pattern: `renderHook` plus a manually controlled async generator can prove abort cleanup without relying on real SSE/fetch.
- `runSdlcStream` must track the current agent in a ref/local variable; React state is too stale for immediate `tool_call` / `tool_result` events inside the same stream loop.
- Focused SDLC provider test passes and evidence is captured in `.sisyphus/evidence/task-5-sdlc-provider.txt` and `task-5-sdlc-abort.txt`.
- Full frontend test suite still has the inherited intentional RED `stream-lifecycle` abort-on-workspace-layout-unmount failure; frontend build passes.

## 2026-05-15 Task 6 — Persistent Workspace Layout

- Created `frontend/app/workspace/[sessionId]/layout.tsx` as a 'use client' persistent shell wrapping all workspace provider hooks (useWorkspaceSession, useWorkspaceStatus, useWorkspaceUi, useWorkspaceChat, useWorkspaceSdlc).
- **React.use vs named import**: Layout uses `React.use(params)` (NOT the named `use` import). Tests spy via `vi.spyOn(React, 'use')` — the spy ONLY intercepts `React.use`, not a destructured named `use`. Always use `React.use(params)` in 'use client' layouts for testability.
- **Session mirror pattern**: `useWorkspaceSession` doesn't expose a `setSession` setter. Layout uses `useState<Session | null> + useEffect` to sync from `sessionCtx.session` into a local `session` state that is passed to `useWorkspaceSdlc` and `useWorkspaceChat` which require a writable setter.
- **Test import path**: Tests in `frontend/test/` import from `@/app/workspace/[sessionId]/layout` (alias works even with brackets in path). Relative paths with `[sessionId]` in them cause Vite import analysis errors.
- **Provider persistence test**: To verify layout persists across child navigation, use `rerender()` with different children and check the layout data-testids remain present while old child is gone and new child appears.
- 4/4 workspace-layout tests pass. Full suite: 49 pass, 1 intentional RED (stream-lifecycle abort).
