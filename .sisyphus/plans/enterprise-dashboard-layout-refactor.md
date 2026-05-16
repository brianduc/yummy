# Enterprise Dashboard Layout Refactor

## TL;DR

> **Quick Summary**: Replace the current 3-pane all-in-one workspace shell with a classic enterprise dashboard shell: expandable left sidebar, global header, route-based main content, and AI Copilot in a right-side Sheet. Preserve all page business logic, API calls, chat/streaming behavior, and individual page content.
>
> **Deliverables**:
> - Persistent dashboard shell for workspace routes
> - Expandable/collapsible sidebar using existing workspace navigation routes
> - Global header with breadcrumbs, Cmd/Ctrl+K Command Palette trigger, and Cmd/Ctrl+J AI Copilot trigger
> - AI Copilot Sheet wrapping the existing `AICopilot` while preserving `WorkspaceChatProvider` lifetime
> - Tests-after coverage for sidebar, header, Copilot Sheet, route behavior, and streaming preservation
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 5 waves
> **Critical Path**: T1 → T2 → T5/T6/T7 → T9 → T11 → T12 → F1-F4

---

## Context

### Original Request
Refactor the global layout away from the 3-column all-in-one IDE layout into a scalable enterprise dashboard layout with one expandable sidebar and one main content area, while preserving routes, page logic, API calls, and AI Copilot streaming behavior.

### Interview Summary
**Key Discussions**:
- The user explicitly forbade deleting or modifying core business logic, API calls, or individual page content such as `/sdlc` and `/settings`.
- Layout changes should primarily target global/workspace layout and navigation components under the Next.js App Router paradigm.
- Automated test strategy: **tests-after**.
- UX decisions: use existing Command Palette for Cmd/Ctrl+K, use Cmd/Ctrl+J for Copilot trigger, do not persist sidebar collapsed state, skip adding frontend tests to CI in this work.

**Research Findings**:
- `frontend/app/layout.tsx` is minimal and not the current AIO shell.
- `frontend/app/workspace/[sessionId]/layout.tsx` wraps `/workspace/:sessionId/*` routes and renders `WorkspaceLayout`; it is the likely persistent shell target, but route topology must be verified first.
- `frontend/components/workspace/WorkspaceLayout.tsx` is the 3-pane `react-resizable-panels` implementation.
- `frontend/components/workspace/ActivityBar.tsx` contains the current navigation model (`ITEMS`).
- AI Copilot UI is `frontend/components/workspace/AICopilot.tsx`; chat state/streaming lives in `frontend/hooks/useWorkspaceChat.tsx` and `frontend/lib/api.ts`.
- `WorkspaceChatProvider` must remain mounted outside the Sheet to prevent stream aborts and chat state loss.
- Frontend test infrastructure exists: Vitest + Testing Library + jsdom.

### Metis Review
**Identified Gaps** (addressed):
- Route topology must be verified before deciding the exact shell mount point.
- Add strict protected-path deny-list and post-refactor diff checks.
- Verify shadcn Sheet availability before planning implementation details.
- Include baseline tests/build before edits.
- Make force-mounted/presentation-only Copilot Sheet behavior explicit.
- Add Playwright QA for close-mid-stream, navigation during stream, keyboard shortcuts, and no 3-pane resize handles.

---

## Work Objectives

### Core Objective
Convert the workspace UI shell from a 3-pane AIO layout to a route-oriented enterprise dashboard shell while preserving existing functional behavior and page ownership boundaries.

### Concrete Deliverables
- Dashboard shell composition replacing the 3-pane visual structure.
- Sidebar component with expanded/collapsed modes and active-route highlighting.
- Centralized navigation model extracted from current ActivityBar route data.
- Global header with breadcrumbs, Command Palette trigger, and AI Copilot trigger.
- AI Copilot Sheet wrapper around existing Copilot UI.
- Tests-after coverage and agent-executed QA evidence.

### Definition of Done
- [ ] `cd frontend && npm run test` passes after test updates.
- [ ] `cd frontend && npm run build` succeeds.
- [ ] Browser QA confirms every sidebar route renders without console errors.
- [ ] AI Copilot Sheet close/open does not abort chat streaming or lose chat history.
- [ ] Protected page/business-logic files show no unintended diffs.

### Must Have
- Full viewport shell: `h-screen w-full flex overflow-hidden`.
- Left sidebar collapsed width approximately `64px`, expanded width approximately `256px`.
- Collapsed sidebar shows icons only with hover tooltips.
- Expanded sidebar shows icons and labels.
- Navigation uses Next.js `<Link>` and highlights active route using current pathname.
- Main area uses `flex-1 flex flex-col min-w-0`.
- Global header uses `h-14 border-b` with breadcrumbs on left and triggers on right.
- Page content wrapper uses `flex-1 overflow-y-auto p-6` and renders `{children}`.
- AI Copilot lives in a right-side `Sheet` (`side="right"`) and remains functionally equivalent.

### Must NOT Have (Guardrails)
- Do not rewrite individual page contents, panels, hooks, API calls, backend code, or streaming internals.
- Do not introduce Redux/Zustand/Jotai or broad state-management rewrites.
- Do not add new routes or migrate every tab into file-based routes in this pass.
- Do not delete existing tests; only update tests whose assertions literally change with the shell.
- Do not add frontend CI changes; user explicitly skipped CI task.
- Do not persist sidebar expansion state; state resets on reload.

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** - ALL verification is agent-executed. No exceptions.
> Acceptance criteria requiring "user manually tests/confirms" are FORBIDDEN.

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: Tests-after
- **Framework**: Vitest + Testing Library + jsdom
- **If TDD**: Not selected. Implementation tasks add/update tests after component/shell changes.

### QA Policy
Every task MUST include agent-executed QA scenarios. Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Frontend/UI**: Use Playwright - navigate, interact, assert DOM, screenshot.
- **TUI/CLI**: Use interactive_bash (tmux) only for ongoing dev-server sessions.
- **API/Backend**: Out of scope except mocked frontend stream verification.
- **Library/Module**: Use Bash commands from `frontend/` for Vitest/build/lint checks.

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 0 (Discovery / safety gate):
├── Task 1: Route topology, baseline tests/build, impact analysis, Sheet availability [deep]

Wave 1 (Foundation - can start after Task 1):
├── Task 2: Extract canonical navigation model [quick]
├── Task 3: Add sidebar component in isolation [visual-engineering]
├── Task 4: Add breadcrumbs/header component in isolation [visual-engineering]
└── Task 5: Add Copilot Sheet wrapper in isolation [visual-engineering]

Wave 2 (Shell composition - after Wave 1):
├── Task 6: Replace 3-pane WorkspaceLayout shell with dashboard composition [deep]
├── Task 7: Wire command palette and keyboard shortcuts [quick]
└── Task 8: Ensure route/page content preservation and duplicate-shell cleanup [deep]

Wave 3 (Tests-after - after Wave 2):
├── Task 9: Update layout/navigation tests [quick]
├── Task 10: Add Copilot Sheet and stream-preservation tests [unspecified-high]
└── Task 11: Add browser QA harness/checks for dashboard flows [visual-engineering]

Wave 4 (Regression verification):
├── Task 12: Full frontend regression, build, lint, protected diff, GitNexus changes [deep]

Wave FINAL (After ALL tasks — 4 parallel reviews, then user okay):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high + playwright)
└── Task F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay

Critical Path: Task 1 → Task 2 → Task 6 → Task 8 → Task 10 → Task 12 → F1-F4 → user okay
Parallel Speedup: ~55% faster than sequential
Max Concurrent: 4 (Waves 1 and 3)
```

### Dependency Matrix

| Task | Blocked By | Blocks | Wave |
|---|---|---|---|
| 1 | None | 2,3,4,5 | 0 |
| 2 | 1 | 3,6,9 | 1 |
| 3 | 1,2 | 6,9,11 | 1 |
| 4 | 1 | 6,7,9,11 | 1 |
| 5 | 1 | 6,10,11 | 1 |
| 6 | 2,3,4,5 | 7,8,9,10,11 | 2 |
| 7 | 4,6 | 9,11 | 2 |
| 8 | 6 | 9,10,12 | 2 |
| 9 | 6,7,8 | 12 | 3 |
| 10 | 5,6,8 | 12 | 3 |
| 11 | 3,4,5,6,7 | 12 | 3 |
| 12 | 8,9,10,11 | F1,F2,F3,F4 | 4 |

### Agent Dispatch Summary

- **Wave 0**: 1 task — T1 → `deep`
- **Wave 1**: 4 tasks — T2 → `quick`, T3 → `visual-engineering`, T4 → `visual-engineering`, T5 → `visual-engineering`
- **Wave 2**: 3 tasks — T6 → `deep`, T7 → `quick`, T8 → `deep`
- **Wave 3**: 3 tasks — T9 → `quick`, T10 → `unspecified-high`, T11 → `visual-engineering`
- **Wave 4**: 1 task — T12 → `deep`
- **FINAL**: 4 review tasks — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high` + `playwright`, F4 → `deep`

---

## TODOs

> Implementation + Test = ONE Task. Never separate.
> EVERY task MUST have: Recommended Agent Profile + Parallelization info + QA Scenarios.

- [x] 1. Route topology, baseline, impact analysis, and Sheet availability safety gate

  **What to do**:
  - Map actual App Router pages under `frontend/app/**/page.tsx` and confirm whether the dashboard shell belongs in `frontend/app/workspace/[sessionId]/layout.tsx`, `frontend/app/layout.tsx`, or a new route group.
  - Record the current frontend baseline by running tests/build before edits.
  - Run GitNexus impact analysis before editing shared symbols: `WorkspaceLayout`, `ActivityBar`, `MainStage`, `ContextPanel`, `AICopilot`, and `WorkspaceChatProvider`.
  - Use LSP references for `WorkspaceLayout` and `ActivityBar` imports to find consumers.
  - Verify whether `frontend/components/ui/sheet.tsx` already exists. If not, record a constrained prerequisite: add only the shadcn Sheet primitive, no broad dependency bumps.
  - Confirm `WorkspaceChatProvider` mount point and document how the plan will keep it mounted at the same or higher level.

  **Must NOT do**:
  - Do not edit application source code in this task beyond recording evidence if executor needs a markdown note.
  - Do not install dependencies unless Sheet availability check proves it is missing and the executor explicitly scopes the install to Sheet only.
  - Do not modify page/panel/hook/API files.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: This is the safety-critical discovery gate for a high-risk layout refactor.
  - **Skills**: [`gitnexus-refactoring`]
    - `gitnexus-refactoring`: Required to satisfy project rules for symbol impact and refactor blast-radius mapping.
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: No UI implementation in this discovery task.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 0
  - **Blocks**: Tasks 2, 3, 4, 5
  - **Blocked By**: None

  **References**:
  **Pattern References**:
  - `frontend/app/workspace/[sessionId]/layout.tsx` - Existing route shell and provider composition to preserve.
  - `frontend/components/workspace/WorkspaceLayout.tsx` - Existing 3-pane shell to replace.
  - `frontend/components/workspace/ActivityBar.tsx` - Existing route navigation source.

  **API/Type References**:
  - `frontend/hooks/useWorkspaceChat.tsx` - Provider/hook lifetime that must not be disrupted.
  - `frontend/hooks/useWorkspaceContracts.ts` - Workspace context contracts.

  **Test References**:
  - `frontend/package.json` - `npm run test`, `npm run build`, `npm run lint` scripts.
  - `frontend/vitest.config.ts` - Vitest/jsdom config.

  **External References**:
  - GitNexus project rule in `AGENTS.md` - Impact analysis before editing symbols.

  **Acceptance Criteria**:
  - [ ] Route topology map is captured in `.sisyphus/evidence/task-1-route-topology.md`.
  - [ ] Baseline command output captured: `cd frontend && npm run test`.
  - [ ] Baseline command output captured: `cd frontend && npm run build`.
  - [ ] Baseline command output captured: `cd frontend && npm run lint` or a documented note if script is unavailable/fails before edits.
  - [ ] GitNexus impact outputs captured for all planned shared symbols.
  - [ ] Sheet availability captured with exact file path or missing-component note.
  - [ ] `WorkspaceChatProvider` mount point documented with file path and planned preservation approach.

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Discovery baseline is reproducible
    Tool: Bash
    Preconditions: Repository clean enough to run frontend commands; dependencies installed or install step documented by executor.
    Steps:
      1. Run `cd frontend && npm run test` and save terminal output.
      2. Run `cd frontend && npm run build` and save terminal output.
      3. Run `cd frontend && npm run lint` and save terminal output, or record exact missing-script/failure text.
    Expected Result: Baseline pass/fail state is recorded before any implementation edits.
    Failure Indicators: No evidence file, missing command output, or baseline captured after source edits.
    Evidence: .sisyphus/evidence/task-1-baseline.txt

  Scenario: Impact analysis gate completed
    Tool: GitNexus MCP
    Preconditions: GitNexus index available for repo `yummy`.
    Steps:
      1. Run upstream impact analysis for `WorkspaceLayout`, `ActivityBar`, `MainStage`, `ContextPanel`, `AICopilot`, and `WorkspaceChatProvider`.
      2. Record risk level, direct callers, affected processes, and any HIGH/CRITICAL warning.
    Expected Result: Every planned shared symbol has an impact entry before implementation.
    Failure Indicators: Any symbol lacks impact output, or HIGH/CRITICAL risk is ignored without escalation.
    Evidence: .sisyphus/evidence/task-1-impact-analysis.md
  ```

  **Evidence to Capture**:
  - [ ] `task-1-route-topology.md`
  - [ ] `task-1-baseline.txt`
  - [ ] `task-1-impact-analysis.md`
  - [ ] `task-1-sheet-availability.md`

  **Commit**: NO
  - Message: N/A
  - Files: Evidence only
  - Pre-commit: N/A

- [x] 2. Extract canonical workspace navigation model

  **What to do**:
  - Extract the current `ActivityBar` navigation data into a shared navigation module, e.g. `frontend/lib/workspace-navigation.ts` or an equivalent project-conventional location.
  - Preserve current labels, route suffixes, icons, and index-route semantics.
  - Keep ActivityBar behavior equivalent until shell swap is complete by having it consume the shared model.
  - Include breadcrumb metadata in the shared model if practical, or a separate route-label map used by breadcrumbs.

  **Must NOT do**:
  - Do not change actual route destinations.
  - Do not add or remove nav items unless route topology evidence proves an item is invalid.
  - Do not rewrite ActivityBar presentation beyond consuming the extracted data.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Mostly a small data extraction with references/tests.
  - **Skills**: [`gitnexus-refactoring`]
    - `gitnexus-refactoring`: Needed because shared navigation symbol extraction affects import/caller relationships.
  - **Skills Evaluated but Omitted**:
    - `ui-ux-pro-max`: No new visual design work in this task.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 3, 4, 5 after Task 1, though Task 3 depends on this output before final integration)
  - **Blocks**: Tasks 3, 6, 9
  - **Blocked By**: Task 1

  **References**:
  **Pattern References**:
  - `frontend/components/workspace/ActivityBar.tsx` - Current `ITEMS` route definitions and active-state logic.
  - `frontend/components/workspace/MainStage.tsx` - In-page tab labels that may inform breadcrumb labels for explorer/wiki/insights-like views.

  **API/Type References**:
  - `frontend/tsconfig.json` - Confirm `@/` alias for imports.

  **Test References**:
  - `frontend/app/workspace/[sessionId]/navigation.test.tsx` - Existing route/navigation assertion style.
  - `frontend/test/activity-bar-routing.test.tsx` - Existing activity routing tests.

  **Acceptance Criteria**:
  - [ ] Shared navigation module exists and exports canonical nav items.
  - [ ] `ActivityBar` uses shared nav data without route behavior changes.
  - [ ] Route suffixes and index route behavior match pre-refactor evidence.
  - [ ] Relevant existing navigation tests pass or are updated only for import-location changes.

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Navigation model preserves existing routes
    Tool: Bash
    Preconditions: Task 1 topology evidence exists.
    Steps:
      1. Run `cd frontend && npx vitest run app/workspace/[sessionId]/navigation.test.tsx test/activity-bar-routing.test.tsx`.
      2. Inspect exported nav model and compare labels/routes against Task 1 route topology evidence.
    Expected Result: Existing navigation behavior passes and nav model contains explorer, sdlc, chat/index, tracing, database, settings, world, sessions as applicable.
    Failure Indicators: Missing route, changed URL, duplicate nav item, or failing route assertion.
    Evidence: .sisyphus/evidence/task-2-navigation-model.txt

  Scenario: Invalid route additions are absent
    Tool: Bash
    Preconditions: Shared navigation model created.
    Steps:
      1. Search changed files for new route strings not present in Task 1 topology map.
      2. Record any route additions with justification.
    Expected Result: No unplanned routes are introduced.
    Failure Indicators: New `/sdlc` top-level route, deleted workspace prefix, or unexplained route string.
    Evidence: .sisyphus/evidence/task-2-no-route-creep.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-2-navigation-model.txt`
  - [ ] `task-2-no-route-creep.txt`

  **Commit**: YES
  - Message: `refactor(frontend): extract workspace navigation model`
  - Files: `frontend/components/workspace/ActivityBar.tsx`, shared nav module, relevant tests
  - Pre-commit: `cd frontend && npx vitest run app/workspace/[sessionId]/navigation.test.tsx test/activity-bar-routing.test.tsx`

- [x] 3. Build expandable dashboard sidebar component

  **What to do**:
  - Add an isolated sidebar component that consumes the shared navigation model.
  - Implement expanded width near `256px` and collapsed width near `64px`.
  - Use lucide icons in both states; show text labels only when expanded.
  - Add hover tooltips for collapsed nav items.
  - Use Next.js `<Link>` for navigation and `usePathname` for active-route highlighting.
  - Add a toggle button with accessible label.
  - Default state: expanded on first load; no localStorage persistence.

  **Must NOT do**:
  - Do not implement global state or persistent storage for sidebar expansion.
  - Do not change route/page content.
  - Do not redesign all panel contents or introduce unrelated styling systems.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI shell component with responsive, accessibility, and interaction requirements.
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Useful for polished accessible sidebar interaction and visual consistency.
  - **Skills Evaluated but Omitted**:
    - `gitnexus-refactoring`: Impact gate already completed in Task 1; this task is component creation.

  **Parallelization**:
  - **Can Run In Parallel**: YES, after Task 2 nav API is available
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 6, 9, 11
  - **Blocked By**: Tasks 1, 2

  **References**:
  **Pattern References**:
  - `frontend/components/workspace/ActivityBar.tsx` - Existing icon/nav active behavior to preserve semantically.
  - `frontend/components/ui/button.tsx` - Existing button primitive style.
  - `frontend/components/ui/tooltip.tsx` - Tooltip primitive if present; otherwise follow existing UI primitive patterns.

  **API/Type References**:
  - Shared navigation module from Task 2 - Canonical nav item structure.

  **Test References**:
  - `frontend/test/workspace-layout.test.tsx` - Current shell test style.
  - `frontend/app/workspace/[sessionId]/navigation.test.tsx` - Router mock style.

  **Acceptance Criteria**:
  - [ ] Sidebar renders with `data-testid="app-sidebar"`.
  - [ ] Expanded sidebar includes nav labels.
  - [ ] Collapsed sidebar hides labels but keeps icons and accessible names/tooltips.
  - [ ] Toggle changes width/class state without localStorage writes.
  - [ ] Active route is highlighted based on pathname.

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Sidebar expands and collapses without persistence
    Tool: Playwright
    Preconditions: Frontend dev server running with a valid workspace session route.
    Steps:
      1. Navigate to `http://localhost:3000/workspace/test-session-id`.
      2. Assert `[data-testid="app-sidebar"]` is visible.
      3. Assert sidebar width is within 240-272px and text `SDLC` is visible.
      4. Click `[data-testid="sidebar-toggle"]`.
      5. Assert sidebar width is within 56-80px and text labels are not visible while icons remain visible.
      6. Reload the page.
      7. Assert sidebar returns to expanded width and labels are visible.
    Expected Result: Sidebar toggles for current page lifetime only and resets after reload.
    Failure Indicators: localStorage persistence, missing labels in expanded mode, hidden icons, or inaccessible toggle.
    Evidence: .sisyphus/evidence/task-3-sidebar-toggle.png

  Scenario: Collapsed nav exposes tooltip/accessibility label
    Tool: Playwright
    Preconditions: Sidebar is collapsed.
    Steps:
      1. Hover the SDLC nav icon `[data-testid="sidebar-nav-sdlc"]`.
      2. Assert tooltip or accessible name contains exact text `SDLC` within 2s.
      3. Press Tab until the SDLC nav item is focused and assert focus ring/outline is visible.
    Expected Result: Collapsed navigation remains understandable and keyboard reachable.
    Failure Indicators: No tooltip/accessibility label, focus cannot reach nav item, or label text is wrong.
    Evidence: .sisyphus/evidence/task-3-sidebar-tooltip.png
  ```

  **Evidence to Capture**:
  - [ ] `task-3-sidebar-toggle.png`
  - [ ] `task-3-sidebar-tooltip.png`

  **Commit**: YES
  - Message: `feat(frontend): add dashboard sidebar component`
  - Files: Sidebar component, sidebar tests if added
  - Pre-commit: `cd frontend && npm run test -- --run`

- [x] 4. Build global header with breadcrumbs and action triggers

  **What to do**:
  - Add an isolated global header component with `h-14 border-b`.
  - Left side renders dynamic breadcrumbs derived from pathname and the shared nav/breadcrumb model.
  - Right side renders Command Palette trigger labeled with `Cmd+K`/`Ctrl+K` and AI Copilot trigger labeled with `AI Copilot`.
  - Ensure header can receive callbacks/controlled props for opening Command Palette and Copilot Sheet.
  - Preserve existing theme classes and spacing conventions.

  **Must NOT do**:
  - Do not redesign or replace the existing Command Palette internals.
  - Do not add global header to non-target routes until route topology confirms intended shell scope.
  - Do not hard-code session IDs or absolute URLs in breadcrumbs.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Header/breadcrumb component requires visual polish and accessibility.
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Helps produce a clean enterprise-dashboard header without over-designing.
  - **Skills Evaluated but Omitted**:
    - `ui-ux-pro-max`: Full design intelligence is unnecessary; requirements are explicit.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 6, 7, 9, 11
  - **Blocked By**: Task 1

  **References**:
  **Pattern References**:
  - `frontend/components/workspace/MainStage.tsx` - Existing Command Palette trigger/header-adjacent behavior to preserve or relocate.
  - `frontend/components/workspace/CommandPalette.tsx` - Existing palette component and keyboard behavior.
  - `frontend/components/ui/button.tsx` - Button styling convention.

  **API/Type References**:
  - Shared navigation/breadcrumb model from Task 2 - Route label source.

  **Test References**:
  - `frontend/test/workspace-layout.test.tsx` - Shell test style.
  - `frontend/app/workspace/[sessionId]/characterization.test.tsx` - Characterization expectations to update.

  **Acceptance Criteria**:
  - [ ] Header renders with `data-testid="app-header"` and expected height/border classes.
  - [ ] Breadcrumbs update for `/workspace/:sessionId`, `/sdlc`, `/settings`, `/database`, `/world`, `/sessions`, and `/tracing` routes as applicable.
  - [ ] Command Palette trigger has `data-testid="command-palette-trigger"` and calls provided open handler.
  - [ ] AI Copilot trigger has `data-testid="ai-copilot-trigger"` and calls provided open handler.

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Header breadcrumbs reflect active route
    Tool: Playwright
    Preconditions: Dashboard shell wired or component test harness available.
    Steps:
      1. Navigate to `http://localhost:3000/workspace/test-session-id/sdlc`.
      2. Assert `[data-testid="app-header"]` is visible.
      3. Assert `[data-testid="breadcrumbs"]` contains exact text `SDLC`.
      4. Navigate to `http://localhost:3000/workspace/test-session-id/settings`.
      5. Assert breadcrumbs contain exact text `Settings`.
    Expected Result: Breadcrumb label tracks current route segment.
    Failure Indicators: Breadcrumb stays stale, shows raw `[sessionId]`, or is missing.
    Evidence: .sisyphus/evidence/task-4-breadcrumbs.png

  Scenario: Header action triggers are keyboard accessible
    Tool: Playwright
    Preconditions: Header rendered.
    Steps:
      1. Press Tab until `[data-testid="command-palette-trigger"]` is focused.
      2. Press Enter and assert command palette opens with `[role="dialog"]` or existing palette test id.
      3. Close palette with Escape.
      4. Focus `[data-testid="ai-copilot-trigger"]` and press Enter.
      5. Assert Copilot Sheet open state is visible.
    Expected Result: Both header actions work by keyboard and return focus predictably after close.
    Failure Indicators: Trigger not focusable, no dialog opens, focus trap breaks, or Escape fails.
    Evidence: .sisyphus/evidence/task-4-header-actions.png
  ```

  **Evidence to Capture**:
  - [ ] `task-4-breadcrumbs.png`
  - [ ] `task-4-header-actions.png`

  **Commit**: YES
  - Message: `feat(frontend): add dashboard header`
  - Files: Header/breadcrumb component and tests
  - Pre-commit: `cd frontend && npm run test -- --run`

- [x] 5. Build AI Copilot Sheet wrapper without moving chat state

  **What to do**:
  - Add a `CopilotSheet` component that wraps the existing `AICopilot` component in a shadcn/Radix Sheet with `side="right"`.
  - Keep `WorkspaceChatProvider` and `useWorkspaceChat` outside the Sheet and at the same or higher tree level than before.
  - Use controlled `open`/`onOpenChange` props so the global header button and keyboard shortcut can open it.
  - Use `forceMount` or equivalent if available/needed so Sheet content does not cause local Copilot UI resets; regardless, provider must remain mounted outside Sheet.
  - Ensure closing Sheet does not call chat abort, reset history, or recreate `AbortController`.

  **Must NOT do**:
  - Do not edit `frontend/hooks/useWorkspaceChat.tsx` streaming internals.
  - Do not edit `frontend/lib/api.ts`.
  - Do not replace `AICopilot` with a new chat implementation.
  - Do not add extra Copilot features such as docking, resizing, or multiple chat tabs.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Drawer UI integration and accessibility with strict state-preservation constraints.
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Relevant for a polished Sheet/trigger interaction.
  - **Skills Evaluated but Omitted**:
    - `gitnexus-refactoring`: Impact gate already completed; no symbol rename/extraction expected here.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 6, 10, 11
  - **Blocked By**: Task 1

  **References**:
  **Pattern References**:
  - `frontend/components/workspace/AICopilot.tsx` - Existing Copilot UI to wrap, not rewrite.
  - `frontend/components/workspace/ChatPanel.tsx` - Related chat UI and command patterns.
  - `frontend/components/ui/sheet.tsx` - Sheet primitive if present.

  **API/Type References**:
  - `frontend/hooks/useWorkspaceChat.tsx` - Context/provider state that must remain outside Sheet.
  - `frontend/lib/api.ts:askStream` - Streaming API to preserve indirectly.

  **Test References**:
  - `frontend/test/stream-lifecycle.test.tsx` - Existing streaming lifecycle test style.
  - `frontend/test/workspace-providers.test.tsx` - Provider wiring tests.

  **Acceptance Criteria**:
  - [ ] `CopilotSheet` opens from controlled prop and renders existing `AICopilot`.
  - [ ] `WorkspaceChatProvider` is not mounted inside `CopilotSheet`.
  - [ ] Closing Sheet does not call abort/reset chat state.
  - [ ] Sheet uses `side="right"` and has accessible title/description.
  - [ ] Existing Copilot input/history behavior remains available when open.

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Copilot Sheet opens and closes without losing history
    Tool: Playwright
    Preconditions: Frontend dev server running with mocked/stable chat data or seeded session chat history.
    Steps:
      1. Navigate to `http://localhost:3000/workspace/test-session-id`.
      2. Click `[data-testid="ai-copilot-trigger"]`.
      3. Assert `[data-testid="copilot-sheet"]` is visible and contains text `AI Copilot`.
      4. Type `hello copilot` into the existing Copilot input selector.
      5. Submit the message and wait for an assistant message or mocked response text `Hello from mocked stream`.
      6. Close the Sheet with Escape or close button.
      7. Reopen with `[data-testid="ai-copilot-trigger"]`.
      8. Assert `hello copilot` and `Hello from mocked stream` are still visible.
    Expected Result: Chat history persists across Sheet close/reopen.
    Failure Indicators: History disappears, provider remounts, stream aborts, or input submit stops working.
    Evidence: .sisyphus/evidence/task-5-copilot-history.png

  Scenario: Closing Sheet does not abort active stream
    Tool: Playwright
    Preconditions: AI streaming endpoint mocked to return chunks `alpha`, ` beta`, ` gamma` over time.
    Steps:
      1. Open Copilot Sheet.
      2. Submit prompt `stream test`.
      3. Wait until assistant content contains `alpha`.
      4. Close the Sheet before `gamma` arrives.
      5. Wait 2 seconds.
      6. Reopen the Sheet.
      7. Assert assistant content contains exact combined text `alpha beta gamma`.
    Expected Result: Stream continues while Sheet is closed.
    Failure Indicators: Content stops at `alpha`, abort error appears, busy flag remains stuck, or history resets.
    Evidence: .sisyphus/evidence/task-5-stream-survives-close.webm
  ```

  **Evidence to Capture**:
  - [ ] `task-5-copilot-history.png`
  - [ ] `task-5-stream-survives-close.webm`

  **Commit**: YES
  - Message: `feat(frontend): wrap ai copilot in sheet`
  - Files: `CopilotSheet` component, Sheet primitive only if missing, relevant tests
  - Pre-commit: `cd frontend && npm run test -- --run`

- [x] 6. Replace 3-pane WorkspaceLayout shell with dashboard composition

  **What to do**:
  - Replace the visual body of `WorkspaceLayout` with the dashboard layout: `h-screen w-full flex overflow-hidden`.
  - Left: render the new sidebar.
  - Right: render `flex-1 flex flex-col min-w-0` with global header and `flex-1 overflow-y-auto p-6` children/main area.
  - Remove visible use of `react-resizable-panels` for the main 3-pane shell and ensure resize handles are absent.
  - Keep prop contracts/adapters stable enough that callers do not need business-logic rewrites.
  - Render `CopilotSheet` at the shell level with state controlled by header trigger/shortcut wiring.
  - Preserve `mainStageChildren` / `{children}` behavior exactly according to route topology findings.

  **Must NOT do**:
  - Do not move API calls, SDLC logic, chat hooks, scan polling, or session fetching into new components.
  - Do not edit individual route page content.
  - Do not delete `MainStage`/panel internals unless route topology proves they are unused shell-only scaffolding and impact analysis approves.
  - Do not keep the permanent right-side Copilot pane.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: This is the main high-risk shell swap that must preserve contracts and state boundaries.
  - **Skills**: [`gitnexus-refactoring`, `frontend-ui-ux`]
    - `gitnexus-refactoring`: Ensures symbol/caller safety and expected scope.
    - `frontend-ui-ux`: Ensures dashboard shell layout quality without page redesign.
  - **Skills Evaluated but Omitted**:
    - `ui-ux-pro-max`: The design is specified; no need for broad redesign exploration.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: Tasks 7, 8, 9, 10, 11
  - **Blocked By**: Tasks 2, 3, 4, 5

  **References**:
  **Pattern References**:
  - `frontend/components/workspace/WorkspaceLayout.tsx` - Existing shell body and prop surface.
  - `frontend/app/workspace/[sessionId]/layout.tsx` - Persistent route layout and provider composition.
  - `frontend/app/workspace/[sessionId]/page.tsx` - Page owner that must not be rewritten; inspect only for layout usage/duplicate shell cleanup.

  **API/Type References**:
  - `frontend/hooks/useWorkspaceContracts.ts` - Existing workspace context types.
  - `frontend/hooks/useWorkspaceSession.ts` - Session lifecycle to preserve.

  **Test References**:
  - `frontend/test/workspace-layout.test.tsx` - Shell layout test to update.
  - `frontend/app/workspace/[sessionId]/characterization.test.tsx` - Characterization expectations.

  **Acceptance Criteria**:
  - [ ] Dashboard shell root has `data-testid="dashboard-shell"` and class behavior equivalent to `h-screen w-full flex overflow-hidden`.
  - [ ] Main region has `data-testid="dashboard-main"` and `flex-1 flex flex-col min-w-0` behavior.
  - [ ] Content region has `data-testid="dashboard-content"` and `flex-1 overflow-y-auto p-6` behavior.
  - [ ] Permanent right Copilot pane is removed; Copilot only appears via Sheet.
  - [ ] No 3-pane resize handle elements remain in the rendered shell.
  - [ ] Existing workspace providers and route children still render once.

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Dashboard shell replaces 3-pane layout
    Tool: Playwright
    Preconditions: Frontend dev server running after shell swap.
    Steps:
      1. Navigate to `http://localhost:3000/workspace/test-session-id`.
      2. Assert `[data-testid="dashboard-shell"]` is visible.
      3. Assert `[data-testid="app-sidebar"]`, `[data-testid="app-header"]`, and `[data-testid="dashboard-content"]` are visible.
      4. Evaluate `document.querySelectorAll('[data-panel-resize-handle-id]').length`.
      5. Assert count is `0`.
      6. Assert no permanently visible right-side Copilot pane exists before clicking AI Copilot trigger.
    Expected Result: The AIO three-pane layout is gone and dashboard shell is present.
    Failure Indicators: Resize handles remain, right Copilot pane visible by default, missing main content, or duplicate shell.
    Evidence: .sisyphus/evidence/task-6-dashboard-shell.png

  Scenario: Route page content remains rendered in main area
    Tool: Playwright
    Preconditions: Routes from Task 1 topology are available.
    Steps:
      1. Navigate to `http://localhost:3000/workspace/test-session-id/sdlc`.
      2. Assert `[data-testid="dashboard-content"]` contains SDLC page-specific heading/text from existing page.
      3. Navigate to `http://localhost:3000/workspace/test-session-id/settings`.
      4. Assert `[data-testid="dashboard-content"]` contains Settings page-specific heading/text from existing page.
    Expected Result: Route content renders inside the dashboard content area without page logic rewrites.
    Failure Indicators: Blank content, content outside main wrapper, wrong route content, or console runtime error.
    Evidence: .sisyphus/evidence/task-6-route-content.png
  ```

  **Evidence to Capture**:
  - [ ] `task-6-dashboard-shell.png`
  - [ ] `task-6-route-content.png`

  **Commit**: YES
  - Message: `refactor(frontend): replace workspace shell with dashboard layout`
  - Files: `WorkspaceLayout.tsx`, workspace layout adapter if needed, shell components
  - Pre-commit: `cd frontend && npm run test -- --run`

- [x] 7. Wire Command Palette and AI Copilot keyboard shortcuts

  **What to do**:
  - Wire global header Command Palette trigger to existing `CommandPalette` behavior.
  - Preserve Cmd/Ctrl+K for Command Palette.
  - Add Cmd/Ctrl+J keyboard shortcut for opening AI Copilot Sheet.
  - Ensure shortcuts do not duplicate listeners or conflict with text input unexpectedly.
  - Ensure Escape closes dialogs/sheets according to Radix behavior and focus returns to trigger when practical.

  **Must NOT do**:
  - Do not redesign Command Palette internals.
  - Do not add new commands.
  - Do not use Cmd/Ctrl+J for any persistent browser-level hijack beyond opening Copilot when app focus allows it.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Focused event wiring and test updates.
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Relevant for accessible keyboard/focus behavior.
  - **Skills Evaluated but Omitted**:
    - `gitnexus-refactoring`: No symbol movement expected if Task 1 is complete.

  **Parallelization**:
  - **Can Run In Parallel**: YES with Task 8 after Task 6
  - **Parallel Group**: Wave 2
  - **Blocks**: Tasks 9, 11
  - **Blocked By**: Tasks 4, 6

  **References**:
  **Pattern References**:
  - `frontend/components/workspace/CommandPalette.tsx` - Current palette behavior and existing key handler.
  - `frontend/hooks/useWorkspaceUi.ts` - Existing UI state for command palette/theme if applicable.
  - Header component from Task 4 - Trigger callbacks.

  **Test References**:
  - `frontend/app/workspace/[sessionId]/navigation.test.tsx` - Keyboard/router mock patterns.
  - `frontend/test/workspace-layout.test.tsx` - Layout trigger testing.

  **Acceptance Criteria**:
  - [ ] Header Command Palette button opens the existing Command Palette.
  - [ ] `Meta+K` and `Control+K` open Command Palette.
  - [ ] Header AI Copilot button opens Sheet.
  - [ ] `Meta+J` and `Control+J` open AI Copilot Sheet.
  - [ ] No duplicate dialogs open from repeated shortcut presses.

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Command Palette opens via trigger and shortcut
    Tool: Playwright
    Preconditions: Dashboard shell rendered.
    Steps:
      1. Navigate to `http://localhost:3000/workspace/test-session-id`.
      2. Click `[data-testid="command-palette-trigger"]`.
      3. Assert existing Command Palette dialog is visible and contains command input.
      4. Press Escape and assert dialog closes.
      5. Press `Meta+K` on macOS context or `Control+K` on Linux context.
      6. Assert Command Palette dialog opens again.
    Expected Result: Existing Command Palette opens from both UI and keyboard.
    Failure Indicators: New placeholder opens, no dialog, duplicate dialogs, or shortcut ignored.
    Evidence: .sisyphus/evidence/task-7-command-palette.png

  Scenario: AI Copilot opens via trigger and shortcut
    Tool: Playwright
    Preconditions: Dashboard shell rendered.
    Steps:
      1. Click `[data-testid="ai-copilot-trigger"]`.
      2. Assert `[data-testid="copilot-sheet"]` is visible.
      3. Press Escape and assert Sheet closes.
      4. Press `Meta+J` on macOS context or `Control+J` on Linux context.
      5. Assert `[data-testid="copilot-sheet"]` is visible again.
    Expected Result: Copilot opens from both UI and keyboard shortcut.
    Failure Indicators: Shortcut opens browser downloads, no Sheet opens, or focus trap fails.
    Evidence: .sisyphus/evidence/task-7-copilot-shortcut.png
  ```

  **Evidence to Capture**:
  - [ ] `task-7-command-palette.png`
  - [ ] `task-7-copilot-shortcut.png`

  **Commit**: YES
  - Message: `feat(frontend): wire dashboard header shortcuts`
  - Files: Header/shell wiring and tests
  - Pre-commit: `cd frontend && npm run test -- --run`

- [x] 8. Preserve route/page content and eliminate duplicate shell ownership

  **What to do**:
  - Use Task 1 topology evidence to ensure there is exactly one dashboard shell owner for target routes.
  - If both `layout.tsx` and `page.tsx` render `WorkspaceLayout`, collapse toward the persistent layout owner without rewriting page business logic.
  - Ensure route children/pages render inside the dashboard content slot and are not wrapped in nested dashboard shells.
  - Verify protected page/panel files are unchanged unless the executor documents an unavoidable minimal prop-level integration change.
  - Ensure session switching semantics do not bleed Copilot chat across sessions beyond current behavior.

  **Must NOT do**:
  - Do not move page state/fetchers out of page components except if required to preserve existing provider location and explicitly validated by impact analysis.
  - Do not edit backend files.
  - Do not change `frontend/lib/api.ts`, `frontend/hooks/useWorkspaceChat.tsx`, or `frontend/hooks/useWorkspaceSdlc.ts`.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Requires careful App Router ownership and preservation of state boundaries.
  - **Skills**: [`gitnexus-refactoring`]
    - `gitnexus-refactoring`: Required for safe removal/adapter changes around shared shell symbols.
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: This task is structural preservation, not visual design.

  **Parallelization**:
  - **Can Run In Parallel**: YES with Task 7 after Task 6
  - **Parallel Group**: Wave 2
  - **Blocks**: Tasks 9, 10, 12
  - **Blocked By**: Task 6

  **References**:
  **Pattern References**:
  - `frontend/app/workspace/[sessionId]/layout.tsx` - Persistent shell owner candidate.
  - `frontend/app/workspace/[sessionId]/page.tsx` - Possible duplicate shell render; preserve logic.
  - `frontend/components/workspace/MainStage.tsx` - Existing central content behavior to preserve if still used.

  **API/Type References**:
  - `frontend/hooks/useWorkspaceChat.tsx` - Session/chat state boundary.
  - `frontend/hooks/useWorkspaceSdlc.ts` - SDLC stream boundary.

  **Test References**:
  - `frontend/app/workspace/[sessionId]/characterization.test.tsx` - Current route/page behavior.
  - `frontend/test/workspace-providers.test.tsx` - Provider duplication tests.

  **Acceptance Criteria**:
  - [ ] Target workspace routes render exactly one dashboard shell.
  - [ ] No nested/duplicate `WorkspaceLayout` or dashboard shell appears in DOM.
  - [ ] Protected route page content files remain unchanged, or every exception is documented with justification.
  - [ ] `WorkspaceChatProvider` is mounted once for workspace shell scope.
  - [ ] Navigating between sidebar routes does not reset shell-local state except where expected.

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: No duplicate shell on workspace index route
    Tool: Playwright
    Preconditions: Shell swap complete.
    Steps:
      1. Navigate to `http://localhost:3000/workspace/test-session-id`.
      2. Count `[data-testid="dashboard-shell"]` elements.
      3. Count `[data-testid="app-sidebar"]` elements.
      4. Count `[data-testid="app-header"]` elements.
    Expected Result: Each count is exactly `1`.
    Failure Indicators: Count is `0`, count is greater than `1`, or nested shells appear after navigation.
    Evidence: .sisyphus/evidence/task-8-no-duplicate-shell.txt

  Scenario: Protected files remain untouched
    Tool: Bash
    Preconditions: Shell implementation complete.
    Steps:
      1. Run `git diff --stat -- frontend/lib/api.ts frontend/hooks/useWorkspaceChat.tsx frontend/hooks/useWorkspaceSdlc.ts backend-ts`.
      2. Run `git diff --stat -- frontend/app/workspace/[sessionId]/sdlc frontend/app/workspace/[sessionId]/settings frontend/app/workspace/[sessionId]/database frontend/app/workspace/[sessionId]/world frontend/app/workspace/[sessionId]/sessions frontend/app/workspace/[sessionId]/tracing`.
      3. Save output.
    Expected Result: No protected API/hook/backend diffs; route page diffs are empty or explicitly justified as layout-only assertions/tests.
    Failure Indicators: API/hook/backend file appears in diff, unexplained page logic change, or deleted page content.
    Evidence: .sisyphus/evidence/task-8-protected-diff.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-8-no-duplicate-shell.txt`
  - [ ] `task-8-protected-diff.txt`

  **Commit**: YES
  - Message: `refactor(frontend): preserve workspace route shell ownership`
  - Files: Layout/page shell adapter only, tests if needed
  - Pre-commit: `cd frontend && npm run test -- --run`

- [x] 9. Update layout, navigation, and breadcrumb tests

  **What to do**:
  - Update existing layout/navigation tests to assert the new dashboard shell rather than the old 3-pane layout.
  - Add or update tests for sidebar expanded/collapsed behavior, active route highlighting, breadcrumb text, and no localStorage persistence.
  - Update characterization tests only where the visual shell changed.
  - Preserve test coverage for routing and provider wiring.

  **Must NOT do**:
  - Do not delete existing tests to make the suite pass.
  - Do not weaken assertions into vague existence checks only.
  - Do not test implementation details that make safe CSS refactors impossible, except required test IDs and key layout classes.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Focused Vitest/RTL test updates after UI components exist.
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `playwright`: This task is unit/integration tests; Playwright QA is Task 11.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 10 and 11)
  - **Blocks**: Task 12
  - **Blocked By**: Tasks 6, 7, 8

  **References**:
  **Pattern References**:
  - Sidebar component from Task 3 - Test IDs and behavior.
  - Header component from Task 4 - Breadcrumb/action trigger behavior.

  **Test References**:
  - `frontend/test/workspace-layout.test.tsx` - Update old shell assertions.
  - `frontend/app/workspace/[sessionId]/navigation.test.tsx` - Preserve route click tests.
  - `frontend/test/activity-bar-routing.test.tsx` - Update for shared nav/sidebar if needed.
  - `frontend/app/workspace/[sessionId]/characterization.test.tsx` - Update permanent Copilot-pane expectations.

  **Acceptance Criteria**:
  - [ ] Existing relevant tests are updated rather than deleted.
  - [ ] Tests assert dashboard shell, sidebar, header, breadcrumbs, and active route behavior.
  - [ ] Tests assert sidebar state does not persist to localStorage.
  - [ ] Targeted test command passes for updated files.

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Updated layout/navigation test subset passes
    Tool: Bash
    Preconditions: Test updates complete.
    Steps:
      1. Run `cd frontend && npx vitest run test/workspace-layout.test.tsx app/workspace/[sessionId]/navigation.test.tsx test/activity-bar-routing.test.tsx app/workspace/[sessionId]/characterization.test.tsx`.
      2. Save full terminal output.
    Expected Result: All targeted tests pass with assertions matching dashboard behavior.
    Failure Indicators: Any test deleted without replacement, failing assertions, or snapshot/expectations still referencing permanent right Copilot pane.
    Evidence: .sisyphus/evidence/task-9-layout-tests.txt

  Scenario: Sidebar no-persistence behavior is test-covered
    Tool: Bash
    Preconditions: Sidebar tests exist.
    Steps:
      1. Search updated tests for assertion that localStorage is not used for sidebar expansion or state resets on remount.
      2. Run the specific sidebar test file.
    Expected Result: Automated test covers the user-selected no-persistence requirement.
    Failure Indicators: Requirement only tested manually, or code writes sidebar state to localStorage.
    Evidence: .sisyphus/evidence/task-9-sidebar-persistence-test.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-9-layout-tests.txt`
  - [ ] `task-9-sidebar-persistence-test.txt`

  **Commit**: YES
  - Message: `test(frontend): update dashboard shell navigation coverage`
  - Files: Frontend test files only plus minimal test utilities
  - Pre-commit: targeted Vitest command above

- [x] 10. Add Copilot Sheet and streaming preservation tests

  **What to do**:
  - Add tests for `CopilotSheet` open/close behavior and preservation of provider-backed chat history.
  - Add a test or harness proving Sheet close does not unmount/reset `WorkspaceChatProvider` or abort active stream.
  - Use existing stream lifecycle mocking patterns.
  - Update characterization tests that previously expected permanent Copilot pane to expect trigger + Sheet behavior.

  **Must NOT do**:
  - Do not mock away the important behavior under test (provider stability and stream continuation).
  - Do not change streaming implementation solely to make tests easier.
  - Do not delete stream lifecycle tests.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Asynchronous streaming lifecycle tests are regression-prone and require careful mocking.
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `gitnexus-refactoring`: This is test creation, not code refactor.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 12
  - **Blocked By**: Tasks 5, 6, 8

  **References**:
  **Pattern References**:
  - `frontend/components/workspace/AICopilot.tsx` - Wrapped UI.
  - `frontend/hooks/useWorkspaceChat.tsx` - Provider-backed state shape.

  **Test References**:
  - `frontend/test/stream-lifecycle.test.tsx` - Async generator/AbortController mocking patterns.
  - `frontend/test/workspace-providers.test.tsx` - Provider wiring tests.
  - `frontend/app/workspace/[sessionId]/characterization.test.tsx` - Copilot expectation update location.

  **Acceptance Criteria**:
  - [ ] Test covers opening and closing Copilot Sheet.
  - [ ] Test covers chat history visible after close/reopen.
  - [ ] Test covers active stream continuing after Sheet close.
  - [ ] Test confirms provider is not remounted/reset by Sheet toggling.
  - [ ] Targeted test command passes.

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Copilot Sheet tests pass with stream mock
    Tool: Bash
    Preconditions: Copilot Sheet test file added/updated.
    Steps:
      1. Run `cd frontend && npx vitest run test/stream-lifecycle.test.tsx test/workspace-providers.test.tsx` plus the new Copilot Sheet test file.
      2. Save terminal output.
    Expected Result: Tests pass and include a mocked multi-chunk stream close/reopen case.
    Failure Indicators: No multi-chunk stream assertion, test passes only because streaming is fully mocked out, or provider remount is not checked.
    Evidence: .sisyphus/evidence/task-10-copilot-tests.txt

  Scenario: Characterization reflects Sheet not permanent pane
    Tool: Bash
    Preconditions: Characterization test updated.
    Steps:
      1. Run `cd frontend && npx vitest run app/workspace/[sessionId]/characterization.test.tsx`.
      2. Confirm assertions expect `AI Copilot` trigger and Sheet behavior, not a permanent right pane.
    Expected Result: Characterization documents new intended shell behavior.
    Failure Indicators: Permanent pane expectation remains, test removed entirely, or Copilot no longer characterized.
    Evidence: .sisyphus/evidence/task-10-characterization.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-10-copilot-tests.txt`
  - [ ] `task-10-characterization.txt`

  **Commit**: YES
  - Message: `test(frontend): cover copilot sheet streaming behavior`
  - Files: Copilot/stream/provider test files
  - Pre-commit: targeted Vitest command above

- [x] 11. Add and execute browser QA checks for dashboard flows

  **What to do**:
  - Create or document repeatable Playwright checks that exercise the integrated dashboard shell.
  - Cover sidebar navigation across all route items from Task 1 topology.
  - Cover breadcrumbs, Command Palette, Copilot Sheet, Sheet close-mid-stream, route navigation during stream, and no 3-pane resize handles.
  - Capture screenshots/videos/traces to `.sisyphus/evidence/`.

  **Must NOT do**:
  - Do not rely on subjective visual inspection only.
  - Do not require a human to manually verify pass/fail.
  - Do not hit real paid AI providers for stream tests; mock/stub deterministic stream responses.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Browser-level UI QA across layout and interactions.
  - **Skills**: [`playwright`]
    - `playwright`: Required for browser verification and screenshots/videos.
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: QA execution, not design.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 12
  - **Blocked By**: Tasks 3, 4, 5, 6, 7

  **References**:
  **Pattern References**:
  - Dashboard shell/sidebar/header/Copilot components from Tasks 3-7.
  - `frontend/lib/api.ts:askStream` - Understand route shape for mocking stream responses.

  **Test References**:
  - Existing frontend tests from Tasks 9-10 - Align selectors and expected labels.

  **Acceptance Criteria**:
  - [ ] Browser QA visits every route in the sidebar and verifies content/header/sidebar remain functional.
  - [ ] Browser QA confirms no resize handles and no permanent Copilot right pane.
  - [ ] Browser QA verifies Cmd/Ctrl+K and Cmd/Ctrl+J.
  - [ ] Browser QA verifies Copilot stream survives Sheet close and route navigation within workspace.
  - [ ] Evidence files are saved for each scenario.

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Sidebar route tour has no console errors
    Tool: Playwright
    Preconditions: Dev server running; deterministic session route available.
    Steps:
      1. Navigate to `http://localhost:3000/workspace/test-session-id`.
      2. Register a console error listener and fail on new `error` messages.
      3. Click each nav item by test id: `sidebar-nav-chat`, `sidebar-nav-explorer`, `sidebar-nav-sdlc`, `sidebar-nav-tracing`, `sidebar-nav-database`, `sidebar-nav-settings`, `sidebar-nav-world`, `sidebar-nav-sessions` where present.
      4. After each click, assert URL/pathname matches the shared navigation model and `[data-testid="dashboard-content"]` is non-empty.
      5. Capture one screenshot per route.
    Expected Result: Every route renders in the dashboard shell with no console errors.
    Failure Indicators: Navigation 404, blank content, console error, wrong active nav, or missing breadcrumb.
    Evidence: .sisyphus/evidence/task-11-route-tour/

  Scenario: Copilot stream survives close and route navigation
    Tool: Playwright
    Preconditions: Chat stream endpoint mocked to return delayed chunks `alpha`, ` beta`, ` gamma`.
    Steps:
      1. Open Copilot with `Control+J` or `Meta+J`.
      2. Submit prompt `route stream test`.
      3. Wait until assistant contains `alpha`.
      4. Close Sheet.
      5. Click Settings nav item.
      6. Reopen Copilot.
      7. Assert assistant contains exact text `alpha beta gamma` and no abort error text.
    Expected Result: Workspace shell navigation and Sheet close do not abort provider-backed stream.
    Failure Indicators: Stream truncates, Sheet loses history, route navigation remounts provider unexpectedly, or abort error appears.
    Evidence: .sisyphus/evidence/task-11-stream-route-survival.webm
  ```

  **Evidence to Capture**:
  - [ ] `task-11-route-tour/`
  - [ ] `task-11-stream-route-survival.webm`

  **Commit**: YES
  - Message: `test(frontend): add dashboard browser qa coverage`
  - Files: Playwright/QA scripts or documented evidence harness
  - Pre-commit: relevant QA command plus `cd frontend && npm run test -- --run`

- [x] 12. Full frontend regression, protected diff, and GitNexus change verification

  **What to do**:
  - Run the complete frontend test suite, build, and lint command.
  - Run protected path diff checks to verify no API/hook/backend/page business logic creep.
  - Run `gitnexus_detect_changes({scope: "all"})` and compare affected symbols/processes to expected layout/navigation scope.
  - Document any baseline failures from Task 1 versus new failures.
  - Prepare final evidence index for review agents.

  **Must NOT do**:
  - Do not make broad cleanup edits outside the refactor scope.
  - Do not silently accept new test/build failures.
  - Do not commit secrets, generated build artifacts, or unrelated formatting churn.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Final regression synthesis across tests, build, diffs, and GitNexus processes.
  - **Skills**: [`gitnexus-impact-analysis`]
    - `gitnexus-impact-analysis`: Required for change detection and affected-process review.
  - **Skills Evaluated but Omitted**:
    - `playwright`: Browser QA already handled in Task 11.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4
  - **Blocks**: Final Verification Wave
  - **Blocked By**: Tasks 8, 9, 10, 11

  **References**:
  **Pattern References**:
  - `.sisyphus/evidence/task-1-baseline.txt` - Baseline to compare against.
  - All task evidence files - Inputs for final evidence index.

  **API/Type References**:
  - `frontend/lib/api.ts` - Protected API client.
  - `frontend/hooks/useWorkspaceChat.tsx` - Protected chat streaming hook.
  - `frontend/hooks/useWorkspaceSdlc.ts` - Protected SDLC streaming hook.
  - `backend-ts/**` - Entire backend out of scope.

  **Test References**:
  - `frontend/package.json` - Full scripts.
  - `AGENTS.md` GitNexus rules - `gitnexus_detect_changes` before completion/commit.

  **Acceptance Criteria**:
  - [ ] `cd frontend && npm run test` passes or failures match documented baseline with no new refactor failures.
  - [ ] `cd frontend && npm run build` succeeds or failure matches documented baseline.
  - [ ] `cd frontend && npm run lint` succeeds or failure matches documented baseline/missing script.
  - [ ] Protected path diff output is empty or contains only explicitly approved test/layout-only changes.
  - [ ] GitNexus change detection shows expected layout/navigation/UI scope only.
  - [ ] Evidence index exists for Final Verification Wave.

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Full frontend regression suite passes
    Tool: Bash
    Preconditions: Tasks 1-11 complete.
    Steps:
      1. Run `cd frontend && npm run test`.
      2. Run `cd frontend && npm run build`.
      3. Run `cd frontend && npm run lint` or record exact unavailable-script output.
      4. Compare results against Task 1 baseline.
    Expected Result: No new regressions are introduced by the dashboard refactor.
    Failure Indicators: New failing tests, build failure, lint failure, or undocumented baseline mismatch.
    Evidence: .sisyphus/evidence/task-12-frontend-regression.txt

  Scenario: Protected scope and GitNexus affected processes are expected
    Tool: Bash + GitNexus MCP
    Preconditions: Implementation complete and working tree contains only intended changes.
    Steps:
      1. Run `git diff --stat -- frontend/lib/api.ts frontend/hooks/useWorkspaceChat.tsx frontend/hooks/useWorkspaceSdlc.ts backend-ts`.
      2. Run protected route-page diff command from Task 8.
      3. Run `gitnexus_detect_changes({scope: "all"})`.
      4. Record affected symbols/processes and compare to expected shell/navigation/UI scope.
    Expected Result: No forbidden API/hook/backend diffs; GitNexus affected scope matches layout/navigation refactor.
    Failure Indicators: Backend/API/hook changes, SDLC/chat business logic changes, unexpected high-risk process impact, or missing change detection.
    Evidence: .sisyphus/evidence/task-12-scope-verification.md
  ```

  **Evidence to Capture**:
  - [ ] `task-12-frontend-regression.txt`
  - [ ] `task-12-scope-verification.md`
  - [ ] `task-12-evidence-index.md`

  **Commit**: YES
  - Message: `chore(frontend): verify dashboard shell refactor`
  - Files: Evidence index or test harness updates only
  - Pre-commit: `cd frontend && npm run test && npm run build`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
>
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run command, inspect DOM via Playwright where needed). For each "Must NOT Have": search codebase for forbidden changes and reject with file:line if found. Check evidence files exist in `.sisyphus/evidence/`. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run frontend test/build/lint commands where available. Review all changed files for `as any`/`@ts-ignore`, empty catches, console logs, commented-out code, unused imports, over-abstraction, duplicated navigation definitions, and accidental page logic edits.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high` + `playwright`
  Start from clean state. Execute EVERY QA scenario from EVERY task. Test cross-task integration: sidebar + header + routed content + Copilot Sheet + streaming behavior. Save evidence to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff, verify 1:1 compliance. Check protected path diffs, forbidden file changes, no backend edits, and no unplanned route/business logic changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **Suggested single commit**: `refactor(frontend): replace workspace shell with dashboard layout`
- Include only frontend layout/navigation/test changes required by this plan.
- Do not commit backend changes, CI changes, dependency bumps, or unrelated formatting churn.

---

## Success Criteria

### Verification Commands
```bash
cd frontend && npm run test
cd frontend && npm run build
cd frontend && npm run lint
git diff --stat -- frontend/lib/api.ts frontend/hooks/useWorkspaceChat.tsx frontend/hooks/useWorkspaceSdlc.ts backend-ts
```

### Final Checklist
- [ ] Enterprise dashboard shell replaces the 3-pane AIO visual layout.
- [ ] Sidebar expands/collapses and resets to default on reload.
- [ ] Active route highlighting and breadcrumbs reflect pathname.
- [ ] Command Palette opens with header trigger and Cmd/Ctrl+K.
- [ ] AI Copilot opens with header trigger and Cmd/Ctrl+J.
- [ ] AI Copilot chat history and streaming survive Sheet close/reopen.
- [ ] Existing route pages render in main content area with no business logic changes.
- [ ] All tests/build/lint checks pass or existing baseline failures are documented.
- [ ] Protected business logic/API paths show no unintended diffs.
