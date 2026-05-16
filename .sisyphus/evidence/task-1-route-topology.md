# Task 1 Route Topology Evidence

## Route topology

Explicit `frontend/app/**/page.tsx` files:

- `/` -> `frontend/app/page.tsx`
- `/workspace/[sessionId]` -> `frontend/app/workspace/[sessionId]/page.tsx`
- `/workspace/[sessionId]/tracing` -> `frontend/app/workspace/[sessionId]/tracing/page.tsx`
- `/workspace/[sessionId]/sessions` -> `frontend/app/workspace/[sessionId]/sessions/page.tsx`
- `/workspace/[sessionId]/database` -> `frontend/app/workspace/[sessionId]/database/page.tsx`
- `/workspace/[sessionId]/world` -> `frontend/app/workspace/[sessionId]/world/page.tsx`
- `/workspace/[sessionId]/settings` -> `frontend/app/workspace/[sessionId]/settings/page.tsx`
- `/workspace/[sessionId]/sdlc` -> `frontend/app/workspace/[sessionId]/sdlc/page.tsx`

Explicit `frontend/app/**/layout.tsx` files:

- root layout -> `frontend/app/layout.tsx`
- workspace layout -> `frontend/app/workspace/[sessionId]/layout.tsx`

## Shell mount decision

The dashboard shell should be owned by `frontend/app/workspace/[sessionId]/layout.tsx`, not `frontend/app/layout.tsx`, because all dashboard-target routes discovered are under `/workspace/[sessionId]/*` and the root layout is only the minimal HTML/body wrapper.

## Duplicate shell/provider ownership discovered

Both of these files currently render `WorkspaceLayout` and mount `WorkspaceChatProvider`:

- `frontend/app/workspace/[sessionId]/layout.tsx`
- `frontend/app/workspace/[sessionId]/page.tsx`

This is a critical follow-up for implementation tasks: collapse toward one dashboard shell owner in the workspace layout while preserving page business logic.

## ActivityBar route entries versus page files

- `explorer` -> `/workspace/:sessionId/explorer` -> **no page file found**
- `sdlc` -> `/workspace/:sessionId/sdlc` -> page exists
- `chat` index -> `/workspace/:sessionId` -> page exists
- `tracing` -> `/workspace/:sessionId/tracing` -> page exists
- `db` -> `/workspace/:sessionId/database` -> page exists
- `settings` -> `/workspace/:sessionId/settings` -> page exists
- `world` -> `/workspace/:sessionId/world` -> page exists
- `sessions` -> `/workspace/:sessionId/sessions` -> page exists

## Direct search / AST evidence

- `glob frontend/app/**/page.tsx` found 8 page files listed above.
- `glob frontend/app/**/layout.tsx` found 2 layout files listed above.
- `grep WorkspaceLayout|WorkspaceChatProvider|useWorkspaceChat|ActivityBar|AICopilot` found relevant references in `layout.tsx`, `page.tsx`, `WorkspaceLayout.tsx`, `ActivityBar.tsx`, `AICopilot.tsx`, `useWorkspaceChat.tsx`, and tests.
- `ast-grep` JSX search confirmed `WorkspaceLayout` JSX in both layout and page; `WorkspaceLayout` renders `ActivityBar`, `MainStage`, and `AICopilot` through the current 3-pane shell.
