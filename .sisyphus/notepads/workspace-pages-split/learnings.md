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
