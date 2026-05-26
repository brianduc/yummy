## 2026-05-26

- The explorer route test should mirror the workspace status hook shape by mocking `kb.tree` with a nested directory plus a file node.
- The RED skeleton page stays minimal: `'use client'` and a `data-testid="explorer-page"` wrapper only.
- `IdePanel` expects `tree`, `ideFile`, `ideContent`, `ideLoading`, and `onFileOpen` props, so the next implementation step will need to supply those from workspace state.
## 2026-05-26
- Dashboard red-phase tests need the route component's `params: Promise<{ sessionId }>` prop passed into `page.tsx`; rendering without it triggers a TypeScript diagnostic before the intended selector failures.
- For red tests, stubbing workspace panels and `useScanPoll` keeps the failure focused on missing dashboard markup instead of setup noise.
## 2026-05-26
- Workspace route-level modal state can live in `app/workspace/[sessionId]/layout.tsx` and be exposed to child routes via a small client context from the shared component module.
- `useWorkspaceSession.deleteSession()` already handles deleting the active session by creating a replacement and redirecting, so layout callers should not duplicate that creation flow.

- T9: Dashboard page successfully rewritten. Used useWorkspaceSession and useWorkspaceStatus hooks to align with T5 refactoring, allowing the Vitest suite to pass correctly. React.use(params) required wrapping the render with Suspense and act() during testing.

## 2026-05-26
- Next.js app route modules reject arbitrary named exports from layout.tsx; shared route context should live in a sibling client module like file-open-context.tsx and be imported by both layout and child pages.
- T11 file-open routing keeps fetch/state ownership in workspace layout; explorer consumes FileOpenContext and should not duplicate api.kb.file calls.
- Direct frontend tsc --noEmit currently fails on existing app/workspace/[sessionId]/settingsSync.test.tsx Vitest globals/mock typing, while changed workspace files are LSP-clean and next build passes.

## 2026-05-26
- Frontend `npm run lint` was still wired to `next lint`; switching to `biome check app components hooks lib test` made the command executable in this repo.
- `frontend/package.json` needed `@biomejs/biome` added to devDependencies so the lint script resolves locally without a global install.
- `npm run lint` now reports many pre-existing issues outside the changed files, but `npm run build` passes and `MainStage` is still actively referenced, so no deletion was made.
## 2026-05-26
- F1 audit found dedicated route pages, dashboard stat/card elements, hoisted WorkspaceChatProvider/DeleteSessionModal, and no uncommitted backend/panel-component/protected existing route page diffs.
- F1 reject reasons: explorer page passes noop onFileOpen instead of the implemented layout file-open handler, dashboard test lacks scan-completion navigation coverage, `frontend/components/workspace/MainStage.tsx` remains as tabbed dead code, and task-specific evidence files from the workspace-restructure plan are mostly absent.
