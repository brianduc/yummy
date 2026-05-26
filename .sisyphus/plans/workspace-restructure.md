# Workspace Layout Restructure — Panels to Dedicated Routes

## TL;DR

> **Quick Summary**: Extract 6 inline panels from the tabbed MainStage layout into dedicated route pages under `/workspace/[sessionId]/`, convert the index page to a quick-stats dashboard, delete the old MainStage tabbed rendering code.
>
> **Deliverables**:
> - 6 new route pages: `/explorer`, `/graph`, `/wiki`, `/insight`, `/history`, `/jira`
> - 1 dashboard page replacing the workspace index
> - Updated `workspace-navigation.ts` with 5 new activity items
> - Delete modal hoisted to layout
> - Old MainStage tabbed code deleted
> - 13 test files (TDD: 7 route pages + 1 dashboard + 1 navigation + 4 existing updates)
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES — 4 waves
> **Critical Path**: Wave 1 → Wave 2 (dashboard) → Wave 3 (routes) → Wave 4 (cleanup)

---

## Context

### Original Request
Move panels from the old tabbed workspace layout into dedicated pages: IDE Simulator → `/explorer`, Node Arch → `/graph`, Gitbook Wiki → `/wiki`, AI Insight → `/insight`, RAG Trace → `/history` (chat history), Jira Kanban → `/jira`, World → `/world`. SDLC already done → skip. After migration, delete the old tabbed layout.

### Interview Summary

**Key Discussions**:
- **Route scoping**: Confirmed session-scoped under `/workspace/[sessionId]/` (not top-level)
- **Index page fate**: Convert to a quick-stats dashboard with navigational cards (no action buttons)
- **Test strategy**: TDD — write failing tests first, then implement route pages
- **Onboarding wizard**: Stays on the dashboard index page
- **Delete session modal**: Hoist to layout.tsx so it's accessible from all routes
- **World route**: Already exists at `/workspace/[sessionId]/world/page.tsx` — only needs inline tab removal from old layout, no new page needed
- **Navigation**: Already has `explorer` item; needs 5 new items: `graph`, `wiki`, `insight`, `history`, `jira`

**Research Findings**:
- **Workspace layout** (`layout.tsx`) provides WorkspaceChatProvider + hooks (`useWorkspaceSession`, `useWorkspaceStatus`, `useWorkspaceSdlc`, `useWorkspaceUi`) to all nested routes
- **Existing route pages** follow a consistent pattern (see `sdlc/page.tsx`, `world/page.tsx`, `sessions/page.tsx`): `'use client'`, import panel + hooks, render with data-testid
- **6 panels are presentational**: IdePanel, NodeGraph, WikiPanel, InsightsPanel, RagPanel, BacklogPanel — no API calls, just render props
- **WorldPanel** is self-contained with its own `api.world.*` calls — no sessionId needed
- **Navigation** centralized in `workspace-navigation.ts` — activityItems array drives sidebar, activity bar, and breadcrumbs
- **page.tsx** (375 lines) currently does triple duty: data fetcher, tabbed orchestrator, onboarding/delete modal host
- **Two cross-panel callbacks** that must be re-wired: `onFileOpen` (→ `/explorer`) and scan completion (→ `/wiki`)
- **Test infra**: Vitest + Testing Library + jsdom, 20 existing tests, mock pattern: `vi.mock('next/navigation', ...)`, `vi.mock('@/hooks/...')`

### Metis Review

**Identified Gaps** (addressed):
- **Onboarding/delete modal placement**: Onboarding → dashboard; Delete → layout.tsx (user confirmed)
- **Dashboard action buttons**: Navigational cards only, no action buttons (user confirmed)
- **Deep-link empty state**: Panels handle null props naturally — no special handling needed (auto-resolved)
- **Dashboard nav item**: Add "Dashboard" entry as new `isIndex: true` item replacing "AI Copilot" label (auto-resolved)
- **Chat provider stability**: Already in layout — survives route navigation (verified)
- **Browser back/forward**: Handled by Next.js App Router natively (auto-resolved)
- **Error states**: Each panel already handles null/empty props internally (auto-resolved)
- **No backend changes needed**: All dashboard stats from existing hooks (auto-resolved)
- **activeTab/activeActivity**: Must be fully removed from both page.tsx and layout.tsx in cleanup wave (explicit guardrail)

---

## Work Objectives

### Core Objective
Extract all inline panels from the tabbed MainStage layout into dedicated Next.js App Router route pages, then delete the tabbed rendering infrastructure and convert the index page into a navigational dashboard.

### Concrete Deliverables
- `frontend/app/workspace/[sessionId]/explorer/page.tsx` — IDE Simulator route
- `frontend/app/workspace/[sessionId]/graph/page.tsx` — Node Architecture route
- `frontend/app/workspace/[sessionId]/wiki/page.tsx` — Gitbook Wiki route
- `frontend/app/workspace/[sessionId]/insight/page.tsx` — AI Insight route
- `frontend/app/workspace/[sessionId]/history/page.tsx` — RAG Trace route
- `frontend/app/workspace/[sessionId]/jira/page.tsx` — Jira Kanban route
- Updated `frontend/app/workspace/[sessionId]/page.tsx` — Dashboard (replaces old layout)
- Updated `frontend/app/workspace/[sessionId]/layout.tsx` — Added delete modal
- Updated `frontend/lib/workspace-navigation.ts` — 5 new activity items + dashboard rename

### Definition of Done
- [ ] `npm run build` passes in `frontend/`
- [ ] `npm test` passes all 13 new + updated test files
- [ ] `npm run lint` passes with no errors
- [ ] `grep -rn 'activeTab\|setActiveTab\|MainStage' frontend/app/workspace/` returns no results
- [ ] `grep -rn 'activeTab\|setActiveTab\|MainStage' frontend/components/workspace/` returns only dead code references (removal verified)
- [ ] All 7 new routes render their panel at correct URL with correct data-testid

### Must Have
- Each new route page renders the panel with identical props to current tabbed version
- Chat panel persists conversation across route navigation (no provider remount)
- Dashboard shows stats: repo info, file count, scan status, SDLC status, chat count
- Dashboard has navigational cards linking to all 7 tool routes
- Delete modal is available from all routes (hoisted to layout)
- SDLC pipeline streaming is NOT interrupted by navigation

### Must NOT Have (Guardrails)
- NO backend changes (all dashboard stats from existing hooks)
- NO refactoring of panel components (IdePanel, NodeGraph, WikiPanel, etc.) — pure relocation
- NO changes to existing route pages (sdlc, database, tracing, sessions, settings, world)
- NO new theme tokens, fonts, or shadow colors (per DESIGN.md)
- NO visual redesign of dashboard — Phosphor Terminal tokens, mirror existing card patterns
- NO new backend endpoints
- NO commented-out code (no `// old: activeTab`)
- NO half-states — all panels extracted before MainStage deletion

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: YES (Vitest + Testing Library + jsdom)
- **Automated tests**: TDD
- **Framework**: Vitest
- **Pattern**: RED (failing test) → GREEN (minimal implementation) → REFACTOR (if needed)

### QA Policy
Every task includes agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Frontend/UI**: Use Playwright — Navigate, interact, assert DOM, screenshot
- **API endpoints (verification)**: Use Bash (curl) — Send requests, assert status + response fields
- **CLI verification**: Use Bash — `npm test`, `npm run build`, `npm run lint`, `grep`

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — navigation registry + test scaffolding):
├── T1: Update workspace-navigation.ts [quick]
├── T2: Scaffold dashboard page + test (RED) [quick]
├── T3: Scaffold explorer route + test (RED) [quick]
├── T4: Scaffold graph route + test (RED) [quick]
├── T5: Scaffold wiki route + test (RED) [quick]
├── T6: Scaffold insight route + test (RED) [quick]
├── T7: Scaffold history route + test (RED) [quick]
└── T8: Scaffold jira route + test (RED) [quick]

Wave 2 (After Wave 1 — dashboard implementation):
├── T9: Implement dashboard page (GREEN) [visual-engineering]
├── T10: Hoist delete modal to layout.tsx [deep]
└── T11: Wire IDE file-open callback to router.push [deep]

Wave 3 (After Wave 2 — route implementations, MAX PARALLEL):
├── T12: Implement explorer route (GREEN) [quick]
├── T13: Implement graph route (GREEN) [quick]
├── T14: Implement wiki route (GREEN) [quick]
├── T15: Implement insight route (GREEN) [quick]
├── T16: Implement history route + chat context (GREEN) [deep]
├── T17: Implement jira route (GREEN) [quick]
└── T18: Wire scan-completion callback (→ /wiki) [quick]

Wave 4 (After Wave 3 — cleanup + verification):
├── T19: Strip MainStage tabbed code from page.tsx [deep]
├── T20: Remove activeTab/activeActivity from layout.tsx [deep]
├── T21: Dead code purge + lint verification [quick]
└── T22: Navigation tests update [quick]

Wave FINAL (After ALL — 4 parallel reviews, then user okay):
├── F1: Plan compliance audit (oracle)
├── F2: Code quality review (unspecified-high)
├── F3: Real manual QA (unspecified-high)
└── F4: Scope fidelity check (deep)
```

**Critical Path**: T1 → T9 → T12-T15 → T19 → T20 → T21 → F1-F4
**Parallel Speedup**: ~65% faster than sequential
**Max Concurrent**: 8 (Wave 1), 7 (Wave 3)

---

## TODOs

> Implementation + Test = ONE Task. Never separate.
> EVERY task MUST have: Recommended Agent Profile + Parallelization info + QA Scenarios.

### Wave 1: Navigation Registry + Test Scaffolding (8 parallel tasks)

- [x] 1. Update `workspace-navigation.ts` with new activity items

  **What to do**:
  - Add 5 new `ActivityId` values: `'graph'`, `'wiki'`, `'insight'`, `'history'`, `'jira'`
  - Add 5 new `ActivityItem` entries to the `activityItems` array with appropriate lucide-react icons
  - Each item: `isIndex: false`, `routeSuffix` matches route folder name, `activeColor` in Phosphor Terminal palette, `breadcrumbLabel` human-readable
  - Rename `chat` item: `label` from `'AI Copilot'` to `'Dashboard'`, `breadcrumbLabel` to `'Dashboard'`
  - Add entries in `workspaceActivityRouteLabels`
  - **Test file**: `frontend/test/workspace-navigation-update.test.tsx` — RED phase (5 tests)

  **Must NOT do**: Do NOT change data structure of `ActivityItem`/`ActivityId`; Do NOT remove existing items

  **Recommended Agent Profile**: **Category**: `quick` | **Skills**: []

  **Parallelization**: Wave 1 (with T2-T8) | **Blocks**: T9, T12-T17 | **Blocked By**: None

  **References**:
  - `frontend/lib/workspace-navigation.ts` — Full file to modify
  - `frontend/test/activity-bar-routing.test.tsx` — Existing navigation test pattern

  **Acceptance Criteria**:
  - [ ] `ActivityId` type includes: `'graph'`, `'wiki'`, `'insight'`, `'history'`, `'jira'`
  - [ ] `activityItems` has 13 total entries; `chat` label is `'Dashboard'`
  - [ ] `npm test -- workspace-navigation-update` → 5 tests PASS

  **QA Scenarios**:
  ```
  Scenario: Navigation tests pass
    Tool: Bash
    Steps: 1. cd frontend && npx vitest run test/workspace-navigation-update.test.tsx
    Expected Result: All 5 tests PASS
    Evidence: .sisyphus/evidence/task-1-navigation-tests.txt

  Scenario: TypeScript compiles clean
    Tool: Bash
    Steps: 1. cd frontend && npx tsc --noEmit --pretty 2>&1 | grep -i "error" | head -20
    Expected Result: No errors related to workspace-navigation.ts
    Evidence: .sisyphus/evidence/task-1-tsc-check.txt
  ```

  **Commit**: YES | Message: `feat(nav): add graph, wiki, insight, history, jira items, rename chat to Dashboard`

- [x] 2. Scaffold dashboard page + RED test

  **What to do**:
  - Create RED test at `frontend/test/workspace/dashboard.test.tsx` (7 tests)
  - Mock `next/navigation`, `useWorkspaceSession`, `useWorkspaceStatus`, `useWorkspaceSdlc`, `useWorkspaceChat`
  - Tests: dashboard wrapper, 5 stat elements (repo, files, scan, sdlc, chats), 7 navigational cards
  - All tests FAIL initially (RED phase — page not implemented yet)

  **Must NOT do**: Do NOT implement the dashboard page yet

  **Recommended Agent Profile**: **Category**: `quick` | **Skills**: []

  **Parallelization**: Wave 1 (with T1, T3-T8) | **Blocks**: T9 | **Blocked By**: None

  **References**:
  - `frontend/test/sessions-route.test.tsx` — Mock pattern template
  - `frontend/test/workspace-providers.test.tsx` — Hook mocking pattern

  **Acceptance Criteria**:
  - [ ] `frontend/test/workspace/dashboard.test.tsx` created
  - [ ] `npm test -- workspace/dashboard` → 7 tests FAIL (RED phase confirmed)

  **QA Scenarios**: RED phase — `npm test -- workspace/dashboard` exits non-zero → `.sisyphus/evidence/task-2-red-phase.txt`

  **Commit**: YES | Message: `test(dashboard): add RED-phase tests for dashboard page`

- [x] 3. Scaffold explorer route + RED test

  **What to do**:
  - Create RED test at `frontend/test/workspace/explorer-route.test.tsx` (4 tests)
  - Create skeleton page at `frontend/app/workspace/[sessionId]/explorer/page.tsx`
  - Mock `useWorkspaceStatus` (kb.tree), mock `IdePanel` as stub
  - Skeleton: `'use client'`, `<div data-testid="explorer-page">` only

  **Must NOT do**: No full implementation yet

  **Recommended Agent Profile**: **Category**: `quick` | **Skills**: []

  **Parallelization**: Wave 1 | **Blocks**: T12 | **Blocked By**: None

  **References**: `frontend/app/workspace/[sessionId]/world/page.tsx` — Simplest page pattern

  **Acceptance Criteria**:
  - [ ] Test + skeleton page created
  - [ ] `npm test -- workspace/explorer-route` → 4 tests FAIL

  **QA Scenarios**: RED phase check → `.sisyphus/evidence/task-3-red-phase.txt`

  **Commit**: YES | Message: `test(explorer): add RED-phase tests + skeleton page for explorer route`

- [x] 4. Scaffold graph route + RED test

  **What to do**:
  - Create RED test at `frontend/test/workspace/graph-route.test.tsx` (3 tests)
  - Create skeleton page at `frontend/app/workspace/[sessionId]/graph/page.tsx`
  - Mock `useWorkspaceStatus` (kb.tree, status.repo), mock `NodeGraph` as stub

  **Must NOT do**: No implementation

  **Recommended Agent Profile**: **Category**: `quick` | **Skills**: []

  **Parallelization**: Wave 1 | **Blocks**: T13 | **Blocked By**: None

  **References**: `frontend/components/workspace/NodeGraph.tsx` — Props: `tree`, `repoInfo`

  **Acceptance Criteria**:
  - [ ] Test + skeleton created; `npm test -- workspace/graph-route` → 3 tests FAIL

  **QA Scenarios**: RED phase → `.sisyphus/evidence/task-4-red-phase.txt`

  **Commit**: YES | Message: `test(graph): add RED-phase tests + skeleton page for graph route`

- [x] 5. Scaffold wiki route + RED test

  **What to do**:
  - Create RED test at `frontend/test/workspace/wiki-route.test.tsx` (3 tests)
  - Create skeleton page at `frontend/app/workspace/[sessionId]/wiki/page.tsx`
  - Mock `useWorkspaceStatus` (kb with project_summary), mock `WikiPanel` as stub

  **Must NOT do**: No implementation

  **Recommended Agent Profile**: **Category**: `quick` | **Skills**: []

  **Parallelization**: Wave 1 | **Blocks**: T14 | **Blocked By**: None

  **References**: `frontend/components/workspace/WikiPanel.tsx` — Props: `kb: KnowledgeBase | null`

  **Acceptance Criteria**:
  - [ ] Test + skeleton created; `npm test -- workspace/wiki-route` → 3 tests FAIL

  **QA Scenarios**: RED phase → `.sisyphus/evidence/task-5-red-phase.txt`

  **Commit**: YES | Message: `test(wiki): add RED-phase tests + skeleton page for wiki route`

- [x] 6. Scaffold insight route + RED test

  **What to do**:
  - Create RED test at `frontend/test/workspace/insight-route.test.tsx` (3 tests)
  - Create skeleton page at `frontend/app/workspace/[sessionId]/insight/page.tsx`
  - Mock `useWorkspaceStatus` (kb with insights array), mock `InsightsPanel` as stub

  **Must NOT do**: No implementation

  **Recommended Agent Profile**: **Category**: `quick` | **Skills**: []

  **Parallelization**: Wave 1 | **Blocks**: T15 | **Blocked By**: None

  **References**: `frontend/components/workspace/InsightsPanel.tsx` — Props: `kb: KnowledgeBase | null`

  **Acceptance Criteria**:
  - [ ] Test + skeleton created; `npm test -- workspace/insight-route` → 3 tests FAIL

  **QA Scenarios**: RED phase → `.sisyphus/evidence/task-6-red-phase.txt`

  **Commit**: YES | Message: `test(insight): add RED-phase tests + skeleton page for insight route`

- [x] 7. Scaffold history route + RED test

  **What to do**:
  - Create RED test at `frontend/test/workspace/history-route.test.tsx` (3 tests)
  - Create skeleton page at `frontend/app/workspace/[sessionId]/history/page.tsx`
  - Mock `useWorkspaceChat` (chatHistory array with sample messages), mock `RagPanel` as stub
  - Note: This page needs chat context — use `WorkspaceChatProvider` mock or access via `useChat()` hook

  **Must NOT do**: No implementation

  **Recommended Agent Profile**: **Category**: `quick` | **Skills**: []

  **Parallelization**: Wave 1 | **Blocks**: T16 | **Blocked By**: None

  **References**:
  - `frontend/components/workspace/RagPanel.tsx` — Props: `chatHistory: ChatMessage[]`
  - `frontend/hooks/useWorkspaceChat.tsx` — Exports `useChat()` for accessing chat context

  **Acceptance Criteria**:
  - [ ] Test + skeleton created; `npm test -- workspace/history-route` → 3 tests FAIL

  **QA Scenarios**: RED phase → `.sisyphus/evidence/task-7-red-phase.txt`

  **Commit**: YES | Message: `test(history): add RED-phase tests + skeleton page for history route`

- [x] 8. Scaffold jira route + RED test

  **What to do**:
  - Create RED test at `frontend/test/workspace/jira-route.test.tsx` (3 tests)
  - Create skeleton page at `frontend/app/workspace/[sessionId]/jira/page.tsx`
  - Mock `useWorkspaceSession` (session with jira_backlog array), mock `BacklogPanel` as stub

  **Must NOT do**: No implementation

  **Recommended Agent Profile**: **Category**: `quick` | **Skills**: []

  **Parallelization**: Wave 1 | **Blocks**: T17 | **Blocked By**: None

  **References**: `frontend/components/workspace/BacklogPanel.tsx` — Props: `backlog: JiraEpic[]`

  **Acceptance Criteria**:
  - [ ] Test + skeleton created; `npm test -- workspace/jira-route` → 3 tests FAIL

  **QA Scenarios**: RED phase → `.sisyphus/evidence/task-8-red-phase.txt`

  **Commit**: YES | Message: `test(jira): add RED-phase tests + skeleton page for jira route`

### Wave 2: Dashboard Implementation + Layout Changes (3 parallel tasks)

- [x] 9. Implement dashboard page (GREEN)

  **What to do**:
  - Implement `frontend/app/workspace/[sessionId]/page.tsx` as the new dashboard
  - Use `useParams()` for sessionId; use `useWorkspaceSession`, `useWorkspaceStatus`, `useWorkspaceSdlc`, `useChat()` from hooks
  - **Stats section** (5 stat cards):
    - Repo: `status?.repo ? \`${status.repo.owner}/${status.repo.repo}\` : 'No repo'` → `data-testid="dashboard-stat-repo"`
    - Files: `kb?.tree?.length ?? 0` → `data-testid="dashboard-stat-files"`
    - Scan: `scanStatus?.running ? 'Scanning...' : scanStatus ? 'Complete' : 'Not started'` → `data-testid="dashboard-stat-scan"`
    - SDLC: `session?.workflow_state ?? 'No pipeline'` → `data-testid="dashboard-stat-sdlc"`
    - Chats: `chatHistory?.length ?? 0` → `data-testid="dashboard-stat-chats"`
  - **Navigational cards** (7 cards, using `<Link>` from `next/link`):
    - Explorer → `/workspace/${sessionId}/explorer` — icon: FolderTree, `data-testid="dashboard-card-explorer"`
    - Graph → `/workspace/${sessionId}/graph` — `data-testid="dashboard-card-graph"`
    - Wiki → `/workspace/${sessionId}/wiki` — `data-testid="dashboard-card-wiki"`
    - Insight → `/workspace/${sessionId}/insight` — `data-testid="dashboard-card-insight"`
    - History → `/workspace/${sessionId}/history` — `data-testid="dashboard-card-history"`
    - Jira → `/workspace/${sessionId}/jira` — `data-testid="dashboard-card-jira"`
    - World → `/workspace/${sessionId}/world` — `data-testid="dashboard-card-world"`
  - Use Phosphor Terminal design tokens: `var(--bg-1)`, `var(--border)`, `var(--green)`, `var(--text)`, etc.
  - **Preserve** onboarding wizard from old page.tsx (same code, moved to dashboard)
  - **Remove** all MainStage, activeTab, activeActivity, inline panel rendering code from old page.tsx
  - **Keep** data fetching: `fetchSession`, `fetchStatus`, `fetchKb` (polling every 4s)
  - After implementation, run RED test → should now PASS (GREEN phase)

  **Must NOT do**:
  - Do NOT add action buttons to cards (navigational only)
  - Do NOT add new API calls — all data from existing hooks
  - Do NOT import MainStage or any panel components (except for reference)
  - Do NOT remove the delete confirmation modal (it moves to T10)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Dashboard UI with Phosphor Terminal design system — requires visual polish and token adherence
  - **Skills**: []
  - **Skills Evaluated but Omitted**: None

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with T10, T11)
  - **Blocks**: T19 (strips remaining code from old page.tsx)
  - **Blocked By**: T1 (nav items), T2 (RED test)

  **References**:
  - `frontend/app/workspace/[sessionId]/page.tsx:36-95` — Current data fetching code to preserve and adapt
  - `frontend/app/workspace/[sessionId]/page.tsx:272-315` — Onboarding wizard code to preserve
  - `frontend/DESIGN.md` — Phosphor Terminal design tokens (colors, borders, typography)
  - `frontend/lib/workspace-navigation.ts` — `buildWorkspaceActivityRoute()` for card links
  - `frontend/test/workspace/dashboard.test.tsx` — RED tests to make GREEN

  **Acceptance Criteria**:
  - [ ] Dashboard page renders `data-testid="dashboard-page"`
  - [ ] All 5 stat cards render with correct data-testid and non-empty values
  - [ ] All 7 navigational cards render with correct data-testid and `<Link>` to correct route
  - [ ] `npm test -- workspace/dashboard` → 7 tests PASS (GREEN phase)
  - [ ] Onboarding wizard preserved and functional
  - [ ] No MainStage, activeTab, or inline panel rendering in page.tsx

  **QA Scenarios**:
  ```
  Scenario: Dashboard renders with stats and cards
    Tool: Playwright
    Preconditions: Dev server running, session exists
    Steps:
      1. Navigate to http://localhost:3000 (auto-redirects to /workspace/[id])
      2. Wait for page load (timeout: 10s)
      3. Assert: element with data-testid="dashboard-page" is visible
      4. Assert: element with data-testid="dashboard-stat-files" contains a number
      5. Assert: 7 elements matching [data-testid^="dashboard-card-"] are visible
      6. Click [data-testid="dashboard-card-explorer"]
      7. Assert: URL contains /workspace/[id]/explorer
    Expected Result: Dashboard loads, stats visible, cards navigate correctly
    Evidence: .sisyphus/evidence/task-9-dashboard.png
  ```

  **Commit**: YES | Message: `feat(dashboard): implement stats + navigational cards, preserve onboarding`

- [x] 10. Hoist delete session modal to layout.tsx

  **What to do**:
  - Move delete confirmation modal from `page.tsx` to `layout.tsx`
  - In layout.tsx: add `deleteTarget` state, `deleteSession` handler, and the modal UI
  - The `deleteSession` handler calls `sessionCtx.deleteSession(targetId)`, then navigates if current session deleted
  - Pass `onDeleteRequest` via a simple React context or via props through `WorkspaceLayout`
  - Create a `DeleteSessionModal` component in `frontend/components/workspace/DeleteSessionModal.tsx` with:
    - Props: `session: Session | null`, `onClose: () => void`, `onConfirm: () => Promise<void>`
    - Same visual design as current modal (Trash2 icon, red border, font-display heading)
  - Import and use `DeleteSessionModal` in layout.tsx
  - SessionsPanel's `onDeleteRequest` prop should be wired to layout's `setDeleteTarget`
  - **Test file**: `frontend/test/workspace/delete-modal.test.tsx` — RED phase first
    - Test: DeleteSessionModal renders with session name
    - Test: Cancel button calls onClose
    - Test: Delete button calls onConfirm

  **Must NOT do**:
  - Do NOT change the visual design of the delete modal
  - Do NOT change SessionsPanel's API (keep onDeleteRequest prop)
  - Do NOT add new API calls

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Requires understanding state flow across layout → SessionsPanel → modal, React context or prop threading decisions
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with T9, T11)
  - **Blocks**: None directly (independent of routes)
  - **Blocked By**: None

  **References**:
  - `frontend/app/workspace/[sessionId]/page.tsx:318-351` — Current delete modal code to extract
  - `frontend/app/workspace/[sessionId]/layout.tsx` — Layout where modal will live
  - `frontend/app/workspace/[sessionId]/sessions/page.tsx` — SessionsPanel usage with onDeleteRequest
  - `frontend/components/workspace/SessionsPanel.tsx` — Component expecting onDeleteRequest prop

  **Acceptance Criteria**:
  - [ ] `frontend/components/workspace/DeleteSessionModal.tsx` created
  - [ ] Delete modal renders from layout.tsx (not from page.tsx)
  - [ ] `npm test -- workspace/delete-modal` → 3 tests PASS
  - [ ] Delete modal accessible from any workspace route (not just dashboard)

  **QA Scenarios**:
  ```
  Scenario: Delete modal works from non-dashboard route
    Tool: Playwright
    Preconditions: Multiple sessions exist, on /workspace/[id]/explorer
    Steps:
      1. Navigate to /workspace/[id]/sessions
      2. Click delete icon on a session row
      3. Assert: Delete modal appears with session name
      4. Click "Cancel" → modal closes, session NOT deleted
      5. Click delete icon again
      6. Click "Delete" button
      7. Assert: Modal closes, session removed from list
    Expected Result: Delete flow works from any route
    Evidence: .sisyphus/evidence/task-10-delete-modal.png
  ```

  **Commit**: YES | Message: `refactor(layout): hoist delete session modal from page to layout`

- [x] 11. Wire IDE file-open callback to router.push

  **What to do**:
  - In `layout.tsx` (or a shared callback), create `handleFileOpen(path: string)` that:
    1. Fetches file content via `api.kb.file(path)`
    2. Stores file path + content in local state (or via a new context)
    3. Calls `router.push(\`/workspace/${sessionId}/explorer\`)` to navigate to explorer route
  - The explorer route page (T12) will consume this file state to pass to IdePanel
  - Update `onFileOpen` prop passed to `WorkspaceLayout` (currently empty `() => {}`)
  - This replaces the old `openFile` callback in page.tsx (lines 122-130) which set `setActiveTab('ide')`
  - **Test file**: Update `frontend/test/workspace/explorer-route.test.tsx` to include test for file-open → navigation behavior

  **Must NOT do**:
  - Do NOT keep the old `setActiveTab('ide')` behavior — must use `router.push`
  - Do NOT duplicate file-fetching logic across routes

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Involves cross-route navigation + state management + API call integration
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with T9, T10)
  - **Blocks**: T12 (explorer route needs this to work)
  - **Blocked By**: None

  **References**:
  - `frontend/app/workspace/[sessionId]/page.tsx:122-130` — Old `openFile` callback to replace
  - `frontend/app/workspace/[sessionId]/layout.tsx:72` — Current empty `onFileOpen={() => {}}` to update
  - `frontend/lib/api.ts` — `api.kb.file(path)` method

  **Acceptance Criteria**:
  - [ ] `handleFileOpen` calls `api.kb.file(path)` and then `router.push('/explorer')`
  - [ ] File content and path stored in state accessible to explorer route
  - [ ] Old `setActiveTab('ide')` code removed from callbacks

  **QA Scenarios**:
  ```
  Scenario: File open navigates to explorer route
    Tool: Playwright
    Preconditions: kb has file tree, on dashboard or any route
    Steps:
      1. Click a file in the file tree (sidebar)
      2. Assert: URL changes to /workspace/[id]/explorer
      3. Assert: Explorer page shows the selected file content
    Expected Result: File opens in explorer route with content visible
    Evidence: .sisyphus/evidence/task-11-file-open.png
  ```

  **Commit**: YES | Message: `feat(layout): wire file-open callback to router.push('/explorer')`

### Wave 3: Route Implementations (7 parallel tasks)

- [x] 12. Implement explorer route (GREEN)

  **What to do**:
  - Implement `frontend/app/workspace/[sessionId]/explorer/page.tsx`
  - Pattern: `'use client'`, import `IdePanel` from `@/components/workspace/IdePanel`
  - Use `useParams()` to get sessionId
  - Use `useWorkspaceStatus()` to get `kb?.tree`
  - Manage local state: `ideFile`, `ideContent`, `ideLoading` (same as old page.tsx lines 54-56)
  - Implement `onFileOpen` handler locally: fetch file via `api.kb.file(path)`, update local state
  - Render: `<IdePanel tree={kb?.tree || []} ideFile={ideFile} ideContent={ideContent} ideLoading={ideLoading} onFileOpen={handleFileOpen} />`
  - Wrap in `<div data-testid="explorer-page" className="h-full">`
  - After implementation: `npm test -- workspace/explorer-route` → 4 tests PASS

  **Must NOT do**: Do NOT modify IdePanel component; Do NOT add new API calls (use existing `api.kb.file`)

  **Recommended Agent Profile**: **Category**: `quick` | **Skills**: []

  **Parallelization**: Wave 3 (with T13-T18) | **Blocks**: None | **Blocked By**: T3 (RED test), T11 (file-open wiring)

  **References**:
  - `frontend/components/workspace/IdePanel.tsx` — Panel props interface
  - `frontend/app/workspace/[sessionId]/page.tsx:54-56,122-130` — Old ideFile/ideContent/ideLoading state and openFile handler to replicate
  - `frontend/app/workspace/[sessionId]/world/page.tsx` — Simplest page pattern

  **Acceptance Criteria**:
  - [ ] Explorer route renders `data-testid="explorer-page"` with IdePanel
  - [ ] File tree from `useWorkspaceStatus().kb.tree` passed to IdePanel
  - [ ] `npm test -- workspace/explorer-route` → 4 tests PASS (GREEN phase)

  **QA Scenarios**:
  ```
  Scenario: Explorer renders file tree and opens files
    Tool: Playwright
    Preconditions: kb scan complete, file tree not empty
    Steps:
      1. Navigate to /workspace/[id]/explorer
      2. Assert: data-testid="explorer-page" visible
      3. Assert: File tree nodes visible (TreeNode components)
      4. Click a file node
      5. Assert: File content loads and displays (ideContent area not empty)
    Expected Result: Explorer renders tree and opens file content
    Evidence: .sisyphus/evidence/task-12-explorer.png

  Scenario: Explorer handles empty tree gracefully
    Tool: Playwright
    Preconditions: No scan run yet (empty kb)
    Steps:
      1. Navigate to /workspace/[id]/explorer  
      2. Assert: Page renders without crash
      3. Assert: Empty state or "no files" message visible
    Expected Result: No crash, graceful empty state
    Evidence: .sisyphus/evidence/task-12-explorer-empty.png
  ```

  **Commit**: YES | Message: `feat(explorer): implement IDE simulator route page`

- [x] 13. Implement graph route (GREEN)

  **What to do**:
  - Implement `frontend/app/workspace/[sessionId]/graph/page.tsx`
  - Use `useParams()`, `useWorkspaceStatus()` for `kb?.tree` and `status?.repo`
  - Render: `<NodeGraph tree={kb?.tree || []} repoInfo={status?.repo ?? null} />` with heading "⬡ Node Architecture Graph"
  - Wrap in `<div data-testid="graph-page" className="h-full">`
  - GREEN: `npm test -- workspace/graph-route` → 3 tests PASS

  **Must NOT do**: Do NOT modify NodeGraph component

  **Recommended Agent Profile**: **Category**: `quick` | **Skills**: []

  **Parallelization**: Wave 3 | **Blocks**: None | **Blocked By**: T4 (RED test)

  **References**: `frontend/app/workspace/[sessionId]/page.tsx:213-219` — Current graph rendering to replicate

  **Acceptance Criteria**:
  - [ ] Graph route renders with NodeGraph component
  - [ ] `npm test -- workspace/graph-route` → 3 tests PASS

  **QA Scenarios**:
  ```
  Scenario: Graph renders architecture visualization
    Tool: Playwright
    Steps: 1. Navigate to /workspace/[id]/graph
          2. Assert: data-testid="graph-page" visible with SVG content
    Evidence: .sisyphus/evidence/task-13-graph.png
  ```

  **Commit**: YES | Message: `feat(graph): implement node architecture route page`

- [x] 14. Implement wiki route (GREEN)

  **What to do**:
  - Implement `frontend/app/workspace/[sessionId]/wiki/page.tsx`
  - Use `useWorkspaceStatus()` for `kb`
  - Render: `<WikiPanel kb={kb} />` in wrapper div
  - GREEN: `npm test -- workspace/wiki-route` → 3 tests PASS

  **Must NOT do**: Do NOT modify WikiPanel component

  **Recommended Agent Profile**: **Category**: `quick` | **Skills**: []

  **Parallelization**: Wave 3 | **Blocks**: None | **Blocked By**: T5 (RED test)

  **References**: `frontend/app/workspace/[sessionId]/page.tsx:221` — Current wiki rendering

  **Acceptance Criteria**:
  - [ ] Wiki route renders with WikiPanel
  - [ ] `npm test -- workspace/wiki-route` → 3 tests PASS

  **QA Scenarios**: Navigate to /workspace/[id]/wiki → assert panel renders → `.sisyphus/evidence/task-14-wiki.png`

  **Commit**: YES | Message: `feat(wiki): implement gitbook wiki route page`

- [x] 15. Implement insight route (GREEN)

  **What to do**:
  - Implement `frontend/app/workspace/[sessionId]/insight/page.tsx`
  - Use `useWorkspaceStatus()` for `kb`
  - Render: `<InsightsPanel kb={kb} />`
  - GREEN: `npm test -- workspace/insight-route` → 3 tests PASS

  **Must NOT do**: Do NOT modify InsightsPanel

  **Recommended Agent Profile**: **Category**: `quick` | **Skills**: []

  **Parallelization**: Wave 3 | **Blocks**: None | **Blocked By**: T6 (RED test)

  **References**: `frontend/app/workspace/[sessionId]/page.tsx:222` — Current insight rendering

  **Acceptance Criteria**:
  - [ ] Insight route renders with InsightsPanel
  - [ ] `npm test -- workspace/insight-route` → 3 tests PASS

  **QA Scenarios**: → `.sisyphus/evidence/task-15-insight.png`

  **Commit**: YES | Message: `feat(insight): implement AI insight route page`

- [x] 16. Implement history route + chat context (GREEN)

  **What to do**:
  - Implement `frontend/app/workspace/[sessionId]/history/page.tsx`
  - Use `useChat()` from `@/hooks/useWorkspaceChat` to access `chatHistory`
  - Note: `WorkspaceChatProvider` is already in layout — `useChat()` works in any nested page
  - Render: `<RagPanel chatHistory={chatHistory || []} />`
  - GREEN: `npm test -- workspace/history-route` → 3 tests PASS

  **Must NOT do**: Do NOT create a new chat provider — use existing one from layout

  **Recommended Agent Profile**: **Category**: `deep`
    - Reason: Chat context integration — need to verify provider access pattern works correctly with `useChat()`
  - **Skills**: []

  **Parallelization**: Wave 3 | **Blocks**: None | **Blocked By**: T7 (RED test)

  **References**:
  - `frontend/hooks/useWorkspaceChat.tsx` — `useChat()` hook, `WorkspaceChatProvider`
  - `frontend/components/workspace/RagPanel.tsx` — Props: `chatHistory`

  **Acceptance Criteria**:
  - [ ] History route renders RagPanel with chat history
  - [ ] Chat history persists when navigating between routes
  - [ ] `npm test -- workspace/history-route` → 3 tests PASS

  **QA Scenarios**:
  ```
  Scenario: Chat history visible and persists across navigation
    Tool: Playwright
    Steps:
      1. Send a chat message via Copilot sidebar
      2. Navigate to /workspace/[id]/history
      3. Assert: Chat message visible in RagPanel
      4. Navigate to /workspace/[id]/wiki
      5. Navigate back to /workspace/[id]/history
      6. Assert: Same chat message still visible
    Expected Result: Chat history persists across navigation
    Evidence: .sisyphus/evidence/task-16-history.png
  ```

  **Commit**: YES | Message: `feat(history): implement RAG trace/chat history route page`

- [x] 17. Implement jira route (GREEN)

  **What to do**:
  - Implement `frontend/app/workspace/[sessionId]/jira/page.tsx`
  - Use `useWorkspaceSession()` for session
  - Render: `<BacklogPanel backlog={session?.jira_backlog || []} />`
  - GREEN: `npm test -- workspace/jira-route` → 3 tests PASS

  **Must NOT do**: Do NOT modify BacklogPanel

  **Recommended Agent Profile**: **Category**: `quick` | **Skills**: []

  **Parallelization**: Wave 3 | **Blocks**: None | **Blocked By**: T8 (RED test)

  **References**: `frontend/app/workspace/[sessionId]/page.tsx:239` — Current backlog rendering

  **Acceptance Criteria**:
  - [ ] Jira route renders BacklogPanel with jira_backlog
  - [ ] `npm test -- workspace/jira-route` → 3 tests PASS

  **QA Scenarios**: → `.sisyphus/evidence/task-17-jira.png`

  **Commit**: YES | Message: `feat(jira): implement jira kanban route page`

- [x] 18. Wire scan-completion callback (→ /wiki)

  **What to do**:
  - In the new dashboard page (page.tsx), update the scan completion callback
  - Old code (page.tsx line 101-106): `onComplete: async () => { await fetchKb(); await fetchStatus(); chat.print('✅ Scan complete.'); setActiveTab('wiki') }`
  - New code: Replace `setActiveTab('wiki')` with `router.push(\`/workspace/${sessionId}/wiki\`)`
  - Ensure `useRouter` is imported and used
  - **Test**: Update `frontend/test/workspace/dashboard.test.tsx` to verify scan completion navigates to /wiki

  **Must NOT do**: Do NOT change any other scan completion behavior

  **Recommended Agent Profile**: **Category**: `quick` | **Skills**: []

  **Parallelization**: Wave 3 (with T12-T17) | **Blocks**: None | **Blocked By**: T9 (dashboard implemented)

  **References**: `frontend/app/workspace/[sessionId]/page.tsx:98-106` — Current scan polling + completion callback

  **Acceptance Criteria**:
  - [ ] Scan completion navigates to `/workspace/[sessionId]/wiki` instead of setting activeTab
  - [ ] `npm test -- workspace/dashboard` → all tests still PASS (including new scan-completion test)

  **QA Scenarios**:
  ```
  Scenario: Scan completion redirects to wiki
    Tool: Playwright / Bash (curl)
    Preconditions: Repo configured, scan triggered
    Steps:
      1. Trigger scan from dashboard (via /scan command)
      2. Wait for scan completion (status endpoint returns done)
      3. Assert: URL changes to /workspace/[id]/wiki
      4. Assert: Wiki page renders with project_summary
    Expected Result: Auto-redirect to wiki after scan
    Evidence: .sisyphus/evidence/task-18-scan-complete.png
  ```

  **Commit**: YES | Message: `fix(dashboard): replace setActiveTab('wiki') with router.push after scan`

### Wave 4: Cleanup + Verification (4 parallel tasks)

- [x] 19. Strip MainStage tabbed code from page.tsx

  **What to do**:
  - Remove ALL MainStage-related code from `frontend/app/workspace/[sessionId]/page.tsx`:
    - Remove `MainStage` import
    - Remove `activeTab`, `setActiveTab` state
    - Remove `activeActivity`, `setActiveActivity` state
    - Remove `MainStage` JSX (lines 196-243)
    - Remove all conditional panel rendering (lines 212-242)
    - Remove all panel imports (IdePanel, NodeGraph, WikiPanel, InsightsPanel, RagPanel, SdlcPanel, BacklogPanel, DbPanel, WorldPanel)
    - Remove `SessionsPanel` and `TracingPanel` and `SettingsPanel` inline rendering (lines 245-262)
    - Remove `CommandPalette` (now handled by layout)
  - Keep: data fetching (fetchSession, fetchStatus, fetchKb), polling, toast, onboarding
  - After cleanup: dashboard page should be ~150 lines (down from ~375)
  - **Verification**: Run `grep -rn 'activeTab\|setActiveTab\|MainStage' frontend/app/workspace/[sessionId]/page.tsx` — must return NO results

  **Must NOT do**:
  - Do NOT remove data fetching or polling logic
  - Do NOT remove onboarding wizard
  - Do NOT remove toast system
  - Do NOT leave commented-out code

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: High-risk deletion — must carefully remove only tabbed code while preserving dashboard + data fetching
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with T20-T22)
  - **Blocks**: F1-F4 (final verification)
  - **Blocked By**: T9 (dashboard), T10 (delete modal moved), T12-T18 (all routes implemented)

  **References**:
  - `frontend/app/workspace/[sessionId]/page.tsx` — Full file to clean up
  - `frontend/app/workspace/[sessionId]/layout.tsx` — Layout that already handles CommandPalette + WorkspaceLayout shell

  **Acceptance Criteria**:
  - [ ] `grep -rn 'activeTab\|setActiveTab\|MainStage' frontend/app/workspace/[sessionId]/page.tsx` returns nothing
  - [ ] No panel component imports remain in page.tsx (except for reference)
  - [ ] `npm run build` passes
  - [ ] `npm test -- workspace/dashboard` → all tests PASS
  - [ ] Dashboard page still renders stats + cards + onboarding

  **QA Scenarios**:
  ```
  Scenario: Dashboard works after cleanup
    Tool: Playwright
    Steps:
      1. Navigate to /workspace/[id]
      2. Assert: Dashboard renders with stats and cards (no MainStage)
      3. Click each card → navigates to correct route
      4. Assert: No console errors
    Expected Result: Clean dashboard with no tabbed UI remnants
    Evidence: .sisyphus/evidence/task-19-clean-dashboard.png

  Scenario: Dead code verified
    Tool: Bash
    Steps:
      1. grep -rn 'activeTab\|MainStage' frontend/app/workspace/[sessionId]/page.tsx
      2. Assert: No output (empty)
    Expected Result: Zero matches
    Evidence: .sisyphus/evidence/task-19-dead-code.txt
  ```

  **Commit**: YES | Message: `refactor(page): strip MainStage tabbed code, keep dashboard only`

- [x] 20. Remove activeTab/activeActivity from layout.tsx

  **What to do**:
  - Remove `activeActivity`/`setActiveActivity` and `activeTab`/`setActiveTab` state from layout.tsx
  - Remove the `ActivityId` and `MainTabId` type imports
  - Remove `setActiveTab` and `setActiveActivity` from `useWorkspaceChat` options (lines 50-51)
  - Remove `activeActivity` and `activeTab` from `WorkspaceLayout` props (lines 62-65)
  - `WorkspaceLayout` should still receive all other props (sessionName, onOpenCommandPalette, etc.)
  - The layout should rely entirely on route-based navigation (via AppSidebar/ActivityBar which use `next/navigation` directly)

  **Must NOT do**:
  - Do NOT remove `useWorkspaceSession`, `useWorkspaceStatus`, `useWorkspaceSdlc`, `WorkspaceChatProvider`
  - Do NOT remove any other WorkspaceLayout props

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Layout changes affect all routes — must verify no breakage
  - **Skills**: []

  **Parallelization**: Wave 4 | **Blocks**: F1-F4 | **Blocked By**: T19 (page.tsx cleanup)

  **References**:
  - `frontend/app/workspace/[sessionId]/layout.tsx:10-11` — ActivityId/MainTabId imports
  - `frontend/app/workspace/[sessionId]/layout.tsx:24-25` — activeActivity/activeTab state
  - `frontend/app/workspace/[sessionId]/layout.tsx:50-51` — setActiveTab/setActiveActivity in chatCtx
  - `frontend/app/workspace/[sessionId]/layout.tsx:62-65` — WorkspaceLayout props

  **Acceptance Criteria**:
  - [ ] No `activeTab`, `activeActivity`, `setActiveTab`, `setActiveActivity` in layout.tsx
  - [ ] `MainTabId` import removed from layout.tsx
  - [ ] All workspace routes still render correctly
  - [ ] `npm run build` passes

  **QA Scenarios**:
  ```
  Scenario: Layout works without activeTab state
    Tool: Playwright
    Steps:
      1. Navigate to /workspace/[id] (dashboard)
      2. Navigate to /workspace/[id]/explorer via sidebar
      3. Navigate to /workspace/[id]/wiki via sidebar
      4. Navigate to /workspace/[id]/graph via sidebar
      5. Assert: Each route renders correctly, sidebar highlights active item
    Expected Result: All navigation works via route-based system only
    Evidence: .sisyphus/evidence/task-20-layout-clean.png
  ```

  **Commit**: YES | Message: `refactor(layout): remove activeTab/activeActivity, rely on route-based nav`

- [x] 21. Dead code purge + lint verification

  **What to do**:
  - Run `grep -rn 'activeTab\|setActiveTab\|MainStage' frontend/app/workspace/ frontend/components/workspace/` across the codebase
  - For any remaining references in workspace components:
    - `MainStage.tsx` — if no consumers remain, this file can be marked as deprecated (or removed if confirmed unused)
    - Any `activeTab`/`setActiveTab` references in hooks — confirm they're harmless (may still exist in hook signatures)
  - Run `npm run lint` (Biome) — fix any unused import warnings
  - Run `npm run lint` again — must pass clean

  **Must NOT do**:
  - Do NOT delete `MainStage.tsx` unless confirmed as unused by all consumers
  - Do NOT modify hook signatures that still accept `setActiveTab` (backward compat)

  **Recommended Agent Profile**: **Category**: `quick` | **Skills**: []

  **Parallelization**: Wave 4 | **Blocks**: F1-F4 | **Blocked By**: T19, T20

  **References**: Use `grep` + `npm run lint` for verification

  **Acceptance Criteria**:
  - [ ] `nm run lint` passes with 0 errors and 0 warnings
  - [ ] No dead imports in any modified files
  - [ ] `npm run build` passes

  **QA Scenarios**:
  ```
  Scenario: Lint clean
    Tool: Bash
    Steps: 1. cd frontend && npm run lint 2>&1
    Expected Result: Exit code 0, no warnings
    Evidence: .sisyphus/evidence/task-21-lint.txt

  Scenario: Build succeeds
    Tool: Bash  
    Steps: 1. cd frontend && npm run build 2>&1
    Expected Result: Exit code 0, "✓ Compiled successfully"
    Evidence: .sisyphus/evidence/task-21-build.txt
  ```

  **Commit**: YES | Message: `chore: purge dead imports, lint clean`

- [x] 22. Navigation tests update

  **What to do**:
  - Update existing navigation tests to cover new routes:
    - `frontend/test/activity-bar-routing.test.tsx` — add assertions for 5 new activity items
    - `frontend/app/workspace/[sessionId]/navigation.test.tsx` — add route resolution tests for new paths
    - `frontend/components/workspace/AppSidebar.test.tsx` — verify new items appear in sidebar
  - Ensure all existing tests still pass
  - Run full test suite: `npm test`

  **Must NOT do**: Do NOT remove or rewrite existing test assertions — only add new ones

  **Recommended Agent Profile**: **Category**: `quick` | **Skills**: []

  **Parallelization**: Wave 4 | **Blocks**: F1-F4 | **Blocked By**: T1 (nav items added)

  **References**:
  - `frontend/test/activity-bar-routing.test.tsx` — Existing routing tests
  - `frontend/app/workspace/[sessionId]/navigation.test.tsx` — Route-level tests

  **Acceptance Criteria**:
  - [ ] Navigation tests cover all 13 activity items
  - [ ] `npm test` → all tests PASS (0 failures)
  - [ ] New route paths resolve correctly in tests

  **QA Scenarios**:
  ```
  Scenario: Full test suite passes
    Tool: Bash
    Steps: 1. cd frontend && npx vitest run 2>&1
    Expected Result: All tests PASS, 0 failures
    Evidence: .sisyphus/evidence/task-22-full-tests.txt
  ```

  **Commit**: YES | Message: `test(nav): update navigation tests for new routes`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval.**

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, check page renders at correct route). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in `.sisyphus/evidence/`. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run `cd frontend && npm run build` + `npm run lint` + `npm test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, `console.log` in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp).
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill)
  Start from clean state. Execute EVERY QA scenario from EVERY task. Test cross-route integration: navigate between all 7 tool routes + dashboard, verify chat persists, verify file-open works, verify scan completion redirects. Test edge cases: direct URL access, empty state, browser back/forward.
  Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination: Task N touching Task M's files. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

| Wave | Task | Commit Message |
|------|------|---------------|
| 1 | T1 | `feat(nav): add graph, wiki, insight, history, jira items, rename chat to Dashboard` |
| 1 | T2 | `test(dashboard): add RED-phase tests for dashboard page` |
| 1 | T3 | `test(explorer): add RED-phase tests + skeleton page for explorer route` |
| 1 | T4 | `test(graph): add RED-phase tests + skeleton page for graph route` |
| 1 | T5 | `test(wiki): add RED-phase tests + skeleton page for wiki route` |
| 1 | T6 | `test(insight): add RED-phase tests + skeleton page for insight route` |
| 1 | T7 | `test(history): add RED-phase tests + skeleton page for history route` |
| 1 | T8 | `test(jira): add RED-phase tests + skeleton page for jira route` |
| 2 | T9 | `feat(dashboard): implement stats + navigational cards, preserve onboarding` |
| 2 | T10 | `refactor(layout): hoist delete session modal from page to layout` |
| 2 | T11 | `feat(layout): wire file-open callback to router.push('/explorer')` |
| 3 | T12 | `feat(explorer): implement IDE simulator route page` |
| 3 | T13 | `feat(graph): implement node architecture route page` |
| 3 | T14 | `feat(wiki): implement gitbook wiki route page` |
| 3 | T15 | `feat(insight): implement AI insight route page` |
| 3 | T16 | `feat(history): implement RAG trace/chat history route page` |
| 3 | T17 | `feat(jira): implement jira kanban route page` |
| 3 | T18 | `fix(dashboard): replace setActiveTab('wiki') with router.push after scan` |
| 4 | T19 | `refactor(page): strip MainStage tabbed code, keep dashboard only` |
| 4 | T20 | `refactor(layout): remove activeTab/activeActivity, rely on route-based nav` |
| 4 | T21 | `chore: purge dead imports, lint clean` |
| 4 | T22 | `test(nav): update navigation tests for new routes` |

---

## Success Criteria

### Verification Commands
```bash
# All unit tests pass
cd frontend && npm test

# Build succeeds
cd frontend && npm run build

# Lint clean
cd frontend && npm run lint

# Dead code verification — these must return NOTHING
grep -rn 'activeTab\|setActiveTab\|MainStage' frontend/app/workspace/
grep -rn 'activeTab\|setActiveTab\|MainStage' frontend/components/workspace/

# All route pages exist
ls frontend/app/workspace/\[sessionId\]/explorer/page.tsx
ls frontend/app/workspace/\[sessionId\]/graph/page.tsx
ls frontend/app/workspace/\[sessionId\]/wiki/page.tsx
ls frontend/app/workspace/\[sessionId\]/insight/page.tsx
ls frontend/app/workspace/\[sessionId\]/history/page.tsx
ls frontend/app/workspace/\[sessionId\]/jira/page.tsx

# Navigation has 13 items
grep -c "routeSuffix:" frontend/lib/workspace-navigation.ts  # Expected: 13
```

### Final Checklist
- [ ] All 7 route pages render their panel at the correct URL
- [ ] Dashboard shows stats: repo, files, scan, SDLC, chats
- [ ] Dashboard has 7 navigational cards linking to all tools
- [ ] Delete modal accessible from all routes (hoisted to layout)
- [ ] Chat history persists across route navigation
- [ ] IDE file-open navigates to /explorer (not tab switch)
- [ ] Scan completion navigates to /wiki (not tab switch)
- [ ] No MainStage, activeTab, or activeActivity in page.tsx or layout.tsx
- [ ] All tests pass, build succeeds, lint clean
- [ ] Onboarding wizard preserved on dashboard
