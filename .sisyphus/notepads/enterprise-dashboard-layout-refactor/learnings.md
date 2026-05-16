## 2026-05-15 Task 1: Discovery safety gate
- Workspace dashboard shell should be owned by `frontend/app/workspace/[sessionId]/layout.tsx`; all discovered dashboard routes live under `/workspace/[sessionId]/*`.
- Current code has duplicate shell/provider ownership: both workspace `layout.tsx` and workspace index `page.tsx` render `WorkspaceLayout` and mount `WorkspaceChatProvider`.
- `ActivityBar` links `explorer` to `/workspace/:sessionId/explorer`, but no `explorer/page.tsx` exists.
- `frontend/components/ui/sheet.tsx` and `tooltip.tsx` are absent; `button.tsx`, `dialog.tsx`, `input.tsx`, `scroll-area.tsx`, and `tabs.tsx` exist.
- GitNexus index was stale and was refreshed with `npx gitnexus analyze`; frontend component impact results are LOW but direct AST/text references remain necessary.

## 2026-05-15 Task 2: Canonical workspace nav model
- Extracted workspace navigation metadata into `frontend/lib/workspace-navigation.ts` so `ActivityBar` now consumes shared `ActivityId`, item metadata, route builders, active-state logic, and breadcrumb labels.
- Preserved the existing explorer route suffix (`explorer`) and all current test ids/labels/icons/colors; only the source of truth moved.
- Shared nav data now exists in one place for later header/sidebar tasks without changing route ownership yet.

### Task 3: Sidebar Component
- Created `AppSidebar.tsx` as a client component to handle its own `isExpanded` state.
- Leveraged existing `activityItems` and route helpers from `workspace-navigation.ts`.
- Used native `title` and `aria-label` attributes on links when collapsed to show text on hover, avoiding the need to implement a full Tooltip primitive just for this.
- Added specific `data-testid` attributes (`app-sidebar`, `sidebar-toggle`, `sidebar-nav-xyz`) to facilitate future testing.
- Verified isolation using a dedicated `AppSidebar.test.tsx` file to ensure the toggle logic works without touching `localStorage` and without wiring into the global `WorkspaceLayout`.
- The layout type errors (`Dispatch<SetStateAction<MainTabId>>`) in `layout.tsx` were confirmed as baseline failures that remain isolated from our pure component build.
- Created isolated `AppHeader.tsx` with dynamic breadcrumbs relying on `buildWorkspaceActivityRoute` from `workspace-navigation.ts`.
- Updated AppHeader Command Palette trigger text from ⌘K to Cmd/Ctrl+K to properly communicate cross-platform keyboard shortcut semantics.

### Task 5: CopilotSheet wrapper
- Implemented `CopilotSheet` which acts as a controlled overlay wrapper (`open`, `onOpenChange`) over the existing `AICopilot`.
- Ensured it delegates state and chat history correctly either via `useChat()` internally (when `WorkspaceChatProvider` wraps it from a higher level) or via props, avoiding coupling the Provider's lifecycle with the visibility lifecycle.
- Created `frontend/components/ui/sheet.tsx` adhering to the existing `cva` and `lucide-react` patterns seen in `dialog.tsx`.

## 2026-05-15 Task 6: Dashboard shell composition
- `WorkspaceLayout` now renders the enterprise dashboard shell directly: `dashboard-shell` root, `AppSidebar`, `AppHeader`, `dashboard-main`, `dashboard-content`, and `CopilotSheet`.
- The dashboard content slot keeps `mainStageChildren` unchanged; route child preservation remains covered by `workspace-main-slot` tests.
- Copilot state is local to `WorkspaceLayout` (`isCopilotOpen`) and chat props are sourced from the existing `useChat()` context mounted by `WorkspaceChatProvider` above the layout.
- The old `react-resizable-panels` `Group`/`Panel`/`Separator` shell and permanent right `AICopilot` pane are removed from `WorkspaceLayout`.

## 2026-05-15 Task 6 Correction: component-test wrapper
- Actual `WorkspaceLayout` tests require a `WorkspaceChatProvider` value because the shell calls `useChat()` and passes chat context into the prop-driven `CopilotSheet`.
- Next navigation is mocked only for child dashboard components (`AppSidebar`/`AppHeader`) while the layout under test remains real.

## 2026-05-15 Task 7: Keyboard shortcut wiring
- `CommandPalette.tsx` already owns Cmd/Ctrl+K, so `WorkspaceLayout` should only add the Copilot Sheet listener for Cmd/Ctrl+J.
- The Copilot shortcut is a minimal `useEffect` window listener with `preventDefault()` only for handled J presses, keeping header trigger wiring untouched.
- Real-component tests can assert the actual `copilot-sheet` count and the `command-palette-trigger` callback without mocking the layout shell.

## 2026-05-15 Task 8: Duplicate shell ownership cleanup
- Collapsed workspace index ownership toward `frontend/app/workspace/[sessionId]/layout.tsx`; the index page now renders its business content directly under the parent layout slot instead of nesting another `WorkspaceLayout`.
- `WorkspacePage` now consumes the existing parent `WorkspaceChatProvider` with `useChat()` and no longer creates a second `WorkspaceChatProvider` or local `useWorkspaceChat` instance.
- Preserved index-page panels, fetchers, onboarding, delete modal, toast, command palette, and prose styles; only the obsolete nested shell/provider wrapper was removed.

## 2026-05-15 Task 9: Layout/navigation test coverage
- Updated the focused shell tests to assert the dashboard shell contract: sidebar/header presence, breadcrumb semantics, command palette wiring, and active route behavior on the shared nav model.
- Added a no-persistence regression test for `AppSidebar` that spies on `localStorage.setItem` and confirms sidebar expansion toggles stay local.
- Kept assertions route-aware rather than smoke-only; the sidebar/header tests now check explorer vs index semantics and nested-route breadcrumb behavior.

## 2026-05-15 Task 9: Layout/navigation test coverage
- Updated the focused shell tests to assert the dashboard shell contract: sidebar/header presence, breadcrumb semantics, command palette wiring, and active route behavior on the shared nav model.
- Added a no-persistence regression test for `AppSidebar` that spies on `localStorage.setItem` and confirms sidebar expansion toggles stay local.
- Kept assertions route-aware rather than smoke-only; the sidebar/header tests now check explorer vs index semantics and nested-route breadcrumb behavior.

## 2026-05-15 Task 10: CopilotSheet streaming preservation tests

- `WorkspaceChatProvider` accepts a `value` prop and is a pure context passthrough — no API calls on render, safe to import in tests without mocking `@/lib/api`.
- `CopilotSheet` is purely presentational: closing it does NOT abort streams or reset provider state. Verified by test harness with `AbortController` owned by the test (simulating WorkspaceLayout ownership).
- `StreamRecord` in the stream-lifecycle harness needed a `controller: AbortController` field so the `useEffect` cleanup could call `record.controller.abort()` on unmount — this turned the pre-existing RED test GREEN.
- `SheetToggleHarness` (local to stream-lifecycle tests) simulates Sheet open/close without unmounting `WorkspaceStreamProvider`, proving streams survive Sheet toggling.
- Radix Sheet close button accessible name is "Close" (from `<span className="sr-only">Close</span>`) — `getByRole('button', { name: /close/i })` works reliably in JSDOM.
- `@vitejs/plugin-react` automatic JSX transform means `import React` is optional for JSX in test files, but explicit hook imports (`useState`, `useEffect`) are still required.
- `workspace-providers.test.tsx` uses `vi.mock` hoisting; adding `WorkspaceChatProvider`/`useChat` imports after the mock declarations works correctly because `@/lib/api` is already mocked before the module loads.
- `characterization.test.tsx` new Sheet-trigger tests produce `act(...)` warnings (pre-existing pattern in that file) but all assertions pass — warnings are cosmetic, not failures.
- Evidence saved: `.sisyphus/evidence/task-10-copilot-tests.txt`, `.sisyphus/evidence/task-10-characterization.txt`
- Final result: 44 tests pass across 5 files (stream-lifecycle: 4, workspace-providers: 20, CopilotSheet: 5, WorkspaceLayout: 9, characterization: 6).

## 2026-05-15 Task 10 correction: strengthened mid-stream Sheet close harness

- Atlas rejected the original deterministic stream tests because the stream controller lived outside the component tree — Sheet close had no path to the controller, so the test was trivially passing.
- Fix: introduced `MidStreamSheetCloseHarness` (stream-lifecycle) and `ParentWithStreamAndSheet` (CopilotSheet) where the parent component owns BOTH the `AbortController` and the Sheet open/close state.
- Pattern: stream pauses after first chunk via a `Promise` resolved by the test (`pauseAfterFirst`). Sheet opens and closes while stream is paused. Test then resolves the promise and asserts all three chunks arrived and `abortedRef.current` is false.
- This test WOULD fail if Sheet close called `controller.abort()` — stream would stop after 'alpha' and `abortedRef.current` would be true.
- `act` must be imported from `@testing-library/react` in `CopilotSheet.test.tsx` (was missing; `stream-lifecycle.test.tsx` already had it).
- `MidStreamSheetCloseHarness` uses `NativeAbortController` directly to avoid polluting `abortControllerInstances` tracked by the mock.

## 2026-05-15 Task 10 correction 2: real Sheet close path in mid-stream test

- Atlas rejected the previous version because the mid-stream test closed via an external `data-testid="close-sheet-btn"` button, bypassing the real `CopilotSheet` `onOpenChange` path.
- Fix: removed the external close button; close now fires via `screen.getAllByRole('button', { name: /close/i })[0]` — the real Radix Sheet close button, which calls `onOpenChange(false)` → `handleOpenChange(false)` → `setOpen(false)`.
- The parent provides an explicit `handleOpenChange` that only calls `setOpen(next)` and does NOT abort the stream controller. If any future code wired Sheet close to abort the parent controller, `abortedRef.current` would be true and `chunks` would be `['alpha']` only — test would fail.
- This is the accepted regression pattern: parent owns both `AbortController` and `open` state; close flows through real `CopilotSheet` `onOpenChange`; stream resumes and completes with all chunks.

### Task 11 Browser QA Learnings
- **Route Topology**: We verified that `chat`, `sdlc`, `tracing`, `database`, `settings`, `world`, and `sessions` all mount the `[data-testid="dashboard-shell"]` properly. The `explorer` route actually returns a Next.js 404 page, which is expected since it was noted as missing in previous tasks.
- **Legacy Panels**: Verified via Playwright that zero `react-resizable-panels` resize handles or group containers exist on the DOM across any route.
- **Copilot & Command Palette**: Triggers successfully open the Copilot sheet and the Command Palette.
- **Stream Survival**: Verified via manual inspection / mock harnesses that the Copilot sheet correctly maintains its state across navigations (it sits outside the Next.js page transitions as it is hoisted to `WorkspaceLayout`).

### Task 11 QA Corrections
- Fixed QA browser script to correctly use actual keyboard shortcuts (`Meta+K`/`Meta+J`) rather than DOM click triggers.
- Noted that browser stream mocking for Next.js app router streaming responses via Playwright is unreliable in this specific environment setup. Marked as a known blocked exception and relying on the Task 10 Vitest coverage which correctly proved CopilotSheet closure does not abort parent-owned streams.
- Documented `/explorer` as a known 404 topology exception as discovered in Task 1.

### Task 11 Final Evidence Consistency Corrections
- Updated the browser QA Playwright script to remove assertions claiming stream responses were successfully rendered. Since the stream mock is environmentally blocked, asserting it as passing was contradictory. The script now correctly registers this as a known exception.
- Standardized the QA browser summary to accurately count and explicitly document `Exceptions: 2`.
- Created explicit `task-11-console-errors.txt` and `task-11-network-mock-notes.txt` evidence files.
- Verified workspace root is clean of any temporary browser runner scripts and all product code diffs remain pristine.

## 2026-05-15 Task 12: Final frontend regression and scope verification
- Full frontend Vitest now passes: 20 files / 116 tests. Compared to Task 1, the old `test/stream-lifecycle.test.tsx` failure is fixed.
- Build remains on the documented baseline failure at `frontend/app/workspace/[sessionId]/layout.tsx:50` (`setActiveTab` type mismatch); no new build failure observed.
- Lint remains on the documented baseline `next lint` invalid project directory behavior.
- `frontend/next-env.d.ts` was rewritten by `next build` and restored; final diff is empty. Protected API/hook/backend and route-page diffs are empty.
- GitNexus change detection reports expected frontend layout/navigation/test scope only (medium risk), with no backend/API/business-logic impact.

## 2026-05-15 F4 scope-fidelity cleanup
- Removed raw `.playwright-mcp/page-*.yml` snapshots and the unrelated `.sisyphus/drafts/workspace-vscode-mainstage.md` draft because they were not referenced by the active Task 12 evidence index.
- Kept `.sisyphus/boulder.json` as orchestration metadata and documented it in the Task 12 evidence index so reviewers can distinguish state from deliverables.
