
## F2 Code Quality Review — 2026-05-15

### Patterns confirmed clean across refactored files
- `catch (e: unknown)` used consistently for named error bindings
- Commented silent catches: `/* ignore: <rationale> */` pattern used in useWorkspaceSession, useWorkspaceSdlc, useWorkspaceChat — consistent and good
- Route pages are correctly thin wrappers with no duplicated logic
- No @ts-ignore, no console.*, no TODO/FIXME across 18 reviewed files

### Issues found
1. **AICopilot.tsx: stale `useRef<HTMLInputElement>` on `<textarea>`** — creates 3 `as any` casts (ref, onKeyDown, source_chunks callback). Fix: change ref to `useRef<HTMLTextAreaElement>` and type the handler as `React.KeyboardEvent<HTMLTextAreaElement>`.
2. **useWorkspaceStatus.ts: 2 bare `catch {}` blocks** (fetchStatus, fetchKb) — should get `/* ignore: status/kb fetch failure leaves prior state intact */` comments to match project pattern.
3. **AICopilot.tsx: 3 unused lucide-react imports** (Zap, User, MessageSquare) — dead code.
