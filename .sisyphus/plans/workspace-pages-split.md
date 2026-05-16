# Workspace Pages Split Refactor

## TL;DR

> **Quick Summary**: Split the current all-in-one `WorkspacePage` into session-scoped Next.js routes under `/workspace/[sessionId]`, with persistent workspace providers/layout and a ChatGPT-inspired AI Copilot index page.
>
> **Deliverables**:
> - `/workspace/[sessionId]` as independent AI Copilot page.
> - `/workspace/[sessionId]/explorer`, `/sdlc`, `/settings`, `/world`, `/database`, `/sessions`, `/tracing` pages.
> - Shared workspace providers/hooks for session/status/kb/chat/SDLC/UI state.
> - TDD characterization/provider/route tests plus agent-executed Playwright QA evidence.
>
> **Estimated Effort**: XL
> **Parallel Execution**: YES - 6 waves
> **Critical Path**: T1 → T2 → T3/T4/T5 → T6 → T7 → route tasks → T16 → Final Verification

---

## Context

### Original Request
User wants to split the current AIO workspace layout into pages such as settings, explorer, and SDLC.

### Interview Summary
**Key Discussions**:
- Routes are session-scoped: `/workspace/[sessionId]/...`, not top-level `/settings`.
- SDLC route spelling is `/sdlc`.
- Existing `/workspace/[sessionId]` becomes AI Copilot.
- AI Copilot chat must become an independent component with ChatGPT-inspired layout while preserving Yummy shell/branding.
- Pages in scope: AI Copilot, Explorer, SDLC, Settings, World, Database, Sessions, Tracing.
- Test strategy: TDD using existing frontend Vitest + jsdom, plus mandatory agent-executed QA.

**Research Findings**:
- `frontend/app/page.tsx` creates/fetches a session and redirects to `/workspace/{sessionId}`.
- `frontend/app/layout.tsx` is the only layout today; no nested workspace layout exists.
- `frontend/app/workspace/[sessionId]/page.tsx` exports `WorkspacePage` and is a 1000+ line client monolith.
- `WorkspacePage` owns session/status/kb/metrics polling, chat/terminal state, IDE state, SDLC streaming, UI preferences, command palette, onboarding/toasts.
- Current visual shell/components live under `frontend/components/workspace/*`, including `WorkspaceLayout.tsx`, `ActivityBar.tsx`, `MainStage.tsx`, `AICopilot.tsx`, `IdePanel.tsx`, `SdlcPanel.tsx`, `SettingsPanel.tsx`, `WorldPanel.tsx`, `DbPanel.tsx`, `SessionsPanel.tsx`, and `TracingPanel.tsx`.
- Frontend tests use Vitest + jsdom. Representative tests: `frontend/app/workspace/[sessionId]/settingsSync.test.tsx`, `frontend/test/world-sdlc.test.tsx`, `frontend/test/world.test.tsx`.
- GitNexus upstream impact for `WorkspacePage`: LOW, 0 direct callers, but internal state extraction remains high-complexity.

### Metis Review
**Identified Gaps** (addressed):
- Stream lifecycle was unspecified: default is streams continue across nested workspace route changes because providers live in `layout.tsx`; streams abort when leaving the session workspace/unmounting the layout.
- ActivityBar behavior was unspecified: convert panel switching to route navigation while preserving visual order/position.
- AI Copilot scope could creep: visual reskin only; no new chat features.
- Command palette behavior was unspecified: commands navigate to routes.
- Deep-linking scope was unspecified: route-level deep links only; internal tab/filter state stays component-local unless already persisted.

---

## Work Objectives

### Core Objective
Refactor the workspace from a monolithic client page into route-based, deep-linkable pages while preserving current behavior and isolating shared state in persistent workspace providers.

### Concrete Deliverables
- `frontend/app/workspace/[sessionId]/layout.tsx` persistent workspace layout/provider shell.
- `frontend/app/workspace/[sessionId]/page.tsx` AI Copilot page.
- `frontend/app/workspace/[sessionId]/explorer/page.tsx`.
- `frontend/app/workspace/[sessionId]/sdlc/page.tsx`.
- `frontend/app/workspace/[sessionId]/settings/page.tsx`.
- `frontend/app/workspace/[sessionId]/world/page.tsx`.
- `frontend/app/workspace/[sessionId]/database/page.tsx`.
- `frontend/app/workspace/[sessionId]/sessions/page.tsx`.
- `frontend/app/workspace/[sessionId]/tracing/page.tsx`.
- Provider/hook modules under existing frontend conventions, preferably `frontend/components/workspace/*` or `frontend/hooks/*`; avoid new global state libraries.

### Definition of Done
- [ ] `cd frontend && npm test` passes.
- [ ] `cd frontend && npm run build` passes.
- [ ] All new routes cold-load and deep-link with Playwright evidence.
- [ ] `gitnexus_detect_changes({scope: "all", repo: "yummy"})` reports expected frontend-only scope.
- [ ] Old monolithic panel composition is removed or reduced to AI Copilot/index behavior only.

### Must Have
- Session-scoped route structure under `/workspace/[sessionId]`.
- Persistent workspace shell across nested routes.
- SDLC/chat stream lifecycle explicitly tested.
- TDD: failing test first for each extraction/migration, then implementation.
- AI Copilot independent component with ChatGPT-inspired centered conversation/composer/empty state.

### Must NOT Have (Guardrails)
- No backend changes under `backend-ts/`.
- No Redux/Zustand/Jotai or new state management library.
- No new AI chat features such as regenerate, branching, prompt library, voice, file attach, export, or provider switching.
- No backend API shape changes and no snake_case/camelCase conversion changes.
- No drive-by redesign of non-AI-Copilot panels.
- No unrelated type cleanup, component renames, animation systems, breadcrumbs, or route transition effects.

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** - ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: TDD
- **Framework**: Vitest + jsdom
- **If TDD**: Each task follows RED (failing test) → GREEN (minimal implementation) → REFACTOR.

### QA Policy
Every task MUST include agent-executed QA scenarios. Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Frontend/UI**: Use Playwright - navigate, interact, assert DOM, screenshot.
- **Library/Module**: Use Bash - run Vitest targeted tests and save output.
- **Backend availability when needed**: Use Bash curl to assert backend health before browser QA.

---

## Execution Strategy

### Parallel Execution Waves

```text
Wave 0 (De-risk + baselines):
├── T1: Navigation testing spike and characterization baselines [quick]

Wave 1 (Provider contracts and high-risk state, after T1):
├── T2: Workspace contracts and stream lifecycle tests [deep]
├── T3: Session/status/kb/ui providers [unspecified-high]
├── T4: Chat provider and AI Copilot component tests [visual-engineering]
└── T5: SDLC provider streaming tests/extraction [deep]

Wave 2 (Shell and navigation, after T2-T5):
├── T6: Nested workspace layout and provider shell [unspecified-high]
└── T7: Route-aware ActivityBar and command palette [quick]

Wave 3 (Core routes, after T6-T7):
├── T8: AI Copilot index route [visual-engineering]
├── T9: Explorer route [unspecified-high]
├── T10: SDLC route [deep]
└── T11: Settings route [unspecified-high]

Wave 4 (Secondary routes, after T6-T7):
├── T12: World route [unspecified-high]
├── T13: Database route [quick]
├── T14: Sessions route [quick]
└── T15: Tracing route [quick]

Wave 5 (Cleanup and integration):
└── T16: Remove monolith leftovers and run full gates [deep]

Wave FINAL:
├── F1: Plan Compliance Audit (oracle)
├── F2: Code Quality Review (unspecified-high)
├── F3: Real Manual QA (unspecified-high + playwright)
└── F4: Scope Fidelity Check (deep)
```

### Dependency Matrix

| Task | Blocked By | Blocks | Wave |
|---|---|---|---|
| T1 | None | T2-T16 | 0 |
| T2 | T1 | T3-T6, T10, T16 | 1 |
| T3 | T1, T2 | T6, T9, T11-T15 | 1 |
| T4 | T1, T2 | T6, T8 | 1 |
| T5 | T1, T2 | T6, T10 | 1 |
| T6 | T2-T5 | T7-T16 | 2 |
| T7 | T6 | T8-T15 | 2 |
| T8 | T4, T6, T7 | T16 | 3 |
| T9 | T3, T6, T7 | T16 | 3 |
| T10 | T5, T6, T7 | T16 | 3 |
| T11 | T3, T6, T7 | T16 | 3 |
| T12 | T3, T6, T7 | T16 | 4 |
| T13 | T3, T6, T7 | T16 | 4 |
| T14 | T3, T6, T7 | T16 | 4 |
| T15 | T3, T6, T7 | T16 | 4 |
| T16 | T8-T15 | Final | 5 |

### Agent Dispatch Summary

- **Wave 0**: T1 → `quick`
- **Wave 1**: T2/T5 → `deep`, T3 → `unspecified-high`, T4 → `visual-engineering`
- **Wave 2**: T6 → `unspecified-high`, T7 → `quick`
- **Wave 3**: T8 → `visual-engineering`, T9/T11 → `unspecified-high`, T10 → `deep`
- **Wave 4**: T12 → `unspecified-high`, T13-T15 → `quick`
- **Wave 5**: T16 → `deep`

---

## TODOs

> Implementation + Test = ONE Task. Every task starts with required GitNexus impact checks for edited symbols and ends with `gitnexus_detect_changes` scope verification.

- [x] 1. Navigation test spike and characterization baselines

  **What to do**:
  - RED: Add/adjust Vitest tests proving `next/navigation` mocks can render workspace routes with `useParams`, `useRouter`, and route links.
  - RED: Add characterization tests for current `WorkspacePage` panel rendering before extraction.
  - Capture Playwright screenshots of current workspace panels as visual baselines: AI Copilot, Explorer, SDLC, Settings, World, Database, Sessions, Tracing.
  - Run `gitnexus_impact` on `WorkspacePage` before any test-adjacent page import changes.

  **Must NOT do**:
  - Do not refactor production components yet.
  - Do not change route behavior.

  **Recommended Agent Profile**:
  - **Category**: `quick` — targeted test spike and evidence capture.
  - **Skills**: [`playwright`] — browser baseline screenshots.
  - **Skills Evaluated but Omitted**: `frontend-ui-ux` — no redesign yet.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 0
  - **Blocks**: T2-T16
  - **Blocked By**: None

  **References**:
  - `frontend/app/workspace/[sessionId]/page.tsx:WorkspacePage` — current behavior baseline.
  - `frontend/app/workspace/[sessionId]/settingsSync.test.tsx` — existing route-local Vitest style.
  - `frontend/test/world-sdlc.test.tsx` — representative SDLC/world test patterns.
  - `frontend/test/setup.ts` — jsdom setup.

  **Acceptance Criteria**:
  - [ ] Failing tests are created before production changes.
  - [ ] `cd frontend && npm test -- settingsSync` passes or intentionally documents current failures.
  - [ ] Baseline evidence exists under `.sisyphus/evidence/task-1-*`.

  **QA Scenarios**:
  ```text
  Scenario: Current workspace baseline loads
    Tool: Playwright
    Preconditions: frontend dev server running; backend available or mocked as existing tests require
    Steps:
      1. Navigate to http://localhost:3000/workspace/test-session-123.
      2. Assert document body is visible and URL remains `/workspace/test-session-123`.
      3. Assert browser console contains no uncaught runtime errors.
      4. Capture screenshot.
    Expected Result: Current workspace renders without console errors.
    Evidence: .sisyphus/evidence/task-1-workspace-baseline.png

  Scenario: Invalid navigation mock fails clearly
    Tool: Bash
    Preconditions: frontend dependencies installed
    Steps:
      1. Run `cd frontend && npm test -- --run navigation`.
      2. Assert output contains the route mock test name and PASS.
    Expected Result: Navigation test infra is reliable before extraction.
    Evidence: .sisyphus/evidence/task-1-navigation-test-output.txt
  ```

  **Commit**: YES
  - Message: `test(workspace): add route split characterization baselines`
  - Files: frontend tests and `.sisyphus/evidence` only
  - Pre-commit: `cd frontend && npm test`

- [x] 2. Workspace contracts and stream lifecycle tests

  **What to do**:
  - Define provider contract types for workspace session, status/kb/ui, chat, and SDLC state.
  - RED: Add tests documenting default lifecycle: chat and SDLC streams continue across nested `/workspace/[sessionId]/*` route changes and abort when the workspace layout unmounts/leaves the session.
  - Document that route-level deep linking is in scope; internal tab/filter URL state is out of scope.
  - Run `gitnexus_impact` for any extracted symbols (`sendAsk`, `runSdlcStream`, `fetchSession`, `fetchStatus`, `fetchKb`) before editing.

  **Must NOT do**:
  - Do not add new runtime state library.
  - Do not change API request/response shapes.

  **Recommended Agent Profile**:
  - **Category**: `deep` — lifecycle semantics affect the full refactor.
  - **Skills**: []
  - **Skills Evaluated but Omitted**: `playwright` — this task is contract/test-level.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 with T3-T5 after T1, but T3-T5 must consume final contracts.
  - **Blocks**: T3-T6, T10, T16
  - **Blocked By**: T1

  **References**:
  - `frontend/app/workspace/[sessionId]/page.tsx` — inline state/functions to model.
  - `frontend/lib/api.ts:askStream` — chat streaming source.
  - `frontend/lib/api.ts:sdlcStream` and SDLC stream helpers — SDLC streaming source.
  - `frontend/hooks/useScanPoll.ts` — precedent for extracted lifecycle hook.

  **Acceptance Criteria**:
  - [ ] Contract tests fail before providers exist.
  - [ ] Stream lifecycle behavior is encoded in tests and plan comments.
  - [ ] No backend files changed.

  **QA Scenarios**:
  ```text
  Scenario: Stream persists across nested route change
    Tool: Bash
    Preconditions: mocked async generator test exists
    Steps:
      1. Run `cd frontend && npm test -- --run stream-lifecycle`.
      2. Assert output includes `continues across workspace child route navigation` PASS.
    Expected Result: Lifecycle contract is executable.
    Evidence: .sisyphus/evidence/task-2-stream-lifecycle.txt

  Scenario: Stream aborts on workspace layout unmount
    Tool: Bash
    Preconditions: mocked AbortController test exists
    Steps:
      1. Run `cd frontend && npm test -- --run stream-lifecycle`.
      2. Assert output includes `aborts on workspace layout unmount` PASS.
    Expected Result: Cleanup is verified.
    Evidence: .sisyphus/evidence/task-2-stream-abort.txt

  Scenario: Stream lifecycle route smoke
    Tool: Playwright
    Preconditions: frontend dev server running with mocked long-running stream test page or completed provider test harness route
    Steps:
      1. Navigate to http://localhost:3000/workspace/test-session-123/sdlc.
      2. Start mocked stream via `[data-testid="sdlc-run-button"]`.
      3. Navigate to `/workspace/test-session-123/explorer`.
      4. Navigate back to `/workspace/test-session-123/sdlc`.
      5. Assert `[data-testid="sdlc-stream-event"]` reflects the T2 persistence contract.
    Expected Result: Browser behavior matches the executable lifecycle contract.
    Evidence: .sisyphus/evidence/task-2-stream-route-smoke.png
  ```

  **Commit**: YES
  - Message: `test(workspace): define provider lifecycle contracts`
  - Files: frontend test/type files only
  - Pre-commit: `cd frontend && npm test -- --run stream-lifecycle`

- [x] 3. Session, status, knowledge base, and UI providers

  **What to do**:
  - RED: Add provider tests for session bootstrap, invalid session handling, status/kb polling, UI theme/size persistence.
  - Extract session/status/kb/ui logic from `WorkspacePage` into provider/hooks while preserving behavior.
  - Reuse `useScanPoll`; do not duplicate polling logic.
  - Expose page-friendly hooks consumed by later route tasks.

  **Must NOT do**:
  - Do not change `frontend/app/page.tsx` redirect semantics except as needed to keep `/workspace/[sessionId]` valid.
  - Do not introduce backend changes.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` — multi-concern provider extraction.
  - **Skills**: []
  - **Skills Evaluated but Omitted**: `ui-ux-pro-max` — no visual design.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 with T4-T5 after T2 contracts.
  - **Blocks**: T6, T9, T11-T15
  - **Blocked By**: T1, T2

  **References**:
  - `frontend/app/workspace/[sessionId]/page.tsx:fetchSession` — session load pattern.
  - `frontend/app/workspace/[sessionId]/page.tsx:fetchStatus` — status load pattern.
  - `frontend/app/workspace/[sessionId]/page.tsx:fetchKb` — kb load pattern.
  - `frontend/hooks/useScanPoll.ts` — scan polling integration.
  - `frontend/lib/theme.ts` and `frontend/lib/uiSize.ts` — persisted UI preferences.

  **Acceptance Criteria**:
  - [ ] Provider tests are written before extraction.
  - [ ] Providers clean intervals on unmount.
  - [ ] Invalid session state has deterministic UI/error state.

  **QA Scenarios**:
  ```text
  Scenario: Providers bootstrap session state
    Tool: Bash
    Preconditions: api mocks configured
    Steps:
      1. Run `cd frontend && npm test -- --run workspace-providers`.
      2. Assert output includes session/status/kb provider tests PASS.
    Expected Result: Providers expose current data without page monolith.
    Evidence: .sisyphus/evidence/task-3-provider-tests.txt

  Scenario: Invalid session is handled
    Tool: Bash
    Preconditions: sessions.get mock returns 404/error
    Steps:
      1. Run invalid-session provider test.
      2. Assert test expects visible error/empty state, not uncaught exception.
    Expected Result: Invalid session is graceful and test-covered.
    Evidence: .sisyphus/evidence/task-3-invalid-session.txt

  Scenario: Provider-backed route shows invalid session state
    Tool: Playwright
    Preconditions: frontend dev server running with API/mock configured to return missing session for `missing-session-404`
    Steps:
      1. Navigate to http://localhost:3000/workspace/missing-session-404/settings.
      2. Assert either `[data-testid="workspace-session-error"]` or the agreed invalid-session fallback is visible.
      3. Assert browser console contains no uncaught runtime errors.
    Expected Result: Provider error state is visible and route remains stable.
    Evidence: .sisyphus/evidence/task-3-invalid-session-browser.png
  ```

  **Commit**: YES
  - Message: `refactor(workspace): extract shared workspace providers`
  - Files: frontend provider/hook/tests
  - Pre-commit: `cd frontend && npm test -- --run workspace-providers`

- [x] 4. Chat provider and independent AI Copilot component

  **What to do**:
  - RED: Add tests for `askStream` consumption, user message append, assistant streaming append, and error handling.
  - Extract chat state/handlers (`chatHistory`, `termLogs`, `sendAsk`, `sendBtw`) into a chat provider/hook.
  - Refactor `AICopilot.tsx` or create a component in the same workspace component convention that is independent from `WorkspacePage` props.
  - Add concrete selectors: `data-testid="ai-copilot-page"`, `ai-copilot-message-list`, `ai-copilot-input`, `ai-copilot-send`, `ai-copilot-empty-state`.

  **Must NOT do**:
  - Do not add regenerate/history-sidebar/file-attach/voice/export features.
  - Do not change chat backend API integration.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` — component extraction plus ChatGPT-inspired UI.
  - **Skills**: [`frontend-ui-ux`]
  - **Skills Evaluated but Omitted**: `ui-ux-pro-max` — inspiration is simple and bounded.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 with T3/T5 after contracts.
  - **Blocks**: T6, T8
  - **Blocked By**: T1, T2

  **References**:
  - `frontend/components/workspace/AICopilot.tsx` — existing assistant UI.
  - `frontend/app/workspace/[sessionId]/page.tsx:sendAsk` — current streaming behavior.
  - `frontend/lib/api.ts:askStream` — API stream contract.

  **Acceptance Criteria**:
  - [ ] Chat tests are written before extraction.
  - [ ] Component can render from provider without `WorkspacePage` prop drilling.
  - [ ] UI has ChatGPT-inspired centered conversation and bottom composer while preserving Yummy shell.

  **QA Scenarios**:
  ```text
  Scenario: AI Copilot sends message
    Tool: Playwright
    Preconditions: frontend dev server running with mocked or available API
    Steps:
      1. Navigate to http://localhost:3000/workspace/test-session-123.
      2. Fill `[data-testid="ai-copilot-input"]` with `Summarize this workspace`.
      3. Click `[data-testid="ai-copilot-send"]`.
      4. Assert `[data-testid="ai-copilot-message-list"]` contains `Summarize this workspace`.
    Expected Result: User message appears and composer remains usable.
    Evidence: .sisyphus/evidence/task-4-ai-copilot-send.png

  Scenario: Chat stream error is graceful
    Tool: Bash
    Preconditions: askStream mock throws
    Steps:
      1. Run `cd frontend && npm test -- --run chat-provider`.
      2. Assert error-state test passes and no unhandled rejection is logged.
    Expected Result: Error is surfaced in chat state without crashing.
    Evidence: .sisyphus/evidence/task-4-chat-error.txt
  ```

  **Commit**: YES
  - Message: `refactor(chat): extract workspace copilot provider`
  - Files: AICopilot/provider/tests
  - Pre-commit: `cd frontend && npm test -- --run chat-provider`

- [x] 5. SDLC provider streaming extraction

  **What to do**:
  - RED: Add tests for SDLC stream events: start, content chunk, tool call/result, agent done, done, abort/error.
  - Extract `runSdlcStream`, `refreshSDLC`, approve/stop/restore handlers, streaming text, tool calls, busy state into `SdlcProvider`/hook.
  - Ensure provider owns AbortController and cleanup according to T2 lifecycle.
  - Add selectors expected by route QA: `sdlc-panel`, `sdlc-run-button`, `sdlc-stream-event`, `sdlc-stop-button`.

  **Must NOT do**:
  - Do not change SDLC payload shapes or backend endpoints.
  - Do not rewrite `SdlcPanel` visuals beyond provider wiring.

  **Recommended Agent Profile**:
  - **Category**: `deep` — highest-risk streaming state extraction.
  - **Skills**: []
  - **Skills Evaluated but Omitted**: `playwright` — Playwright occurs in route QA.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 with T3/T4 after contracts.
  - **Blocks**: T6, T10
  - **Blocked By**: T1, T2

  **References**:
  - `frontend/app/workspace/[sessionId]/page.tsx:runSdlcStream` — existing stream runner.
  - `frontend/components/workspace/SdlcPanel.tsx` — UI consumer.
  - `frontend/components/workspace/SDLCStepper.tsx` — SDLC progress UI.
  - `frontend/test/world-sdlc.test.tsx` — existing SDLC test patterns.

  **Acceptance Criteria**:
  - [ ] Stream event tests fail before extraction and pass after.
  - [ ] Abort cleanup is tested.
  - [ ] No unhandled promise rejection on route/layout unmount.

  **QA Scenarios**:
  ```text
  Scenario: SDLC stream events update state
    Tool: Bash
    Preconditions: mocked SDLC async generator emits start/chunk/done
    Steps:
      1. Run `cd frontend && npm test -- --run sdlc-provider`.
      2. Assert output includes event handling tests PASS.
    Expected Result: Provider handles stream events identically to old page logic.
    Evidence: .sisyphus/evidence/task-5-sdlc-provider.txt

  Scenario: SDLC abort cleanup
    Tool: Bash
    Preconditions: provider unmount test exists
    Steps:
      1. Run abort cleanup test.
      2. Assert AbortController signal is aborted and no state update after unmount occurs.
    Expected Result: Streaming cleanup is safe.
    Evidence: .sisyphus/evidence/task-5-sdlc-abort.txt

  Scenario: SDLC provider browser cleanup smoke
    Tool: Playwright
    Preconditions: frontend dev server running with long-running mocked SDLC stream
    Steps:
      1. Navigate to http://localhost:3000/workspace/test-session-123/sdlc.
      2. Click `[data-testid="sdlc-run-button"]`.
      3. Navigate away from `/workspace/test-session-123` to `/`.
      4. Assert browser console contains no state-update-after-unmount or unhandled rejection error.
    Expected Result: Layout unmount aborts stream safely in the browser.
    Evidence: .sisyphus/evidence/task-5-sdlc-browser-abort.png
  ```

  **Commit**: YES
  - Message: `refactor(sdlc): extract workspace stream provider`
  - Files: SDLC provider/tests/panel wiring
  - Pre-commit: `cd frontend && npm test -- --run sdlc-provider`

- [x] 6. Nested workspace layout and provider shell

  **What to do**:
  - RED: Add layout integration tests proving child pages render inside persistent workspace shell.
  - Create `frontend/app/workspace/[sessionId]/layout.tsx` as a client boundary if needed.
  - Mount workspace providers from T3-T5 and persistent shell using `WorkspaceLayout.tsx` conventions.
  - Ensure child route content renders in main content slot without remounting providers.
  - Add `data-testid="workspace-layout"`, `workspace-main-slot`, `workspace-nav` if not present.

  **Must NOT do**:
  - Do not move route panels in this task.
  - Do not redesign sidebars.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` — App Router layout integration.
  - **Skills**: []
  - **Skills Evaluated but Omitted**: `frontend-ui-ux` — structure only.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: T7-T16
  - **Blocked By**: T2-T5

  **References**:
  - `frontend/app/layout.tsx` — root layout convention.
  - `frontend/components/workspace/WorkspaceLayout.tsx` — shell to preserve.
  - `frontend/components/workspace/MainStage.tsx` — current main slot pattern.

  **Acceptance Criteria**:
  - [ ] Nested route child renders inside shell.
  - [ ] Providers persist across child navigation in tests.
  - [ ] `/workspace/[sessionId]` remains valid.

  **QA Scenarios**:
  ```text
  Scenario: Workspace child renders in layout
    Tool: Playwright
    Preconditions: frontend dev server running
    Steps:
      1. Navigate to http://localhost:3000/workspace/test-session-123.
      2. Assert `[data-testid="workspace-layout"]` is visible.
      3. Assert `[data-testid="workspace-main-slot"]` is visible.
    Expected Result: Persistent workspace shell wraps index page.
    Evidence: .sisyphus/evidence/task-6-layout-index.png

  Scenario: Invalid child route shows graceful Next.js result
    Tool: Playwright
    Preconditions: frontend dev server running
    Steps:
      1. Navigate to http://localhost:3000/workspace/test-session-123/not-a-route.
      2. Assert page does not crash and browser console has no uncaught runtime error.
    Expected Result: Invalid route handled by framework without app crash.
    Evidence: .sisyphus/evidence/task-6-invalid-child-route.png
  ```

  **Commit**: YES
  - Message: `refactor(workspace): add persistent route layout`
  - Files: workspace layout/tests
  - Pre-commit: `cd frontend && npm test -- --run workspace-layout`

- [x] 7. Route-aware ActivityBar and command palette

  **What to do**:
  - RED: Add tests for nav links to AI Copilot, Explorer, SDLC, Settings, World, Database, Sessions, Tracing.
  - Convert `ActivityBar.tsx` from local panel toggles to route-aware navigation while preserving visual order and active state.
  - Update `CommandPalette.tsx` commands to route with `router.push` to the new paths.
  - Add selectors: `nav-ai-copilot`, `nav-explorer`, `nav-sdlc`, `nav-settings`, `nav-world`, `nav-database`, `nav-sessions`, `nav-tracing`.

  **Must NOT do**:
  - Do not add breadcrumbs or transition animations.
  - Do not remove keyboard shortcuts unless replaced by route-aware equivalents.

  **Recommended Agent Profile**:
  - **Category**: `quick` — focused navigation rewiring.
  - **Skills**: []
  - **Skills Evaluated but Omitted**: `frontend-ui-ux` — preserve existing look.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 after T6
  - **Blocks**: T8-T15
  - **Blocked By**: T6

  **References**:
  - `frontend/components/workspace/ActivityBar.tsx` — current navigation UI.
  - `frontend/components/workspace/CommandPalette.tsx` — current command definitions.
  - `frontend/app/workspace/[sessionId]/layout.tsx` — route base and params.

  **Acceptance Criteria**:
  - [ ] All nav items use session-scoped URLs.
  - [ ] Active state follows current pathname.
  - [ ] Browser back/forward works across routes.

  **QA Scenarios**:
  ```text
  Scenario: ActivityBar navigates to settings
    Tool: Playwright
    Preconditions: frontend dev server running
    Steps:
      1. Navigate to http://localhost:3000/workspace/test-session-123.
      2. Click `[data-testid="nav-settings"]`.
      3. Assert URL ends with `/workspace/test-session-123/settings`.
    Expected Result: Navigation uses route, not local panel state.
    Evidence: .sisyphus/evidence/task-7-nav-settings.png

  Scenario: Unknown command is ignored safely
    Tool: Bash
    Preconditions: command palette tests exist
    Steps:
      1. Run `cd frontend && npm test -- --run command-palette`.
      2. Assert invalid/unknown command test passes without thrown error.
    Expected Result: Command palette routing is safe.
    Evidence: .sisyphus/evidence/task-7-command-invalid.txt
  ```

  **Commit**: YES
  - Message: `refactor(workspace): route activity navigation`
  - Files: ActivityBar/CommandPalette/tests
  - Pre-commit: `cd frontend && npm test -- --run navigation`

- [x] 8. AI Copilot index route

  **What to do**:
  - RED: Add route test for `/workspace/[sessionId]` rendering AI Copilot.
  - Replace old monolith index composition with independent AI Copilot page using T4 provider/component.
  - Implement ChatGPT-inspired layout: centered empty state, message list, sticky/bottom composer, clear input focus state.
  - Preserve Yummy workspace shell from layout.

  **Must NOT do**:
  - Do not add new chat features.
  - Do not remove existing terminal/log data if it is still required by current chat behavior.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` — bounded UI redesign.
  - **Skills**: [`frontend-ui-ux`]
  - **Skills Evaluated but Omitted**: `ui-ux-pro-max` — no large design system work.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 with T9-T11
  - **Blocks**: T16
  - **Blocked By**: T4, T6, T7

  **References**:
  - `frontend/app/workspace/[sessionId]/page.tsx` — index route to replace.
  - `frontend/components/workspace/AICopilot.tsx` — existing chat UI.
  - `frontend/components/workspace/WorkspaceLayout.tsx` — shell preservation.

  **Acceptance Criteria**:
  - [ ] `/workspace/test-session-123` renders AI Copilot page.
  - [ ] Empty, message, loading, and error states are tested.
  - [ ] Screenshot shows ChatGPT-inspired centered composer/message layout.

  **QA Scenarios**:
  ```text
  Scenario: AI Copilot index cold-load
    Tool: Playwright
    Preconditions: frontend dev server running
    Steps:
      1. Navigate directly to http://localhost:3000/workspace/test-session-123.
      2. Assert `[data-testid="ai-copilot-page"]` is visible.
      3. Assert `[data-testid="ai-copilot-input"]` is focused or focusable.
    Expected Result: Index route is AI Copilot, not old all-in-one workspace.
    Evidence: .sisyphus/evidence/task-8-copilot-index.png

  Scenario: AI Copilot handles empty prompt
    Tool: Playwright
    Preconditions: frontend dev server running
    Steps:
      1. Navigate to index route.
      2. Leave `[data-testid="ai-copilot-input"]` empty.
      3. Click `[data-testid="ai-copilot-send"]`.
      4. Assert no empty user message is appended.
    Expected Result: Empty submission is safely ignored or disabled.
    Evidence: .sisyphus/evidence/task-8-copilot-empty.png
  ```

  **Commit**: YES
  - Message: `feat(workspace): make index route ai copilot`
  - Files: index page/AICopilot/tests
  - Pre-commit: `cd frontend && npm test -- --run ai-copilot`

- [x] 9. Explorer route

  **What to do**:
  - RED: Add route tests for `/workspace/[sessionId]/explorer` cold-load/deep-link and file open behavior.
  - Create explorer page rendering current explorer/code-related content from `IdePanel.tsx` and related code explorer state from providers.
  - Preserve current code explorer visual behavior; no redesign.
  - Add selectors: `explorer-page`, `explorer-file-tree`, `explorer-editor`, `explorer-empty-state`.

  **Must NOT do**:
  - Do not add editor features or refactor file tree beyond route wiring.
  - Do not include NodeGraph/Wiki/RAG unless already part of the agreed explorer scope and current UX requires it.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` — route extraction plus provider wiring.
  - **Skills**: []
  - **Skills Evaluated but Omitted**: `frontend-ui-ux` — visual parity only.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: T16
  - **Blocked By**: T3, T6, T7

  **References**:
  - `frontend/components/workspace/IdePanel.tsx` — explorer UI.
  - `frontend/components/workspace/FileTree.tsx` — file tree.
  - `frontend/app/workspace/[sessionId]/page.tsx:openFile` — current file load behavior.
  - `frontend/lib/api.ts:kb.file` — file content API.

  **Acceptance Criteria**:
  - [ ] `/explorer` deep-link renders without visiting index first.
  - [ ] File open uses existing `api.kb.file` behavior.
  - [ ] Empty kb/file states are graceful.

  **QA Scenarios**:
  ```text
  Scenario: Explorer route cold-loads
    Tool: Playwright
    Preconditions: frontend dev server running
    Steps:
      1. Navigate to http://localhost:3000/workspace/test-session-123/explorer.
      2. Assert `[data-testid="explorer-page"]` is visible.
      3. Assert `[data-testid="workspace-layout"]` remains visible.
    Expected Result: Explorer route renders inside workspace shell.
    Evidence: .sisyphus/evidence/task-9-explorer-cold-load.png

  Scenario: Explorer empty KB state
    Tool: Bash
    Preconditions: kb provider mock returns empty file tree
    Steps:
      1. Run `cd frontend && npm test -- --run explorer-route`.
      2. Assert empty-state test passes and no file API call is made until selection.
    Expected Result: Empty KB does not crash route.
    Evidence: .sisyphus/evidence/task-9-explorer-empty.txt
  ```

  **Commit**: YES
  - Message: `feat(workspace): add explorer route`
  - Files: explorer route/tests
  - Pre-commit: `cd frontend && npm test -- --run explorer-route`

- [x] 10. SDLC route

  **What to do**:
  - RED: Add route tests for `/workspace/[sessionId]/sdlc` cold-load, stream start, cross-route return behavior.
  - Create SDLC page using `SdlcPanel.tsx`, `SDLCStepper.tsx`, and T5 provider.
  - Preserve approve/stop/restore behavior and stream display.
  - Ensure route change away and back follows T2 lifecycle.

  **Must NOT do**:
  - Do not change pipeline stages or backend payloads.
  - Do not add new SDLC agent features.

  **Recommended Agent Profile**:
  - **Category**: `deep` — streaming route integration.
  - **Skills**: [`playwright`]
  - **Skills Evaluated but Omitted**: `frontend-ui-ux` — visual parity.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: T16
  - **Blocked By**: T5, T6, T7

  **References**:
  - `frontend/components/workspace/SdlcPanel.tsx` — SDLC UI.
  - `frontend/components/workspace/SDLCStepper.tsx` — progress UI.
  - `frontend/components/workspace/AgentCard.tsx` — agent display.
  - `frontend/test/world-sdlc.test.tsx` — test precedent.

  **Acceptance Criteria**:
  - [ ] `/sdlc` deep-link renders SDLC panel.
  - [ ] Stream start and stop are tested.
  - [ ] Navigating `/sdlc` → `/explorer` → `/sdlc` preserves or aborts exactly according to T2 lifecycle.

  **QA Scenarios**:
  ```text
  Scenario: SDLC route stream starts
    Tool: Playwright
    Preconditions: backend or stream mock available
    Steps:
      1. Navigate to http://localhost:3000/workspace/test-session-123/sdlc.
      2. Assert `[data-testid="sdlc-panel"]` is visible.
      3. Click `[data-testid="sdlc-run-button"]`.
      4. Assert `[data-testid="sdlc-stream-event"]` appears within 10s.
    Expected Result: SDLC stream renders in route page.
    Evidence: .sisyphus/evidence/task-10-sdlc-stream.png

  Scenario: SDLC route preserves stream across navigation
    Tool: Playwright
    Preconditions: long-running mocked stream
    Steps:
      1. Start stream on `/sdlc`.
      2. Click `[data-testid="nav-explorer"]`.
      3. Click `[data-testid="nav-sdlc"]`.
      4. Assert stream state matches T2 contract.
    Expected Result: Cross-route lifecycle is deterministic.
    Evidence: .sisyphus/evidence/task-10-sdlc-cross-route.png
  ```

  **Commit**: YES
  - Message: `feat(workspace): add sdlc route`
  - Files: SDLC route/tests
  - Pre-commit: `cd frontend && npm test -- --run sdlc-route`

- [x] 11. Settings route

  **What to do**:
  - RED: Update/add tests for `/workspace/[sessionId]/settings` rendering and settings sync.
  - Create settings page rendering `SettingsPanel.tsx`/`SettingsDialog.tsx` via providers.
  - Preserve current settings save/load behavior and field names.
  - Add selectors: `settings-page`, `settings-form`, `settings-save`, `settings-error`.

  **Must NOT do**:
  - Do not add new settings.
  - Do not split every settings subform unless required for route/provider wiring.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` — large settings component route wiring.
  - **Skills**: []
  - **Skills Evaluated but Omitted**: `frontend-ui-ux` — no redesign.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: T16
  - **Blocked By**: T3, T6, T7

  **References**:
  - `frontend/components/workspace/SettingsPanel.tsx` — settings UI.
  - `frontend/components/workspace/SettingsDialog.tsx` — supplementary settings UI.
  - `frontend/app/workspace/[sessionId]/settingsSync.test.tsx` — current sync test.
  - `frontend/lib/api.ts:config` — settings API client.

  **Acceptance Criteria**:
  - [ ] `/settings` cold-load renders settings.
  - [ ] Existing settings sync behavior remains covered.
  - [ ] Save error state is graceful.

  **QA Scenarios**:
  ```text
  Scenario: Settings route cold-loads
    Tool: Playwright
    Preconditions: frontend dev server running
    Steps:
      1. Navigate to http://localhost:3000/workspace/test-session-123/settings.
      2. Assert `[data-testid="settings-page"]` is visible.
      3. Assert `[data-testid="settings-form"]` is visible.
    Expected Result: Settings is a route page inside workspace shell.
    Evidence: .sisyphus/evidence/task-11-settings-cold-load.png

  Scenario: Settings save failure is visible
    Tool: Bash
    Preconditions: config save mock rejects
    Steps:
      1. Run `cd frontend && npm test -- --run settings`.
      2. Assert save failure test expects `[data-testid="settings-error"]`.
    Expected Result: Save failure does not crash or silently disappear.
    Evidence: .sisyphus/evidence/task-11-settings-error.txt
  ```

  **Commit**: YES
  - Message: `feat(workspace): add settings route`
  - Files: settings route/tests
  - Pre-commit: `cd frontend && npm test -- --run settings`

- [x] 12. World route

  **What to do**:
  - RED: Add route tests for `/workspace/[sessionId]/world`.
  - Create world page rendering `WorldPanel.tsx` with existing props/provider data.
  - Preserve existing world/MCP testing behavior.
  - Add selectors: `world-page`, `world-panel`, `world-error`.

  **Must NOT do**:
  - Do not add new world tools or backend integration.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` — route extraction with feature-specific state.
  - **Skills**: []
  - **Skills Evaluated but Omitted**: `frontend-ui-ux` — visual parity.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: T16
  - **Blocked By**: T3, T6, T7

  **References**:
  - `frontend/components/workspace/WorldPanel.tsx` — world UI.
  - `frontend/test/world.test.tsx` — existing world tests.
  - `frontend/test/world-sdlc.test.tsx` — integration patterns.

  **Acceptance Criteria**:
  - [ ] `/world` deep-link renders.
  - [ ] Existing world tests pass after route migration.
  - [ ] Empty/error state is covered.

  **QA Scenarios**:
  ```text
  Scenario: World route cold-loads
    Tool: Playwright
    Preconditions: frontend dev server running
    Steps:
      1. Navigate to http://localhost:3000/workspace/test-session-123/world.
      2. Assert `[data-testid="world-page"]` is visible.
    Expected Result: World route renders in shell.
    Evidence: .sisyphus/evidence/task-12-world-cold-load.png

  Scenario: World empty/error state
    Tool: Bash
    Preconditions: world API mock returns empty/error
    Steps:
      1. Run `cd frontend && npm test -- --run world`.
      2. Assert empty/error route test passes.
    Expected Result: World route handles missing data gracefully.
    Evidence: .sisyphus/evidence/task-12-world-error.txt
  ```

  **Commit**: YES
  - Message: `feat(workspace): add world route`
  - Files: world route/tests
  - Pre-commit: `cd frontend && npm test -- --run world`

- [x] 13. Database route

  **What to do**:
  - RED: Add route tests for `/workspace/[sessionId]/database`.
  - Create database page rendering `DbPanel.tsx` with existing data flow.
  - Add selectors: `database-page`, `database-panel`, `database-empty-state`.

  **Must NOT do**:
  - Do not rename route to `/db` unless all nav/tests are updated consistently.
  - Do not add database editing features.

  **Recommended Agent Profile**:
  - **Category**: `quick` — focused panel route.
  - **Skills**: []
  - **Skills Evaluated but Omitted**: `frontend-ui-ux` — visual parity.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: T16
  - **Blocked By**: T3, T6, T7

  **References**:
  - `frontend/components/workspace/DbPanel.tsx` — database UI.
  - `frontend/app/workspace/[sessionId]/page.tsx` — current DbPanel wiring.

  **Acceptance Criteria**:
  - [ ] `/database` deep-link renders.
  - [ ] Empty database state is covered.

  **QA Scenarios**:
  ```text
  Scenario: Database route cold-loads
    Tool: Playwright
    Preconditions: frontend dev server running
    Steps:
      1. Navigate to http://localhost:3000/workspace/test-session-123/database.
      2. Assert `[data-testid="database-page"]` is visible.
    Expected Result: Database route renders in shell.
    Evidence: .sisyphus/evidence/task-13-database-cold-load.png

  Scenario: Database empty state
    Tool: Bash
    Preconditions: database panel mock has no rows
    Steps:
      1. Run `cd frontend && npm test -- --run database-route`.
      2. Assert `[data-testid="database-empty-state"]` expectation passes.
    Expected Result: Empty database is graceful.
    Evidence: .sisyphus/evidence/task-13-database-empty.txt
  ```

  **Commit**: YES
  - Message: `feat(workspace): add database route`
  - Files: database route/tests
  - Pre-commit: `cd frontend && npm test -- --run database-route`

- [x] 14. Sessions route

  **What to do**:
  - RED: Add route tests for `/workspace/[sessionId]/sessions`.
  - Create sessions page rendering `SessionsPanel.tsx` with session provider actions.
  - Cover delete current session edge case without crashing.
  - Add selectors: `sessions-page`, `sessions-list`, `session-delete`, `sessions-empty-state`.

  **Must NOT do**:
  - Do not change session creation/deletion API semantics.

  **Recommended Agent Profile**:
  - **Category**: `quick` — focused panel route with important edge case.
  - **Skills**: []
  - **Skills Evaluated but Omitted**: `frontend-ui-ux` — visual parity.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: T16
  - **Blocked By**: T3, T6, T7

  **References**:
  - `frontend/components/workspace/SessionsPanel.tsx` — sessions UI.
  - `frontend/app/workspace/[sessionId]/page.tsx:deleteSession` — current deletion behavior.
  - `frontend/lib/api.ts:sessions` — sessions API client.

  **Acceptance Criteria**:
  - [ ] `/sessions` deep-link renders.
  - [ ] Delete current session behavior is deterministic and tested.

  **QA Scenarios**:
  ```text
  Scenario: Sessions route cold-loads
    Tool: Playwright
    Preconditions: frontend dev server running
    Steps:
      1. Navigate to http://localhost:3000/workspace/test-session-123/sessions.
      2. Assert `[data-testid="sessions-page"]` is visible.
      3. Assert `[data-testid="sessions-list"]` is visible or empty-state is visible.
    Expected Result: Sessions route renders session list state.
    Evidence: .sisyphus/evidence/task-14-sessions-cold-load.png

  Scenario: Delete current session edge case
    Tool: Bash
    Preconditions: session delete mock targets active session
    Steps:
      1. Run `cd frontend && npm test -- --run sessions-route`.
      2. Assert test verifies redirect/fallback behavior and no crash.
    Expected Result: Active session deletion is handled safely.
    Evidence: .sisyphus/evidence/task-14-delete-current-session.txt
  ```

  **Commit**: YES
  - Message: `feat(workspace): add sessions route`
  - Files: sessions route/tests
  - Pre-commit: `cd frontend && npm test -- --run sessions-route`

- [x] 15. Tracing route

  **What to do**:
  - RED: Add route tests for `/workspace/[sessionId]/tracing`.
  - Create tracing page rendering `TracingPanel.tsx` with existing metrics/log state.
  - Add selectors: `tracing-page`, `tracing-panel`, `tracing-empty-state`.

  **Must NOT do**:
  - Do not add observability features beyond moving current panel.

  **Recommended Agent Profile**:
  - **Category**: `quick` — focused panel route.
  - **Skills**: []
  - **Skills Evaluated but Omitted**: `frontend-ui-ux` — visual parity.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4
  - **Blocks**: T16
  - **Blocked By**: T3, T6, T7

  **References**:
  - `frontend/components/workspace/TracingPanel.tsx` — tracing UI.
  - `frontend/app/workspace/[sessionId]/page.tsx:fetchMetrics` — current metrics load behavior.

  **Acceptance Criteria**:
  - [ ] `/tracing` deep-link renders.
  - [ ] Empty metrics/log state is covered.

  **QA Scenarios**:
  ```text
  Scenario: Tracing route cold-loads
    Tool: Playwright
    Preconditions: frontend dev server running
    Steps:
      1. Navigate to http://localhost:3000/workspace/test-session-123/tracing.
      2. Assert `[data-testid="tracing-page"]` is visible.
    Expected Result: Tracing route renders in shell.
    Evidence: .sisyphus/evidence/task-15-tracing-cold-load.png

  Scenario: Tracing empty state
    Tool: Bash
    Preconditions: metrics mock returns empty arrays
    Steps:
      1. Run `cd frontend && npm test -- --run tracing-route`.
      2. Assert empty-state test passes.
    Expected Result: Missing tracing data is graceful.
    Evidence: .sisyphus/evidence/task-15-tracing-empty.txt
  ```

  **Commit**: YES
  - Message: `feat(workspace): add tracing route`
  - Files: tracing route/tests
  - Pre-commit: `cd frontend && npm test -- --run tracing-route`

- [x] 16. Remove monolith leftovers and run full gates

  **What to do**:
  - Remove dead all-in-one panel composition and unused props/state from `WorkspacePage`, `WorkspaceLayout`, and `MainStage` after all routes are migrated.
  - Ensure no duplicate polling/stream owners remain.
  - Run `gitnexus_detect_changes({scope: "all", repo: "yummy"})` and verify frontend-only expected symbols.
  - Run full frontend gates.

  **Must NOT do**:
  - Do not delete reusable panels.
  - Do not touch backend or docs except if tests require updating snapshots/evidence only.

  **Recommended Agent Profile**:
  - **Category**: `deep` — integration cleanup and regression prevention.
  - **Skills**: []
  - **Skills Evaluated but Omitted**: `git-master` — commit workflow handled separately if requested.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 5
  - **Blocks**: Final Verification
  - **Blocked By**: T8-T15

  **References**:
  - `frontend/app/workspace/[sessionId]/page.tsx` — should now be AI Copilot only.
  - `frontend/components/workspace/WorkspaceLayout.tsx` — remove obsolete prop-drilling.
  - `frontend/components/workspace/MainStage.tsx` — remove old tab orchestrator if unused.
  - `frontend/components/workspace/*` — ensure panels remain reusable.

  **Acceptance Criteria**:
  - [ ] `cd frontend && npm test` passes.
  - [ ] `cd frontend && npm run build` passes.
  - [ ] No duplicate stream/poll owners remain.
  - [ ] GitNexus change detection scope is expected.

  **QA Scenarios**:
  ```text
  Scenario: Full frontend gates pass
    Tool: Bash
    Preconditions: all route tasks complete
    Steps:
      1. Run `cd frontend && npm test`.
      2. Run `cd frontend && npm run build`.
      3. Save command outputs.
    Expected Result: Tests and build pass with zero failures.
    Evidence: .sisyphus/evidence/task-16-full-gates.txt

  Scenario: No legacy all-in-one route behavior remains
    Tool: Playwright
    Preconditions: frontend dev server running
    Steps:
      1. Navigate to `/workspace/test-session-123`.
      2. Assert `[data-testid="ai-copilot-page"]` is visible.
      3. Assert old multi-panel tab container is not visible on index unless part of shell navigation.
    Expected Result: Index route is clean AI Copilot, not old AIO workspace.
    Evidence: .sisyphus/evidence/task-16-monolith-removed.png
  ```

  **Commit**: YES
  - Message: `refactor(workspace): remove monolithic workspace composition`
  - Files: workspace page/layout/components/tests
  - Pre-commit: `cd frontend && npm test && npm run build`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read this plan end-to-end. Verify every route exists, every Must Have is implemented, every Must NOT Have is absent, and evidence files exist for all tasks. Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`.

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run frontend tests/build. Review changed files for unused imports, dead code, `as any`, `@ts-ignore`, empty catches, console logs, over-abstraction, and unrelated cleanup. Output: `Build [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`.

- [x] F3. **Real Manual QA** — `unspecified-high` + `playwright`
  Start from clean state and execute every QA scenario from T1-T16. Also execute route smoke path: AI Copilot → Explorer → SDLC → Settings → World → Database → Sessions → Tracing → back to AI Copilot. Save evidence to `.sisyphus/evidence/final-qa/`. Output: `Scenarios [N/N pass] | Integration [N/N] | VERDICT`.

- [x] F4. **Scope Fidelity Check** — `deep`
  Compare git diff against plan. Reject if backend files changed, new state libraries were added, new chat features were introduced, or non-AI panels were redesigned. Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | VERDICT`.

---

## Commit Strategy

- **T1**: `test(workspace): add route split characterization baselines`
- **T2**: `test(workspace): define provider lifecycle contracts`
- **T3**: `refactor(workspace): extract shared workspace providers`
- **T4**: `refactor(chat): extract workspace copilot provider`
- **T5**: `refactor(sdlc): extract workspace stream provider`
- **T6**: `refactor(workspace): add persistent route layout`
- **T7**: `refactor(workspace): route activity navigation`
- **T8**: `feat(workspace): make index route ai copilot`
- **T9-T15**: one `feat(workspace): add {route} route` commit per route
- **T16**: `refactor(workspace): remove monolithic workspace composition`

---

## Success Criteria

### Verification Commands
```bash
cd frontend && npm test        # Expected: all Vitest suites pass
cd frontend && npm run lint    # Expected: frontend lint passes if script is available
cd frontend && npm run build   # Expected: Next production build succeeds
```

### Final Checklist
- [ ] All requested routes exist and deep-link.
- [ ] AI Copilot index is independent and ChatGPT-inspired.
- [ ] Existing behavior is preserved for all moved panels.
- [ ] Chat/SDLC stream lifecycle is deterministic and tested.
- [ ] No backend changes.
- [ ] No new state management library.
- [ ] All evidence files exist.
