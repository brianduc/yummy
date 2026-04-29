# Decisions — yummy-world-mcp

## [2026-04-29] Session Start

### Architectural Decisions
- Both MCP client + server: Yummy connects OUT to external MCP servers AND exposes Yummy's capabilities IN as MCP tools
- Bearer token auth: No auth infrastructure exists — single shared bearer token stored in `world_config`, OAuth 2.1 deferred
- Tools only: Resources and Prompts deferred to a future iteration
- 3-phase sequential: Phase 1 (client+UI) gates Phase 2 (server) gates Phase 3 (SDLC loop)
- MCP ≠ AI provider: `ai/dispatcher.ts` MUST NOT be modified
- No new frontend state libs: local `useState` only
- Slash command stays frontend: `handleCmd()` in `page.tsx`, not a backend service
- SDLC tool loop built from scratch: agents have no tool-call loop yet — Phase 3 builds it with `<tool_call>` XML markers and max 3 rounds

## 2026-04-30 Task 17 integration tests
- Kept frontend coverage at API-client unit level only, avoiding React rendering despite jsdom being configured.
- Used one-shot mocked StdioClientTransport failures to exercise connection error paths without real MCP servers.
