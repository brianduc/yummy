## 2026-05-15 Task 1: Open implementation risks
- Duplicate `WorkspaceLayout` + `WorkspaceChatProvider` in layout/page must be resolved carefully without deleting page-owned business logic.
- Explorer route mismatch must be resolved or explicitly handled before sidebar route-tour QA, otherwise `/workspace/:sessionId/explorer` may 404.
