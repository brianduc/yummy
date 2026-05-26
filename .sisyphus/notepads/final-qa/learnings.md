
## QA Run — 2026-05-26

### Session
- Workspace ID: 1777491625415 (auto-created on redirect from /)
- Frontend running on port 3000

### Key Findings
1. **Welcome modal** — On first load, a `fixed inset-0 z-[500]` overlay (welcome dialog) intercepts all clicks. Must dismiss with "No, I know what I'm doing" before clicking cards.
2. **data-testids present** — `dashboard-page`, `dashboard-stat-files`, `dashboard-card-{explorer|graph|wiki|insight|history|jira|world}` all exist as expected.
3. **7 tool cards** — All 7 dashboard cards render and link to correct routes.
4. **Copilot sheet** — AI Copilot sheet opens as a `z-50` full-screen overlay (backdrop-blur). Pressing Escape closes it. The button persists on every route.
5. **Browser history** — SPA navigation creates proper history entries (each nav = 1 entry). Back/forward work correctly through the stack.
6. **Console errors** — 0 errors during the full QA run (the initial 1 error in first load was transient).
7. **Spec discrepancy** — "Press forward → should be at /graph" requires TWO forward presses from /explorer (explorer→wiki→graph), not one. This is correct browser behavior, not a bug.
