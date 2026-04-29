# Learnings — yummy-world-mcp

## [2026-04-29] Session Start

### Codebase Conventions
- Backend path: `backend-ts/` (NOT `backend/`)
- Backend stack: TypeScript/Hono (`OpenAPIHono`), Zod validation, Drizzle ORM + SQLite, Vitest
- Frontend stack: Next.js, TailwindCSS, local `useState` only (no React Query/Zustand)
- Pattern: each feature = router + services + schemas + frontend panel
- `@modelcontextprotocol/sdk` v1.29.0 already in node_modules as transitive dep — must be made explicit
- Next migration file: `0002_yummy_world.sql` (0000 and 0001 exist)
- Test setup: `backend-ts/tests/integration/_setup.ts` — reuse pattern
- Slash command dispatch is frontend-only in `handleCmd()` (page.tsx)
- Error shape: REST endpoints use `{ detail }`, MCP transport uses JSON-RPC error envelope
- No encryption for secrets — follows existing `providerConfig` plaintext precedent
- `providerConfig` singleton table pattern at `backend-ts/src/db/schema.ts:112-127`
- Sessions table pattern at `backend-ts/src/db/schema.ts:25-53`
- Guards pattern: `backend-ts/src/lib/guards.ts` — simple async functions throwing `HttpError`
- Router mounting: add after `metricsRouter` in `backend-ts/src/app.ts`
- `/world/mcp` endpoint uses plain `router.post()`, NOT `createRoute()` (no OpenAPI for JSON-RPC)
- SDLC tool-call format: `<tool_call server="id" tool="name">{ json args }</tool_call>` with max 3 rounds

### Schema Work Notes
- `@hono/zod-openapi` schemas should keep snake_case fields and use `.openapi('Name')` descriptors.
- For world schemas, create a base schema when `.refine()` is needed, then apply `.openapi()` on the final refined schema.
- Tool argument payloads should use `z.record(z.string(), z.unknown())` for compatibility with current TypeScript typings.
- World config should mirror provider config singleton behavior and remain plaintext; repository should export plain async CRUD helpers.

### DB Repo Pattern Notes
- Use `db.select().from(table).where(eq(...)).get()` for single-row fetches.
- Use `db.select().from(table).orderBy(asc(table.createdAt)).all()` for ordered lists.
- Creates can insert then re-read when `returning()` is unavailable.
- Server metadata tables should keep transport fields and status only; no connection/runtime logic in repos.

## 2026-04-29 — T6/T7 MCP client
- Added world server CRUD in backend-ts/src/db/repositories/world.repo.ts using SQLite Drizzle insert/update then re-read pattern.
- Added MCP typed errors in backend-ts/src/lib/errors.ts for connection and tool-call failures.
- Added backend-ts/src/services/world/client.ts with stdio and SSE transports, JSON text parsing for args/headers, connection timeout, HTTP retry backoff, tool pagination, tool-call timeout, and safe disconnect.
- Verification: lsp_diagnostics unavailable because typescript-language-server is not installed; npx tsc --noEmit passes; pnpm test has pre-existing SDLC integration failures unrelated to these files.

## T8 MCP server registry
- Added `services/world/registry.ts` as the single in-memory map for MCP clients, mirroring the abort registry pattern: map by server id, clean reconnect before replacement, status updates on connect/disconnect/error.
- `connectAllEnabled()` intentionally catches per-server failures and logs warnings so startup remains best-effort.

## T11 integration test setup
- Integration setup now needs the real migration-created world tables; when tests run in a fresh in-memory DB, `resetWorldData()` must recreate `world_servers` and `world_config` before seeding.
- World API smoke tests should import `createApp()` locally so they don't depend on a stale shared app instance.

## 2026-04-30 — Frontend world API client
- Added `api.world.*` methods in `frontend/lib/api.ts` using the existing `request<T>()` helper pattern.
- Added world/MCP frontend types in `frontend/lib/types.ts` and imported them as type-only exports.
- `next build` completed successfully after the change.

## 2026-04-30
- Wired WorldPanel into workspace right tabs using RightTab=world and existing panel render pattern.
- Added /tool slash command that invokes api.world.invoke and writes tool/error output to terminal logs.
- ChatPanel term logs support tool and error roles with distinct colors/icons.

## 2026-04-30 Task 17 integration tests
- Backend world integration tests now cover CRUD, config, disconnect, unconnected tools/invoke, and connect failure paths.
- Frontend world API tests mock global fetch directly and assert world client endpoints, request methods, payloads, and error handling.

## 2026-04-30 Wave 4 MCP Server
- Created `services/world/tools.ts` with 8 Yummy MCP tools and adapted calls to the actual dispatcher signature (`callAI(agentRole, prompt, instruction)`) and sessions repo signature (`create(id, name)`).
- Created `services/world/server.ts` using low-level MCP `Server` plus `WebStandardStreamableHTTPServerTransport` for Hono-compatible Request/Response handling.
- Backend verification: `pnpm build` passes. LSP diagnostics could not run because `typescript-language-server` is not installed in the environment.

## 2026-04-30 T22
- Added 13 integration tests for POST /world/mcp covering bearer auth, disabled server, initialize, tools/list, multiple tools/call paths, mocked AI, and unknown-tool error results.
- Streamable HTTP transport requires Accept: application/json, text/event-stream in MCP POST tests.
- MCP server must use a fresh Server/transport per HTTP request and enableJsonResponse for synchronous JSON-RPC response assertions.

## 2026-04-30 T25
- Added `tool_call` and `tool_result` variants to `SdlcEvent` type in `frontend/lib/api.ts` (lines 34-35)
- Added `ToolCallEntry` type + `toolCalls` state in `page.tsx` parallel to streaming state pattern
- Updated `runSdlcStream()` to handle `tool_call` (append to agent's toolCalls array) and `tool_result` (patch last entry with result)
- `toolCalls` reset per-agent on `start` event; persists across agent transitions until new `start`
- Added `ToolCallCard` and `ToolCallList` components inline in `SdlcPanel.tsx` — collapsible, read-only, with error styling (red) for failed tool calls
- Tool calls rendered above each agent card content area, grouped by agent key
- lucide-react icons (`ChevronDown`, `ChevronRight`, `Wrench`, `AlertTriangle`) already available, added to import
- Build passes (`next build`), tests pass (13/13 vitest)

## F3 Manual QA - 2026-04-30

### Findings
- MCP server requires `Accept: application/json, text/event-stream` header for initialize. Without it, returns 406.
- Token is never exposed in config response — only `mcp_server_token_set: true`.
- 8 MCP tools registered: rag_ask, rag_ask_free, get_kb_insights, get_kb_summary, session_create, session_list, sdlc_start, sdlc_status.
- tools/call (`yummy.session_list`) returns live data — 1 session exists.
