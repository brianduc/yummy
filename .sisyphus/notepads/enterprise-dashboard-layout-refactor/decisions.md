## 2026-05-15 Task 1: Shell ownership decision
- Use `frontend/app/workspace/[sessionId]/layout.tsx` as the intended persistent dashboard shell owner. Do not move the shell to root `frontend/app/layout.tsx` unless later route topology changes prove non-workspace routes need the dashboard.
- Treat missing Sheet/Tooltip primitives as implementation prerequisites for later tasks, not as permission for broad dependency or UI-system changes.
