# Yummy World — MCP Gateway (Bi-directional)

## TL;DR

> **Quick Summary**: Implement Yummy World — a bi-directional MCP gateway that lets Yummy connect TO external MCP servers (client) and expose Yummy's SDLC agents AS MCP tools for external AI clients (server). Delivered in 3 sequential phases.
>
> **Deliverables**:
> - MCP Client: connect to stdio + HTTP MCP servers, discover tools, invoke from chat
> - WorldPanel UI: manage MCP server connections, browse tools
> - `/tool` slash command: invoke connected MCP tools from ChatPanel
> - MCP Server: expose Yummy SDLC/RAG/KB as MCP tools via `/world/mcp` endpoint
> - SDLC Agent Tool Loop: SDLC agents can call MCP tools during workflow
> - SQLite persistence for MCP server configs + connection registry
>
> **Estimated Effort**: Large (3 phases, ~24 tasks)
> **Parallel Execution**: YES — 5 waves across 3 phases, waves sequential, tasks parallel within waves
> **Critical Path**: Phase 1 (DB + Client + UI + Slash) → Phase 2 (Server + Auth) → Phase 3 (SDLC Loop)

---

## Context

### Original Request
Implement "Yummy World" — a gate to connect with outside knowledge via MCP (Model Context Protocol). Current scope: MCP connectivity, bi-directional (client + server).

### Interview Summary
**Key Discussions**:
- **MCP Role**: Both client (connect out to world) AND server (expose Yummy in to world)
- **SDK Version**: v1.x stable (`@modelcontextprotocol/sdk` v1.29.0) — no v2 pre-alpha risk
- **Configuration**: UI-based management via new WorldPanel, persisted to SQLite
- **Transport**: Both stdio (local subprocess) + HTTP/SSE (remote servers)
- **Integration**: `/tool` slash command in ChatPanel for tool invocation; SDLC agents call tools in Phase 3
- **Test Strategy**: TDD with Vitest, reusing `tests/integration/_setup.ts` mock patterns
- **MCP Primitives**: Tools only (callTool/listTools) — Resources/Prompts deferred
- **MCP Server Auth**: Single shared bearer token (matches existing `provider_config` pattern); OAuth 2.1 deferred
- **Phasing**: 3 sequential phases — client+UI first, server second, SDLC loop third

**Research Findings**:
- Existing architecture doc: `resources/YUMMY_PLATFORM_ARCHITECTURE.md` — Python examples, needs TypeScript adaptation
- Backend: TypeScript/Hono (`OpenAPIHono`), Zod validation, Drizzle ORM + SQLite, Vitest
- Pattern: each feature = router + services + schemas + frontend panel
- `@modelcontextprotocol/sdk` v1.29.0 already in `node_modules` (transitive), must be explicit dep
- Slash command dispatch is frontend-only in `handleCmd()` (page.tsx), not a backend service
- SDLC agents consume `streamAI()` results but have no tool-call loop — must be built from scratch in Phase 3
- No user authentication exists — bearer token is the pragmatic MVP

### Metis Review
**Identified Gaps** (addressed):
- **No auth infrastructure**: Resolved — Phase 1 uses single shared bearer token, OAuth 2.1 explicitly deferred
- **No SDLC tool-call loop**: Resolved — Phase 1+2 tools are chat-only via `/tool`, Phase 3 builds the loop
- **Paths are `backend-ts/` not `backend/`**: Resolved — all paths corrected
- **MCP is NOT an AI provider**: Guardrail applied — do not modify `ai/dispatcher.ts` provider switch
- **No new frontend state libraries**: Guardrail applied — use local `useState` only
- **Error shape mismatch**: Guardrail applied — REST endpoints use `{detail}` shape; MCP transport uses JSON-RPC envelope
- **Migration numbering**: Next is `0002_yummy_world.sql`
- **Test patterns**: Reuse `tests/integration/_setup.ts` with additional `vi.mock` for MCP transport

---

## Work Objectives

### Core Objective
Build a bi-directional MCP gateway: connect Yummy to external MCP servers for tool invocation (client side), and expose Yummy's existing capabilities (SDLC, RAG, KB) as MCP tools for external AI clients (server side).

### Concrete Deliverables
- `backend-ts/src/db/schema.ts` — 2 new tables: `world_config`, `world_servers`
- `backend-ts/src/db/migrations/0002_yummy_world.sql` — migration file
- `backend-ts/src/db/repositories/world.repo.ts` — CRUD for MCP server configs
- `backend-ts/src/services/world/client.ts` — MCP client: connect, listTools, callTool
- `backend-ts/src/services/world/server.ts` — MCP server: expose Yummy tools
- `backend-ts/src/services/world/registry.ts` — server connection lifecycle management
- `backend-ts/src/services/world/tools.ts` — Yummy-to-MCP tool mapping
- `backend-ts/src/routers/world.router.ts` — REST API: `/world/servers`, `/world/tools`, `/world/invoke`, `/world/mcp`
- `backend-ts/src/lib/guards.ts` — new guards: `requireMcpServer()`, `requireWorldConfig()`
- `backend-ts/src/schemas/world.schema.ts` — Zod request/response schemas
- `frontend/components/workspace/WorldPanel.tsx` — MCP server management UI
- `frontend/lib/api.ts` — new `api.world.*` methods
- `frontend/app/workspace/[sessionId]/page.tsx` — `/tool` slash command in `handleCmd()`
- Tests: `backend-ts/tests/integration/world.test.ts`, `frontend/test/world.test.tsx`

### Definition of Done
- [ ] `pnpm db:migrate` applies `0002_yummy_world.sql` cleanly on fresh and existing DB
- [ ] `pnpm test` passes all Vitest suites (backend + frontend, no regressions)
- [ ] MCP client connects to a real stdio MCP server (e.g., filesystem), lists tools, invokes one successfully
- [ ] MCP client connects to an HTTP/SSE MCP server, lists tools, invokes one successfully
- [ ] WorldPanel shows connected servers, their tools, and status indicators
- [ ] `/tool <server>.<tool> {...}` slash command invokes MCP tool and displays result in chat
- [ ] MCP server endpoint `/world/mcp` responds to `initialize` → `tools/list` → `tools/call` via curl
- [ ] Bearer token auth rejects unauthenticated MCP server requests
- [ ] All 5 existing AI providers still function (regression guard)

### Must Have
- MCP client connecting to both stdio and HTTP/SSE servers
- Tool discovery and invocation via `/tool` slash command
- WorldPanel UI for managing MCP server connections
- MCP server exposing Yummy tools at `/world/mcp`
- Bearer token auth on MCP server endpoint
- TDD with Vitest (backend integration + frontend component tests)
- SQLite persistence for all MCP configs

### Must NOT Have (Guardrails)
- **NO modification to `services/ai/dispatcher.ts`** — MCP is not an AI provider
- **NO React Query, Zustand, SWR, or new state libraries** on frontend — use local `useState`
- **NO backend chat-dispatch service** — slash command parsing stays in frontend `handleCmd()`
- **NO `backend/` paths** — all backend code is in `backend-ts/`
- **NO OAuth 2.1 implementation** — deferred to dedicated "Yummy Identity" feature
- **NO MCP Resources or Prompts** — tools only for this plan
- **NO MCP server auto-discovery** — servers are manually configured via UI
- **NO OpenAPI docs for `/world/mcp`** — JSON-RPC endpoint documented via README only
- **NO monorepo tooling changes** (pnpm-workspace.yaml, turbo.json) — out of scope
- **NO encryption-at-rest for secrets** — follow existing `provider_config` plaintext precedent

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES — Vitest on both backend and frontend
- **Automated tests**: TDD (RED-GREEN-REFACTOR)
- **Framework**: Vitest (backend integration + frontend component tests)
- **Mocking pattern**: Reuse `tests/integration/_setup.ts` with additional `vi.mock` for MCP transport

### QA Policy
Every task MUST include agent-executed QA scenarios (see TODO template below).
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Frontend/UI**: Use Playwright (`playwright` skill) — Navigate, interact, assert DOM, screenshot
- **API/Backend**: Use Bash (curl) — Send requests, assert status + response fields
- **CLI**: Use interactive_bash (tmux) — Run commands, validate output
- **Library/Module**: Use Bash (bun/node REPL) — Import, call functions, compare output

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — DB + Schema + Deps):
├── Task 1: Add @modelcontextprotocol/sdk dep + DB migration [quick]
├── Task 2: World config table + repository [quick]
├── Task 3: World servers table + repository [quick]
├── Task 4: Zod schemas for world API [quick]
└── Task 5: Guards (requireMcpServer, requireWorldConfig) [quick]

Wave 2 (After Wave 1 — Core Services + Router):
├── Task 6: MCP client service (connect, listTools, callTool — stdio) [deep]
├── Task 7: MCP client service (HTTP/SSE transport support) [deep]
├── Task 8: MCP server registry (lifecycle, health, reconnect) [deep]
├── Task 9: World router — CRUD endpoints for server configs [unspecified-high]
├── Task 10: World router — tool invocation endpoint (/world/invoke) [unspecified-high]
└── Task 11: Extend test setup with MCP transport mocks [quick]

Wave 3 (After Wave 2 — Frontend + Integration):
├── Task 12: API client extensions (api.world.* methods) [quick]
├── Task 13: WorldPanel — server list + add/edit form [visual-engineering]
├── Task 14: WorldPanel — tool browser + connection status [visual-engineering]
├── Task 15: /tool slash command in handleCmd() [deep]
├── Task 16: ChatPanel integration — tool result rendering [visual-engineering]
└── Task 17: End-to-end integration tests + Phase 1 QA [deep]

Wave 4 (After Wave 3 — MCP Server):
├── Task 18: Yummy-to-MCP tool mapping (SDLC + RAG + KB tools) [deep]
├── Task 19: MCP server transport (WebStandardStreamableHTTPServerTransport) [deep]
├── Task 20: MCP server router at /world/mcp + bearer token auth [unspecified-high]
├── Task 21: Request logging for MCP server calls [quick]
└── Task 22: MCP server integration tests + Phase 2 QA [deep]

Wave 5 (After Wave 4 — SDLC Agent Tool Loop):
├── Task 23: SDLC prompt injection — tool descriptions in agent prompts [deep]
├── Task 24: SDLC tool-call parsing + invocation loop [deep]
├── Task 25: SDLC tool result rendering in SdlcPanel [visual-engineering]
└── Task 26: SDLC tool-loop integration tests + Phase 3 QA [deep]

Wave FINAL (After ALL tasks — 4 parallel reviews):
├── Task F1: Plan Compliance Audit (oracle)
├── Task F2: Code Quality Review (unspecified-high)
├── Task F3: Real Manual QA (unspecified-high + playwright)
└── Task F4: Scope Fidelity Check (deep)
```

### Critical Path
Task 1 → Task 5 → Task 6 → Task 9 → Task 10 → Task 13 → Task 15 → Task 18 → Task 19 → Task 20 → Task 23 → Task 26 → F1-F4

### Parallel Speedup
~65% faster than sequential — each wave runs tasks in parallel within it.

---

## TODOs

### Wave 1 — DB Schema, Migrations, Schemas, Guards (Start Immediately)

- [x] 1. Add `@modelcontextprotocol/sdk` dependency + DB migration

  **What to do**:
  - Add `"@modelcontextprotocol/sdk": "^1.29.0"` to `backend-ts/package.json` dependencies (currently present only as transitive)
  - Run `pnpm install` in `backend-ts/`
  - Create migration file `backend-ts/src/db/migrations/0002_yummy_world.sql` with the two new tables (see Tasks 2+3 schema)
  - Ensure migration works on both fresh DB and DB with existing data: `pnpm db:migrate`

  **Must NOT do**:
  - Do NOT modify existing migration files (`0000_*.sql`, `0001_*.sql`)
  - Do NOT add the dep to `frontend/package.json` (only backend needs it)

  **Recommended Agent Profile**:
  > Select category + skills based on task domain. Justify each choice.
  - **Category**: `quick`
    - Reason: Single dependency add + migration file creation — straightforward setup task
  - **Skills**: []
  - **Skills Evaluated but Omitted**: None needed for setup task

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3, 4, 5)
  - **Blocks**: Tasks 6, 7, 8, 9, 10, 11
  - **Blocked By**: None (can start immediately)

  **References**:
  - `backend-ts/package.json:22-36` — existing dependencies list, add `@modelcontextprotocol/sdk` here
  - `backend-ts/src/db/migrations/0001_narrow_molecule_man.sql` — migration file naming convention (`NNNN_descriptive_name.sql`)
  - `backend-ts/src/db/migrate.ts` — migration runner, no changes needed
  - `backend-ts/src/db/client.ts` — WAL pragmas already set, WAL handles concurrent reads

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Migration applies on fresh DB
    Tool: Bash (pnpm commands)
    Preconditions: backend-ts/data/yummy.db deleted or does not exist
    Steps:
      1. cd backend-ts && rm -f data/yummy.db
      2. Run: pnpm db:migrate
      3. Check exit code = 0
      4. Run: sqlite3 data/yummy.db ".tables" | grep -c "world_"
    Expected Result: Exit code 0, output contains 2 (world_config + world_servers)
    Failure Indicators: Non-zero exit code, tables not created, migration conflict
    Evidence: .sisyphus/evidence/task-1-migration-fresh.txt

  Scenario: Migration applies on existing DB (idempotent)
    Tool: Bash (pnpm commands)
    Preconditions: backend-ts/data/yummy.db exists with prior migrations applied
    Steps:
      1. cd backend-ts && pnpm db:migrate
      2. Check exit code = 0
      3. Verify existing tables (sessions, kb_tree, etc.) still present
    Expected Result: Exit code 0, existing data preserved, new tables added
    Failure Indicators: Migration error, data loss in existing tables
    Evidence: .sisyphus/evidence/task-1-migration-existing.txt
  ```

  **Commit**: YES (groups with Wave 1)
  - Message: `feat(world): add @modelcontextprotocol/sdk dep and DB migration`
  - Files: `backend-ts/package.json`, `backend-ts/pnpm-lock.yaml`, `backend-ts/src/db/migrations/0002_yummy_world.sql`

- [x] 2. World config table + repository

  **What to do**:
  - Add `worldConfig` table to `backend-ts/src/db/schema.ts`:
    - Singleton row (id=1), following `providerConfig` pattern
    - Fields: `mcpServerToken` (text, default ''), `mcpServerEnabled` (integer/boolean, default false), `mcpServerPort` (text, default '' for same-port)
  - Export `WorldConfigRow`, `WorldConfigInsert` types
  - Add SQL to `0002_yummy_world.sql`: `CREATE TABLE world_config (...)` + initial row insert
  - Create `backend-ts/src/db/repositories/world.repo.ts` with functions:
    - `getWorldConfig()` — returns singleton row or defaults
    - `updateWorldConfig(partial)` — upserts singleton row

  **Must NOT do**:
  - Do NOT add encryption — follow `providerConfig` plaintext precedent
  - Do NOT add a user table or auth infrastructure — bearer token only

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Table definition + simple CRUD repo — pattern already established in codebase
  - **Skills**: []
  - **Skills Evaluated but Omitted**: None needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3, 4, 5)
  - **Blocks**: Tasks 6, 9, 10, 19, 20, 21
  - **Blocked By**: None (can start immediately, but schema needs Task 1 migration file)

  **References**:
  - `backend-ts/src/db/schema.ts:112-127` — `providerConfig` singleton table pattern (exact pattern to follow)
  - `backend-ts/src/db/schema.ts:130-138` — exported row/insert types convention
  - `backend-ts/src/db/repositories/` — existing repo pattern (import db from `../client.js`, export pure functions)

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: World config CRUD via repository
    Tool: Bash (node REPL with Vitest)
    Preconditions: Migration applied, DB initialized
    Steps:
      1. Import getWorldConfig, updateWorldConfig from world.repo
      2. Call getWorldConfig()
      3. Assert: returns object with mcpServerToken='', mcpServerEnabled=false
      4. Call updateWorldConfig({ mcpServerToken: 'bearer-test-123', mcpServerEnabled: true })
      5. Call getWorldConfig()
      6. Assert: mcpServerToken='bearer-test-123', mcpServerEnabled=true
    Expected Result: CRUD operations work, singleton row persists
    Failure Indicators: Table not found, duplicate rows, data not persisted
    Evidence: .sisyphus/evidence/task-2-config-repo.txt
  ```

  **Commit**: YES (groups with Wave 1)
  - Message: `feat(world): add world_config table and repository`

- [x] 3. World servers table + repository

  **What to do**:
  - Add `worldServers` table to `backend-ts/src/db/schema.ts`:
    - Fields: `id` (text, primary key, UUID), `name` (text, not null), `transport` (text, not null, 'stdio' | 'http'), `command` (text, nullable — for stdio), `args` (text/json, nullable — for stdio args array), `url` (text, nullable — for HTTP), `headersJson` (text/json, nullable — for custom HTTP headers), `enabled` (integer/boolean, default true), `createdAt` (text, ISO 8601), `lastStatus` (text, default 'unknown' — 'connected' | 'disconnected' | 'error' | 'unknown')
  - Export `WorldServerRow`, `WorldServerInsert` types
  - Add SQL to `0002_yummy_world.sql`: `CREATE TABLE world_servers (...)`
  - Add to `world.repo.ts`:
    - `listWorldServers()` — all servers, ordered by createdAt
    - `getWorldServer(id)` — single server by ID
    - `createWorldServer(insert)` — insert new server
    - `updateWorldServer(id, partial)` — update fields
    - `updateWorldServerStatus(id, status)` — convenience for status updates
    - `deleteWorldServer(id)` — remove server

  **Must NOT do**:
  - Do NOT store secrets (API keys) in this table — use `worldConfig` or env vars
  - Do NOT implement connection logic in the repo — repos are data access only

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Table definition + CRUD repo — established pattern
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 4, 5)
  - **Blocks**: Tasks 6, 7, 8, 9, 13, 14, 15
  - **Blocked By**: None

  **References**:
  - `backend-ts/src/db/schema.ts:25-53` — `sessions` table pattern (text PK, JSON columns, createdAt)
  - `backend-ts/src/db/repositories/sessions.repo.ts` — multi-row CRUD repo pattern to follow
  - `backend-ts/src/db/schema.ts:98-109` — `requestLogs` table with integer PK pattern

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: World servers CRUD
    Tool: Bash (node REPL)
    Preconditions: Migration applied
    Steps:
      1. Import listWorldServers, createWorldServer, getWorldServer from world.repo
      2. Create 2 servers: one stdio (command='node', args=['server.js']), one HTTP (url='http://localhost:3001/mcp')
      3. List all servers — assert count = 2
      4. Get by ID — assert name, transport, fields match
      5. Update status of first to 'connected' — assert persisted
      6. Delete second — assert list returns 1
    Expected Result: Full CRUD lifecycle works
    Failure Indicators: ID collision, null constraint violation, JSON parse error for args
    Evidence: .sisyphus/evidence/task-3-servers-repo.txt
  ```

  **Commit**: YES (groups with Wave 1)
  - Message: `feat(world): add world_servers table and repository`

- [x] 4. Zod schemas for world API

  **What to do**:
  - Create `backend-ts/src/schemas/world.schema.ts` with Zod schemas following Hono/OpenAPI convention:
    - `WorldConfigSchema` — response shape for world config (mcpServerToken, mcpServerEnabled)
    - `WorldConfigUpdateSchema` — request shape for updating config
    - `WorldServerSchema` — response shape for server (id, name, transport, command?, args?, url?, headersJson?, enabled, createdAt, lastStatus)
    - `WorldServerCreateSchema` — request shape for creating server (name required, transport required, conditional fields based on transport)
    - `WorldServerUpdateSchema` — partial update (all fields optional except id)
    - `ToolInvokeRequestSchema` — `{ serverId: string, toolName: string, arguments: Record<string, unknown> }`
    - `ToolInvokeResponseSchema` — `{ content: Array<{ type: string, text?: string }>, isError?: boolean }`
    - `ToolListResponseSchema` — `{ serverId: string, tools: Array<{ name: string, description?: string, inputSchema: unknown }> }`
  - Use `@hono/zod-openapi` conventions with `.openapi()` descriptors for Swagger/OpenAPI docs
  - Follow existing naming: snake_case for API fields (matches Python API parity)

  **Must NOT do**:
  - Do NOT add schemas for the MCP JSON-RPC transport endpoint — that's protocol-level, not REST
  - Do NOT use camelCase for API fields — maintain snake_case parity with Python backend

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Schema definitions — straightforward data modeling
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 3, 5)
  - **Blocks**: Tasks 9, 10, 12
  - **Blocked By**: None

  **References**:
  - `backend-ts/src/schemas/sdlc.schema.ts` — existing schema file pattern (Zod + openapi() descriptors)
  - `backend-ts/src/schemas/common.schema.ts` — `ErrorSchema` pattern for error responses
  - `backend-ts/src/schemas/sessions.schema.ts` — request/response schema pattern with create/update variants

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Schema validation — valid inputs
    Tool: Bash (node REPL)
    Preconditions: Schema file compiled
    Steps:
      1. Import WorldServerCreateSchema
      2. Parse valid stdio server: { name: 'test', transport: 'stdio', command: 'node', args: ['server.js'] }
      3. Parse valid HTTP server: { name: 'test2', transport: 'http', url: 'http://localhost:3001/mcp' }
      4. Assert both pass validation
    Expected Result: Both parse successfully, no ZodError
    Failure Indicators: ZodError thrown
    Evidence: .sisyphus/evidence/task-4-schema-valid.txt

  Scenario: Schema validation — invalid inputs
    Tool: Bash (node REPL)
    Preconditions: Schema file compiled
    Steps:
      1. Parse: { name: 'bad', transport: 'stdio' } — missing command
      2. Parse: { name: 'bad2', transport: 'http' } — missing url
      3. Parse: { name: '', transport: 'stdio', command: 'node' } — empty name
    Expected Result: All should throw ZodError with specific field errors
    Failure Indicators: Invalid data passes validation
    Evidence: .sisyphus/evidence/task-4-schema-invalid.txt
  ```

  **Commit**: YES (groups with Wave 1)
  - Message: `feat(world): add Zod schemas for world API`

- [x] 5. Guards — requireMcpServer, requireWorldConfig

  **What to do**:
  - Add to `backend-ts/src/lib/guards.ts`:
    - `requireWorldConfig()` — loads world config singleton, returns it; throws `HttpError(500)` if not found
    - `requireMcpServer(serverId: string)` — loads server by ID from repo, throws `HttpError(404, "MCP server not found")` if missing
  - Follow existing guard pattern: simple async functions that throw `HttpError` on failure
  - Guards are called at the top of route handlers before business logic

  **Must NOT do**:
  - Do NOT add auth/authorization logic — bearer token check is in the router
  - Do NOT add connection logic — guards are pure data-fetch

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Two simple guard functions following existing pattern
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 3, 4)
  - **Blocks**: Tasks 9, 10, 20, 23
  - **Blocked By**: Tasks 2, 3 (needs repos)

  **References**:
  - `backend-ts/src/lib/guards.ts` — existing guards: `requireSession()`, `requireRepo()`, `requireKnowledgeBase()` — follow this exact pattern
  - `backend-ts/src/lib/errors.ts` — `HttpError` class used by guards
  - `backend-ts/src/db/repositories/world.repo.ts` — repos to call from guards (created in Tasks 2, 3)

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Guards — server found vs not found
    Tool: Bash (Vitest)
    Preconditions: Test DB seeded with one server (id='srv-1')
    Steps:
      1. requireMcpServer('srv-1') → returns server object
      2. requireMcpServer('nonexistent') → throws HttpError with status 404
    Expected Result: Found returns row, missing throws 404
    Failure Indicators: Wrong error status, returns null instead of throwing
    Evidence: .sisyphus/evidence/task-5-guards.txt
  ```

  **Commit**: YES (groups with Wave 1)
  - Message: `feat(world): add requireMcpServer and requireWorldConfig guards`

### Wave 2 — Core Services + Router (After Wave 1)

- [x] 6. MCP client service — stdio transport

  **What to do**:
  - Create `backend-ts/src/services/world/client.ts` with:
    - `createStdioClient(config: WorldServerRow): Promise<Client>` — instantiates MCP `Client` from `@modelcontextprotocol/sdk`, creates `StdioClientTransport` with `command` + `args` from config, calls `client.connect(transport)`, returns connected client
    - `listTools(client: Client): Promise<Tool[]>` — calls `client.listTools()`, flattens pagination if any
    - `callTool(client: Client, name: string, args: Record<string, unknown>): Promise<CallToolResult>` — calls `client.callTool({ name, arguments: args })`, returns result
    - `disconnectClient(client: Client): Promise<void>` — calls `client.close()`, handles errors gracefully
  - Add comprehensive error handling:
    - Transport errors → throw typed `McpConnectionError` with server ID
    - Tool call errors → throw typed `McpToolError` with tool name + server ID
    - Timeout handling (30s default for connect, 60s for tool calls)
  - Write unit tests (TDD: test first, then implement)

  **Must NOT do**:
  - Do NOT implement HTTP/SSE transport here — that's Task 7
  - Do NOT implement connection pooling or reconnect logic — that's Task 8
  - Do NOT call `ai/dispatcher.ts` — MCP is not an AI provider

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Core MCP client implementation with error handling, timeouts, and TDD — moderate complexity with SDK integration
  - **Skills**: []
  - **Skills Evaluated but Omitted**: None — standard TypeScript + SDK work

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 7, 8, 9, 10, 11)
  - **Blocks**: Tasks 10, 15, 17, 23, 24
  - **Blocked By**: Tasks 1 (dep), 3 (server config), 5 (guards)

  **References**:
  - `@modelcontextprotocol/sdk` v1.29.0 — `Client`, `StdioClientTransport` from `@modelcontextprotocol/sdk/client/index.js` and `@modelcontextprotocol/sdk/client/stdio.js`
  - `resources/YUMMY_PLATFORM_ARCHITECTURE.md:387-623` — Python MCP client pattern (adapt to TypeScript)
  - `backend-ts/src/services/ai/providers/types.ts` — provider call/stream type pattern (adapt for MCP tool result types)
  - `backend-ts/src/lib/errors.ts` — `HttpError` class, extend for `McpConnectionError`, `McpToolError`

  **Acceptance Criteria**:
  - [ ] Test: `createStdioClient` connects to mock transport and returns Client
  - [ ] Test: `listTools` returns tool array, handles empty list
  - [ ] Test: `callTool` invokes tool with args, returns result content
  - [ ] Test: connection failure throws `McpConnectionError`
  - [ ] Test: tool call failure throws `McpToolError`
  - [ ] Test: timeout triggers after configured duration

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Connect to real stdio MCP server and list tools
    Tool: Bash (node REPL)
    Preconditions: A stdio MCP server installed (e.g., @modelcontextprotocol/server-filesystem)
    Steps:
      1. Import createStdioClient, listTools from services/world/client
      2. Create client with command='npx', args=['-y', '@modelcontextprotocol/server-filesystem', '/tmp']
      3. Await connect — assert returns Client instance
      4. Call listTools — assert returns array with length > 0
      5. Verify each tool has name, description, inputSchema
      6. Disconnect
    Expected Result: Connection succeeds, tools listed, clean disconnect
    Failure Indicators: Connection timeout, empty tools array, unhandled promise rejection
    Evidence: .sisyphus/evidence/task-6-stdio-connect.txt

  Scenario: Tool call error handling
    Tool: Bash (node REPL)
    Preconditions: Connected stdio client
    Steps:
      1. Call callTool with nonexistent tool name 'does_not_exist'
      2. Assert McpToolError is thrown
      3. Assert error message contains tool name and server ID
    Expected Result: Graceful error with context
    Failure Indicators: Uncaught exception, generic error without context
    Evidence: .sisyphus/evidence/task-6-tool-error.txt
  ```

  **Commit**: YES (groups with Wave 2)
  - Message: `feat(world): add MCP client service with stdio transport`

- [x] 7. MCP client service — HTTP/SSE transport

  **What to do**:
  - Extend `backend-ts/src/services/world/client.ts` with:
    - `createHttpClient(config: WorldServerRow): Promise<Client>` — uses `SSEClientTransport` (v1.x) from SDK, connects to `config.url`, applies `config.headersJson` as headers
    - Refactor `listTools`, `callTool`, `disconnectClient` to work with any transport (already generic if using `Client` interface from Task 6)
  - Add HTTP-specific error handling:
    - 4xx/5xx responses → throw `McpConnectionError` with HTTP status
    - SSE stream interruption → reconnect with exponential backoff (3 retries, 1s/2s/4s)
    - DNS resolution failure → clear error message
  - Write tests with mocked HTTP transport

  **Must NOT do**:
  - Do NOT implement OAuth token exchange — HTTP headers from config only
  - Do NOT implement Streamable HTTP (v2 feature) — use SSE only per v1.x SDK

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: HTTP transport with retry logic, SSE handling, and error recovery
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 8, 9, 10, 11)
  - **Blocks**: Tasks 10, 15, 17
  - **Blocked By**: Tasks 1 (dep), 3 (server config), 6 (client base)

  **References**:
  - `@modelcontextprotocol/sdk` v1.29.0 — `SSEClientTransport` from `@modelcontextprotocol/sdk/client/sse.js`
  - Task 6 `client.ts` — `createStdioClient` pattern to mirror for HTTP variant
  - `backend-ts/src/routers/ask.router.ts` — existing SSE stream handling pattern (read for understanding, not to copy)

  **Acceptance Criteria**:
  - [ ] Test: `createHttpClient` connects to mock SSE endpoint
  - [ ] Test: HTTP 500 response triggers retry with backoff
  - [ ] Test: DNS failure returns clear error message
  - [ ] Test: custom headers from config are sent correctly

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Connect to HTTP MCP server and call a tool
    Tool: Bash (curl + node REPL)
    Preconditions: An HTTP MCP server running (or mock)
    Steps:
      1. Create HTTP client with url='http://localhost:3001/mcp/sse'
      2. Connect — assert success
      3. List tools — assert non-empty
      4. Call a tool with valid args
      5. Assert result content is non-empty
    Expected Result: Full HTTP MCP lifecycle works
    Failure Indicators: Connection refused, SSE parse error, tool call timeout
    Evidence: .sisyphus/evidence/task-7-http-connect.txt

  Scenario: HTTP error recovery with retry
    Tool: Bash (node REPL)
    Preconditions: Mock server that fails first 2 attempts
    Steps:
      1. Create HTTP client pointing to flaky mock
      2. Connect — should succeed on 3rd attempt
      3. Verify retry count = 2 (logged)
    Expected Result: Connection succeeds after retries
    Failure Indicators: Fails permanently on first error, no retry logic
    Evidence: .sisyphus/evidence/task-7-http-retry.txt
  ```

  **Commit**: YES (groups with Wave 2)
  - Message: `feat(world): add MCP client HTTP/SSE transport support`

- [x] 8. MCP server registry — lifecycle management

  **What to do**:
  - Create `backend-ts/src/services/world/registry.ts` with:
    - `Registry` class (or module-level Map):
      - `connectServer(serverRow: WorldServerRow): Promise<void>` — creates client via Task 6/7 based on transport, stores in Map, updates DB status to 'connected'
      - `disconnectServer(serverId: string): Promise<void>` — closes client, removes from Map, updates DB status to 'disconnected'
      - `getClient(serverId: string): Client | undefined` — returns connected client from Map
      - `isConnected(serverId: string): boolean` — checks Map
      - `listConnected(): string[]` — returns list of connected server IDs
      - `healthCheck(serverId: string): Promise<boolean>` — calls `listTools` on client, marks status
    - Auto-reconnect on transport failure (optional, toggle via config)
    - Startup: on app boot, read all enabled servers from DB, attempt connection (non-blocking, log failures)

  **Must NOT do**:
  - Do NOT leak subprocesses — ensure stdio transports are killed on disconnect
  - Do NOT block app startup on MCP connection failures

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Stateful registry with lifecycle management, subprocess cleanup, and startup orchestration
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 7, 9, 10, 11)
  - **Blocks**: Tasks 9, 10, 15, 17, 20, 23
  - **Blocked By**: Tasks 3 (repo), 6, 7 (client services)

  **References**:
  - `backend-ts/src/services/ai/dispatcher.ts` — provider selection pattern (switch on config field)
  - `backend-ts/src/db/repositories/world.repo.ts` — `updateWorldServerStatus()` for persisting connection state
  - `backend-ts/src/lib/abortRegistry.ts` — AbortController registry pattern (similar cleanup/registration pattern)

  **Acceptance Criteria**:
  - [ ] Test: `connectServer` for stdio creates client and marks status
  - [ ] Test: `connectServer` for HTTP creates client and marks status
  - [ ] Test: `disconnectServer` closes client and marks status
  - [ ] Test: `getClient` returns undefined for unknown server
  - [ ] Test: `healthCheck` returns true for healthy, false for broken
  - [ ] Test: stdio subprocess is killed on disconnect (no zombie processes)

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Registry lifecycle — connect, use, disconnect
    Tool: Bash (node REPL)
    Preconditions: Test DB with one stdio server configured
    Steps:
      1. Import Registry, connectServer, getClient, disconnectServer
      2. connectServer(stdioConfig) — assert success
      3. getClient(serverId) — assert returns Client instance
      4. healthCheck(serverId) — assert true
      5. disconnectServer(serverId) — assert success
      6. getClient(serverId) — assert undefined
    Expected Result: Full lifecycle without leaks
    Failure Indicators: Client not cleaned up, health check hangs, status not updated in DB
    Evidence: .sisyphus/evidence/task-8-registry-lifecycle.txt

  Scenario: Startup connects to all enabled servers
    Tool: Bash (node REPL)
    Preconditions: 3 servers in DB, 2 enabled, 1 disabled, 1 with broken config
    Steps:
      1. Call registry startup (connectAllEnabled)
      2. Assert 1 connected (the healthy enabled one)
      3. Assert 1 failed (broken config) — logged but not blocking
      4. Assert 1 skipped (disabled)
    Expected Result: Best-effort startup, failures don't crash app
    Failure Indicators: App crashes on connection failure, disabled servers connected
    Evidence: .sisyphus/evidence/task-8-registry-startup.txt
  ```

  **Commit**: YES (groups with Wave 2)
  - Message: `feat(world): add MCP server registry with lifecycle management`

- [x] 9. World router — server CRUD endpoints

  **What to do**:
  - Create `backend-ts/src/routers/world.router.ts` as `OpenAPIHono` router
  - Implement REST endpoints:
    - `GET /world/servers` — list all configured servers (with lastStatus, tools count if connected)
    - `GET /world/servers/{id}` — get single server details
    - `POST /world/servers` — create new server config (validates transport-specific fields)
    - `PUT /world/servers/{id}` — update server config
    - `DELETE /world/servers/{id}` — delete server (disconnect first if connected)
    - `POST /world/servers/{id}/connect` — manually connect a server via registry
    - `POST /world/servers/{id}/disconnect` — manually disconnect
    - `GET /world/servers/{id}/tools` — list tools from connected server
  - Mount router in `backend-ts/src/app.ts`: add `app.route('/', worldRouter)` after `metricsRouter` line
  - Use `@hono/zod-openapi` `createRoute()` for OpenAPI docs generation
  - All responses use `{ detail: "..." }` error shape via `HttpError`

  **Must NOT do**:
  - Do NOT add `/world/mcp` endpoint here — that's Task 20
  - Do NOT invoke tools here — that's Task 10
  - Do NOT break existing router order — mount after metrics

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Multiple REST endpoints with validation, error handling, and OpenAPI docs — moderate complexity
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (partially — independent from Task 10 but shares world.repo)
  - **Parallel Group**: Wave 2 (with Tasks 6, 7, 8, 10, 11)
  - **Blocks**: Tasks 12, 13, 14, 17
  - **Blocked By**: Tasks 2, 3, 4, 5, 8

  **References**:
  - `backend-ts/src/routers/config.router.ts` — config CRUD pattern with `createRoute()` + Zod schemas
  - `backend-ts/src/routers/sessions.router.ts` — CRUD router with path parameters
  - `backend-ts/src/app.ts:36-42` — router mounting order (mount world router after metrics on line 42)
  - `backend-ts/src/schemas/world.schema.ts` — Zod schemas created in Task 4

  **Acceptance Criteria**:
  - [ ] Test: `GET /world/servers` returns empty list initially, populated after creation
  - [ ] Test: `POST /world/servers` with valid stdio config returns 201
  - [ ] Test: `POST /world/servers` with invalid transport returns 400 with detail
  - [ ] Test: `GET /world/servers/{id}` returns 404 for unknown ID
  - [ ] Test: `DELETE /world/servers/{id}` disconnects if connected, then deletes

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Full server CRUD lifecycle via REST
    Tool: Bash (curl)
    Preconditions: Backend running on localhost:8000
    Steps:
      1. curl -X POST localhost:8000/world/servers -H "Content-Type: application/json" -d '{"name":"test-stdio","transport":"stdio","command":"echo","args":["hello"]}'
      2. Assert: 201, response has id, name='test-stdio'
      3. curl localhost:8000/world/servers — assert list has 1 item
      4. curl localhost:8000/world/servers/{id} — assert full details
      5. curl -X PUT localhost:8000/world/servers/{id} -d '{"name":"renamed"}' — assert 200, name changed
      6. curl -X DELETE localhost:8000/world/servers/{id} — assert 200
      7. curl localhost:8000/world/servers — assert empty list
    Expected Result: Full CRUD lifecycle via REST
    Failure Indicators: 500 errors, wrong status codes, data not persisted
    Evidence: .sisyphus/evidence/task-9-server-crud.txt

  Scenario: Validation errors return 400 with detail
    Tool: Bash (curl)
    Preconditions: Backend running
    Steps:
      1. curl -X POST localhost:8000/world/servers -d '{"transport":"stdio"}' — missing name
      2. Assert: 400, response.detail contains validation error message
      3. curl -X POST localhost:8000/world/servers -d '{"name":"x","transport":"http"}' — missing url
      4. Assert: 400, response.detail mentions url
    Expected Result: Proper validation error responses
    Failure Indicators: 500 instead of 400, generic error without field info
    Evidence: .sisyphus/evidence/task-9-validation-errors.txt
  ```

  **Commit**: YES (groups with Wave 2)
  - Message: `feat(world): add world router with server CRUD endpoints`

- [x] 10. World router — tool invocation endpoint

  **What to do**:
  - Add to `backend-ts/src/routers/world.router.ts`:
    - `POST /world/invoke` — invokes a tool on a connected MCP server
      - Request body: `{ serverId: string, toolName: string, arguments: Record<string, unknown> }`
      - Guard: `requireMcpServer()` to validate server exists
      - Get client from registry: `registry.getClient(serverId)`
      - If not connected: attempt auto-connect, fail with 503 if cannot
      - Call `client.callTool({ name: toolName, arguments })`
      - Return result content array
      - Log invocation to `requestLogs` with kind='mcp_client_call'
    - `POST /world/servers/{id}/tools/{toolName}` — alternative path-based invoke
  - Error handling:
    - Server not connected → 503 `{ detail: "MCP server not connected" }`
    - Tool not found → 404 `{ detail: "Tool 'X' not found on server 'Y'" }`
    - Tool execution error → 502 `{ detail: "Tool execution failed: ..." }`
    - Timeout → 504 `{ detail: "Tool call timed out after 60s" }`

  **Must NOT do**:
  - Do NOT stream tool results — synchronous request/response only for now
  - Do NOT cache tool results — always invoke fresh

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Integration endpoint bridging REST to MCP protocol with error translation
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 7, 8, 9, 11)
  - **Blocks**: Tasks 12, 15, 17
  - **Blocked By**: Tasks 4 (schemas), 5 (guards), 6, 7, 8 (client + registry)

  **References**:
  - `backend-ts/src/routers/ask.router.ts` — `POST /ask/sync` pattern (synchronous request/response with AI call)
  - `backend-ts/src/services/world/client.ts` — `callTool()` function from Task 6
  - `backend-ts/src/services/world/registry.ts` — `getClient()`, `healthCheck()` from Task 8
  - `backend-ts/src/db/repositories/logs.repo.ts` — `addLog()` for request logging

  **Acceptance Criteria**:
  - [ ] Test: `POST /world/invoke` with valid serverId + toolName + args returns tool result
  - [ ] Test: `POST /world/invoke` with disconnected server returns 503
  - [ ] Test: `POST /world/invoke` with nonexistent tool returns 404
  - [ ] Test: Tool call logged to requestLogs with kind='mcp_client_call'

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Invoke MCP tool via REST endpoint
    Tool: Bash (curl)
    Preconditions: Backend running, one stdio MCP server connected
    Steps:
      1. curl -X POST localhost:8000/world/invoke \
         -H "Content-Type: application/json" \
         -d '{"serverId":"srv-1","toolName":"echo.ping","arguments":{"message":"hello"}}'
      2. Assert: 200, response.content is array with text result
    Expected Result: Tool invoked successfully, result returned
    Failure Indicators: Connection error, timeout, wrong tool name resolution
    Evidence: .sisyphus/evidence/task-10-invoke-success.txt

  Scenario: Tool invocation error handling
    Tool: Bash (curl)
    Preconditions: Backend running, server connected
    Steps:
      1. curl -X POST localhost:8000/world/invoke -d '{"serverId":"nonexistent","toolName":"x","arguments":{}}'
      2. Assert: 404, detail mentions "not found"
      3. curl -X POST localhost:8000/world/invoke -d '{"serverId":"srv-1","toolName":"nonexistent_tool","arguments":{}}'
      4. Assert: 404, detail mentions tool name
    Expected Result: Proper error codes and messages
    Failure Indicators: 500 generic error, success for nonexistent resources
    Evidence: .sisyphus/evidence/task-10-invoke-errors.txt
  ```

  **Commit**: YES (groups with Wave 2)
  - Message: `feat(world): add tool invocation endpoint to world router`

- [x] 11. Extend test setup with MCP transport mocks

  **What to do**:
  - Extend `backend-ts/tests/integration/_setup.ts` with:
    - `vi.mock` for `@modelcontextprotocol/sdk/client/index.js` → mock `Client` class:
      - `connect()` → resolves immediately
      - `listTools()` → returns mock tool array: `[{ name: 'mock.echo', description: 'Echo tool', inputSchema: {...} }]`
      - `callTool()` → returns `{ content: [{ type: 'text', text: 'mock-tool-result' }] }`
      - `close()` → resolves
    - `vi.mock` for `@modelcontextprotocol/sdk/client/stdio.js` → mock `StdioClientTransport`
    - `vi.mock` for `@modelcontextprotocol/sdk/client/sse.js` → mock `SSEClientTransport`
  - Export helper functions for tests:
    - `seedWorldConfig(overrides?)` — inserts/updates world_config row
    - `seedWorldServer(overrides?)` — creates a test server in DB
    - `resetWorldData()` — clears world_config + world_servers tables (called in beforeEach)

  **Must NOT do**:
  - Do NOT mock real subprocess spawning — mock the transport layer only
  - Do NOT remove or break existing mocks for AI dispatcher and GitHub service

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Test setup extensions following established `vi.mock` pattern
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 7, 8, 9, 10)
  - **Blocks**: Tasks 17, 22, 26
  - **Blocked By**: Tasks 1 (dep), 2, 3 (tables exist for seeding)

  **References**:
  - `backend-ts/tests/integration/_setup.ts:40-64` — existing `vi.mock` pattern for AI dispatcher and GitHub
  - `backend-ts/tests/integration/_setup.ts:72-78` — `beforeEach` cleanup pattern (add world table resets)
  - `backend-ts/src/db/repositories/world.repo.ts` — repo functions to seed test data

  **Acceptance Criteria**:
  - [ ] Test: Mocked client returns expected tools from `listTools()`
  - [ ] Test: Mocked client returns mock result from `callTool()`
  - [ ] Test: `seedWorldServer()` creates a server in in-memory SQLite
  - [ ] Test: `resetWorldData()` clears tables between tests
  - [ ] Test: Existing tests still pass (regression — run full suite)

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Mocked MCP client in integration tests
    Tool: Bash (pnpm test)
    Preconditions: _setup.ts extended
    Steps:
      1. cd backend-ts && pnpm test -- tests/integration/world.test.ts
      2. Verify tests using mocked client pass
      3. cd backend-ts && pnpm test (full suite)
      4. Assert all existing tests still pass
    Expected Result: All tests pass, no regressions
    Failure Indicators: Mock collision with existing mocks, test failures in unrelated suites
    Evidence: .sisyphus/evidence/task-11-test-setup.txt
  ```

  **Commit**: YES (groups with Wave 2)
  - Message: `feat(world): extend integration test setup with MCP transport mocks`

### Wave 3 — Frontend + Integration (After Wave 2)

- [x] 12. API client extensions — `api.world.*` methods

  **What to do**:
  - Add to `frontend/lib/api.ts`:
    - `api.world.listServers(): Promise<WorldServer[]>` — `GET /world/servers`
    - `api.world.getServer(id: string): Promise<WorldServer>` — `GET /world/servers/{id}`
    - `api.world.createServer(data: WorldServerCreate): Promise<WorldServer>` — `POST /world/servers`
    - `api.world.updateServer(id: string, data: Partial<WorldServerCreate>): Promise<WorldServer>` — `PUT /world/servers/{id}`
    - `api.world.deleteServer(id: string): Promise<void>` — `DELETE /world/servers/{id}`
    - `api.world.connectServer(id: string): Promise<void>` — `POST /world/servers/{id}/connect`
    - `api.world.disconnectServer(id: string): Promise<void>` — `POST /world/servers/{id}/disconnect`
    - `api.world.listTools(serverId: string): Promise<ToolListResponse>` — `GET /world/servers/{id}/tools`
    - `api.world.invoke(serverId: string, toolName: string, args: Record<string, unknown>): Promise<ToolInvokeResponse>` — `POST /world/invoke`
  - Add TypeScript types matching API response shapes (from Task 4 schemas)
  - Follow existing `request<T>()` helper pattern in api.ts

  **Must NOT do**:
  - Do NOT add SSE streaming for tool results — synchronous request/response only
  - Do NOT add caching or request deduplication

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: API client method additions following existing `request<T>` pattern
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 13, 14, 15, 16, 17)
  - **Blocks**: Tasks 13, 14, 15, 16
  - **Blocked By**: Tasks 9, 10 (router endpoints must exist)

  **References**:
  - `frontend/lib/api.ts:1-16` — existing `request<T>()` helper + BASE_URL pattern
  - `frontend/lib/api.ts` — existing method patterns: `sessions`, `config`, `kb`, `ask`, `sdlc`, `metrics`
  - `frontend/lib/types.ts` — shared TypeScript interfaces, add world types here

  **Acceptance Criteria**:
  - [ ] Test: `api.world.listServers()` returns typed array
  - [ ] Test: `api.world.createServer()` sends correct POST body
  - [ ] Test: `api.world.invoke()` sends correct args and returns typed result
  - [ ] Test: Error responses throw with detail message

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: API client CRUD round-trip
    Tool: Bash (Vitest in frontend)
    Preconditions: Backend running with world router
    Steps:
      1. Import api from lib/api
      2. const srv = await api.world.createServer({ name: 'test', transport: 'http', url: 'http://localhost:3001/mcp' })
      3. Assert srv.id is string, srv.name === 'test'
      4. const list = await api.world.listServers() — assert includes created server
      5. await api.world.deleteServer(srv.id)
      6. const list2 = await api.world.listServers() — assert empty
    Expected Result: API client methods work end-to-end
    Failure Indicators: Type errors, wrong URL paths, error parsing
    Evidence: .sisyphus/evidence/task-12-api-client.txt
  ```

  **Commit**: YES (groups with Wave 3)
  - Message: `feat(world): add api.world client methods and types`

- [x] 13. WorldPanel — server list + add/edit form

  **What to do**:
  - Create `frontend/components/workspace/WorldPanel.tsx`:
    - **Server list view**: Table/card list of configured MCP servers showing:
      - Name, transport type (badge), URL/command, connection status (color dot: green=connected, red=disconnected, gray=unknown)
      - Action buttons per row: Connect/Disconnect, Edit, Delete
    - **Add server form**: Modal or inline form with:
      - Name input, transport selector (stdio | http)
      - Conditional fields: if stdio → command + args (textarea, one per line); if HTTP → URL input + headers (optional key-value editor)
      - Save button → calls `api.world.createServer()`
    - **Edit server form**: Same as add, pre-populated, calls `api.world.updateServer()`
    - **Delete confirmation**: Simple confirm dialog → calls `api.world.deleteServer()`
  - Use local `useState` for form state and server list (no React Query)
  - Refresh server list after mutations
  - Style with TailwindCSS, match existing panel design (terminal/dark theme, monospace accents)

  **Must NOT do**:
  - Do NOT introduce React Query, Zustand, or any state management library
  - Do NOT implement real-time status updates (polling) — refresh on user action only for now

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI component with forms, conditional fields, status indicators, and TailwindCSS styling
  - **Skills**: [`/frontend-ui-ux`]
    - `/frontend-ui-ux`: Design quality and TailwindCSS styling matching existing terminal/workspace theme

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 12, 14, 15, 16, 17)
  - **Blocks**: Task 17
  - **Blocked By**: Tasks 9 (router), 12 (api client)

  **References**:
  - `frontend/components/workspace/SettingsPanel.tsx` — form pattern (inputs, save button, state management)
  - `frontend/components/workspace/SessionsPanel.tsx` — list pattern (table/cards with action buttons)
  - `frontend/lib/theme.ts` — THEMES map for dark theme consistency
  - `frontend/lib/api.ts` — `api.world.*` methods from Task 12

  **Acceptance Criteria**:
  - [ ] Component renders server list (empty state: "No MCP servers configured" message)
  - [ ] Add button opens form, filling all fields and submitting creates server
  - [ ] Transport selector toggles conditional fields (stdio ↔ http)
  - [ ] Edit button opens pre-populated form
  - [ ] Delete button shows confirmation, removes server on confirm
  - [ ] Connect/Disconnect buttons work and update status indicator

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Add and manage MCP server via WorldPanel
    Tool: Playwright (playwright skill)
    Preconditions: Backend running, WorldPanel open in browser
    Steps:
      1. Navigate to workspace, open WorldPanel
      2. Assert: "No MCP servers configured" empty state visible
      3. Click "Add Server" button
      4. Fill: name="Test HTTP Server", transport select="http", url="http://localhost:3001/mcp/sse"
      5. Click Save — assert server appears in list with status dot "disconnected" (gray)
      6. Click Connect — assert status changes to green "connected"
      7. Click Disconnect — assert status changes to gray "disconnected"
      8. Click Delete, confirm — assert server removed from list
    Expected Result: Full UI CRUD lifecycle works
    Failure Indicators: Form validation blocks submit incorrectly, status not updating, delete not working
    Evidence: .sisyphus/evidence/task-13-world-panel-crud.png
  ```

  **Commit**: YES (groups with Wave 3)
  - Message: `feat(world): add WorldPanel with server CRUD management UI`

- [x] 14. WorldPanel — tool browser

  **What to do**:
  - Add tool browser section to WorldPanel:
    - When a connected server is selected, show its tools list
    - Each tool card shows: name, description, input schema (collapsed by default)
    - "Test" button per tool → opens a simple argument editor (JSON textarea) → calls tool → shows result
  - Tool list refreshes when server connects/disconnects
  - Result display: formatted text output (markdown-friendly), error states with red styling

  **Must NOT do**:
  - Do NOT implement a full JSON Schema form builder — simple textarea for args is sufficient
  - Do NOT implement tool argument autocomplete

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Tool browser UI with expandable details, JSON editing, and result display
  - **Skills**: [`/frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 12, 13, 15, 16, 17)
  - **Blocks**: Task 17
  - **Blocked By**: Tasks 9 (router), 12 (api client), 13 (WorldPanel base)

  **References**:
  - `frontend/components/workspace/WorldPanel.tsx` — Task 13 base component to extend
  - `frontend/components/workspace/RagPanel.tsx` — result display pattern (markdown rendering, streaming)
  - `frontend/components/workspace/InsightsPanel.tsx` — expandable card pattern
  - `frontend/lib/api.ts` — `api.world.listTools()`, `api.world.invoke()`

  **Acceptance Criteria**:
  - [ ] Clicking a connected server shows its tools list
  - [ ] Tool cards show name, description, expandable schema
  - [ ] "Test" button opens argument editor
  - [ ] Submitting valid args invokes tool and shows result
  - [ ] Submitting invalid JSON shows validation error in UI

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Browse and test MCP tool via WorldPanel
    Tool: Playwright (playwright skill)
    Preconditions: Server connected with tools available
    Steps:
      1. In WorldPanel, click on connected server row
      2. Assert: tools list appears below with at least 1 tool card
      3. Assert: tool card shows name, description text
      4. Click expand on first tool card — assert schema JSON visible
      5. Click "Test" on first tool — assert argument editor opens
      6. Type: {"message": "hello"} in args textarea
      7. Click "Invoke" — assert result appears in result area
      8. Type: {invalid json} — click invoke — assert error message shown
    Expected Result: Tool browsing and testing works
    Failure Indicators: Tools not loading, result not displaying, error swallowed
    Evidence: .sisyphus/evidence/task-14-tool-browser.png
  ```

  **Commit**: YES (groups with Wave 3)
  - Message: `feat(world): add tool browser to WorldPanel`

- [x] 15. `/tool` slash command in `handleCmd()`

  **What to do**:
  - Add `/tool` command parsing to `frontend/app/workspace/[sessionId]/page.tsx` `handleCmd()` function (~lines 477-696):
    - Parse command format: `/tool <serverId>.<toolName> <json-args>`
    - Example: `/tool srv-1.echo.ping {"message":"hello"}`
    - Alternative: `/tool <serverName>.<toolName> <json-args>` — resolve server name to ID
  - On command match:
    - Call `api.world.invoke(serverId, toolName, args)`
    - Display result in chat as a system message with:
      - Tool name + server name header
      - Formatted result content
      - Error message if invocation fails
    - Add chat message to history
  - Command not found handling: show help message listing available commands including `/tool`

  **Must NOT do**:
  - Do NOT modify the backend — slash command parsing stays frontend-only
  - Do NOT break existing slash commands (`/ask`, `/sdlc`, `/scan`, `/kb`, etc.)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Modify existing complex `handleCmd()` switch with careful integration — must not break existing commands
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO — depends on WorldPanel context but can be developed independently
  - **Parallel Group**: Wave 3 (with Tasks 12, 13, 14, 16, 17)
  - **Blocks**: Tasks 16, 17
  - **Blocked By**: Tasks 10 (invoke endpoint), 12 (api client)

  **References**:
  - `frontend/app/workspace/[sessionId]/page.tsx` — `handleCmd()` function (find with `/sdlc`, `/ask`, `/scan` patterns)
  - `frontend/lib/api.ts` — `api.world.invoke()` from Task 12
  - `frontend/components/workspace/ChatPanel.tsx` — chat message rendering pattern (system vs user messages)

  **Acceptance Criteria**:
  - [ ] `/tool srv-1.echo.ping {"msg":"hi"}` invokes tool and shows result in chat
  - [ ] `/tool nonexistent.tool {}` shows error message in chat
  - [ ] `/tool` with no args shows help text
  - [ ] Existing commands (`/ask`, `/sdlc`, `/scan`) still work (regression)

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Invoke MCP tool via /tool slash command
    Tool: Playwright (playwright skill)
    Preconditions: Backend running, server 'srv-1' connected with 'echo.ping' tool
    Steps:
      1. Navigate to workspace, type in ChatPanel input: /tool srv-1.echo.ping {"message":"hello world"}
      2. Press Enter
      3. Assert: chat shows user message with the command
      4. Assert: chat shows system/assistant message with tool result content
      5. Assert: result contains "hello world" (echoed back)
    Expected Result: Tool invoked and result displayed in chat
    Failure Indicators: Command not recognized, no result, error without explanation
    Evidence: .sisyphus/evidence/task-15-tool-command.png

  Scenario: /tool error handling in chat
    Tool: Playwright (playwright skill)
    Preconditions: Backend running
    Steps:
      1. Type: /tool nonexistent-server.any_tool {}
      2. Press Enter
      3. Assert: error message shown in chat (red styling, "Server not found" or "Not connected")
    Expected Result: Graceful error in chat, not a crash
    Failure Indicators: Blank response, page crash, unhandled exception
    Evidence: .sisyphus/evidence/task-15-tool-error.png
  ```

  **Commit**: YES (groups with Wave 3)
  - Message: `feat(world): add /tool slash command to ChatPanel`

- [x] 16. ChatPanel integration — tool result rendering

  **What to do**:
  - Extend chat message rendering in ChatPanel to handle tool result messages:
    - Tool invocation messages (from `/tool` command) rendered with distinct visual style:
      - Header: "🔧 Tool: {server}.{tool}" with server name + tool name
      - Body: formatted result content (support markdown, code blocks)
      - Footer: timestamp
    - Error messages: red-tinted background with error icon
    - Pending state: "⏳ Invoking tool..." while waiting for result
  - No new components needed — extend existing message render logic in ChatPanel

  **Must NOT do**:
  - Do NOT add a separate tool panel — results stay in chat
  - Do NOT implement streaming tool results — synchronous display

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI rendering with distinct visual state for tool results within existing chat
  - **Skills**: [`/frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 12, 13, 14, 15, 17)
  - **Blocks**: Task 17
  - **Blocked By**: Task 15 (/tool command implemented)

  **References**:
  - `frontend/components/workspace/ChatPanel.tsx` — existing chat message rendering (look for message type/role switches)
  - `frontend/lib/types.ts` — message type definitions (add tool_invocation or similar)
  - `frontend/lib/theme.ts` — theme colors for error/success states

  **Acceptance Criteria**:
  - [ ] Tool result messages rendered with distinct header showing server.tool name
  - [ ] Error messages rendered with red tint and error icon
  - [ ] Pending state shown during tool invocation
  - [ ] Markdown/code blocks in tool results rendered correctly

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Tool result visual rendering in chat
    Tool: Playwright (playwright skill)
    Preconditions: /tool command invoked successfully
    Steps:
      1. Invoke a tool that returns markdown-formatted text
      2. Assert: result message has tool header "🔧 Tool: server.tool"
      3. Assert: markdown rendered correctly (headings, code blocks)
      4. Invoke a tool with invalid args
      5. Assert: error message has red background and error indicator
    Expected Result: Distinct visual rendering for tool results vs regular chat
    Failure Indicators: Plain text rendering (no formatting), error looks same as success, no header
    Evidence: .sisyphus/evidence/task-16-tool-rendering.png
  ```

  **Commit**: YES (groups with Wave 3)
  - Message: `feat(world): add tool result rendering in ChatPanel`

- [x] 17. End-to-end integration tests — Phase 1 QA

  **What to do**:
  - Write comprehensive integration tests covering Phase 1 (MCP Client + UI):
    - **Backend**: `backend-ts/tests/integration/world.test.ts`
      - Server CRUD lifecycle (create → list → get → update → delete)
      - Tool invocation via REST endpoint
      - Error cases: invalid transport, missing fields, server not connected
      - Request logging: verify MCP invocations appear in requestLogs
      - Guards: requireMcpServer returns 404, requireWorldConfig returns config
    - **Frontend**: `frontend/test/world.test.tsx`
      - WorldPanel renders empty state
      - WorldPanel form: add server, edit server, delete server
      - API client methods: type safety, error handling
    - **Cross-cutting**: Verify all existing tests still pass (full `pnpm test` + `npm test`)
  - All tests use the mocked MCP transport from Task 11

  **Must NOT do**:
  - Do NOT rely on real MCP servers in CI — all tests use mocks
  - Do NOT skip test coverage for error paths

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Comprehensive test suite across backend + frontend with integration testing
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (runs after all Wave 3 tasks complete)
  - **Parallel Group**: Wave 3 (with Tasks 12, 13, 14, 15, 16)
  - **Blocks**: F1, F2, F3, F4
  - **Blocked By**: Tasks 11 (test setup), 13, 14, 15, 16 (features)

  **References**:
  - `backend-ts/tests/integration/` — existing integration test patterns (sdlc.test.ts, sessions.test.ts, etc.)
  - `backend-ts/tests/integration/_setup.ts` — shared test setup with mocks
  - `frontend/test/` — existing frontend test patterns
  - `backend-ts/vitest.config.ts` — backend test config
  - `frontend/vitest.config.ts` — frontend test config

  **Acceptance Criteria**:
  - [ ] Backend: 15+ test cases covering CRUD, invoke, errors, guards, logging
  - [ ] Frontend: 8+ test cases covering UI states and API client
  - [ ] All tests pass: `cd backend-ts && pnpm test` + `cd frontend && npm test`
  - [ ] Zero regressions in existing test suites

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Full test suite passes with world tests
    Tool: Bash (pnpm test + npm test)
    Preconditions: All Phase 1 code implemented
    Steps:
      1. cd backend-ts && pnpm test
      2. Assert: all tests pass (exit code 0)
      3. cd frontend && npm test
      4. Assert: all tests pass (exit code 0)
      5. Verify test output includes world test files
    Expected Result: Green test suite with new tests contributing
    Failure Indicators: Test failures, skipped tests, timeout
    Evidence: .sisyphus/evidence/task-17-test-suite.txt
  ```

  **Commit**: YES (groups with Wave 3)
  - Message: `test(world): add integration tests for Phase 1 MCP client + UI`

### Wave 4 — MCP Server: Yummy as MCP Tools (After Wave 3)

- [x] 18. Yummy-to-MCP tool mapping

  **What to do**:
  - Create `backend-ts/src/services/world/tools.ts`:
    - Define MCP tool definitions for each Yummy capability:
      - `yummy.rag_ask` — Ask a question against the knowledge base (maps to `/ask/sync`)
        - Input: `{ question: string, sessionId?: string }` 
        - Output: text answer
      - `yummy.rag_ask_free` — Free-form chat without KB context (maps to `/ask/free`)
      - `yummy.scan_repo` — Scan a GitHub repository (maps to `/kb/scan`)
        - Input: `{ repoUrl: string }`
      - `yummy.get_kb_insights` — Get knowledge base insights (maps to `GET /kb`)
      - `yummy.sdlc_start` — Start SDLC workflow with change request (maps to `POST /sdlc/start`)
        - Input: `{ sessionId: string, changeRequest: string }`
      - `yummy.sdlc_status` — Get SDLC workflow status (maps to `GET /sdlc/{id}/status`)
      - `yummy.session_create` — Create a new session (maps to `POST /sessions`)
      - `yummy.session_list` — List sessions (maps to `GET /sessions`)
    - Each tool definition includes: name, description, inputSchema (JSON Schema object)
    - `getAllToolDefinitions(): Tool[]` — returns all tool definitions
    - `executeToolCall(name: string, args: Record<string, unknown>): Promise<CallToolResult>` — routes tool call to appropriate backend service

  **Must NOT do**:
  - Do NOT call MCP client services — this is server-side tool mapping only
  - Do NOT expose internal implementation details in tool descriptions

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Mapping existing services to MCP tool interface — requires understanding of all Yummy services
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 19, 20, 21, 22)
  - **Blocks**: Tasks 19, 20, 22
  - **Blocked By**: Tasks 2 (world config for session auth)

  **References**:
  - `resources/YUMMY_PLATFORM_ARCHITECTURE.md:404-501` — Python MCP tool definitions (adapt to TypeScript)
  - `resources/YUMMY_PLATFORM_ARCHITECTURE.md:668-681` — REST-to-MCP tool mapping table
  - `backend-ts/src/routers/ask.router.ts` — `/ask/sync` endpoint to call
  - `backend-ts/src/routers/sdlc.router.ts` — `/sdlc/start` endpoint
  - `backend-ts/src/routers/kb.router.ts` — `/kb/scan`, `GET /kb`
  - `backend-ts/src/routers/sessions.router.ts` — session CRUD
  - `backend-ts/src/services/ai/dispatcher.ts` — `callAI()` for RAG/tool execution

  **Acceptance Criteria**:
  - [ ] `getAllToolDefinitions()` returns 8+ tool definitions with valid JSON Schemas
  - [ ] `executeToolCall('yummy.rag_ask', { question: 'test' })` calls AI dispatcher and returns result
  - [ ] `executeToolCall('yummy.sdlc_start', { sessionId, changeRequest })` triggers SDLC flow
  - [ ] Unknown tool name throws descriptive error
  - [ ] Each tool definition has a non-empty `description` and valid `inputSchema`

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: List all Yummy MCP tools
    Tool: Bash (node REPL)
    Preconditions: tools.ts compiled
    Steps:
      1. Import getAllToolDefinitions from services/world/tools
      2. const tools = getAllToolDefinitions()
      3. Assert tools.length >= 8
      4. Assert each tool has name, description, inputSchema properties
      5. Assert tool names follow yummy.* naming convention
    Expected Result: Comprehensive tool list with valid schemas
    Failure Indicators: Missing tools, invalid JSON Schema, empty descriptions
    Evidence: .sisyphus/evidence/task-18-tool-definitions.txt

  Scenario: Execute a Yummy MCP tool
    Tool: Bash (node REPL)
    Preconditions: DB seeded, AI dispatcher mocked
    Steps:
      1. Import executeToolCall from services/world/tools
      2. const result = await executeToolCall('yummy.rag_ask', { question: 'What is Yummy?' })
      3. Assert result.content is array with type='text' items
      4. Assert result.content[0].text is non-empty string
    Expected Result: Tool executed and returned meaningful result
    Failure Indicators: Error thrown, empty result, wrong tool routing
    Evidence: .sisyphus/evidence/task-18-tool-execute.txt
  ```

  **Commit**: YES (groups with Wave 4)
  - Message: `feat(world): add Yummy-to-MCP tool mapping definitions`

- [x] 19. MCP server transport — WebStandardStreamableHTTPServerTransport

  **What to do**:
  - Create `backend-ts/src/services/world/server.ts`:
    - Instantiate MCP `Server` from `@modelcontextprotocol/sdk/server/index.js`:
      ```typescript
      const server = new Server(
        { name: 'yummy-world', version: '1.0.0' },
        { capabilities: { tools: {} } }
      );
      ```
    - Register tools handler: `server.setRequestHandler('tools/list', ...)` → returns `getAllToolDefinitions()`
    - Register tool call handler: `server.setRequestHandler('tools/call', ...)` → calls `executeToolCall()`
    - Error handling: wrap handlers in try/catch, return JSON-RPC error responses
  - Create `createMcpTransport()` function:
    - Uses `WebStandardStreamableHTTPServerTransport` (Hono-compatible)
    - Configured for the `/world/mcp` endpoint
  - Transport MUST NOT go through the global `errorHandler` — it uses JSON-RPC error format
  - Session handling: map `Mcp-Session-Id` header (or query param) to Yummy session for per-session isolation

  **Must NOT do**:
  - Do NOT expose tools that aren't mapped in Task 18
  - Do NOT allow MCP server without bearer token auth (enforced in Task 20)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: MCP server transport setup with Hono integration, JSON-RPC error handling, session isolation
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 18, 20, 21, 22)
  - **Blocks**: Tasks 20, 22
  - **Blocked By**: Task 18 (tool definitions)

  **References**:
  - `@modelcontextprotocol/sdk` v1.29.0 — `Server` from `@modelcontextprotocol/sdk/server/index.js`, transport classes
  - `resources/YUMMY_PLATFORM_ARCHITECTURE.md:398-501` — Python MCP server pattern (adapt to TS)
  - `backend-ts/src/app.ts:59-60` — global error handler (MUST NOT be used for MCP transport)
  - `backend-ts/src/middleware/error-handler.ts` — understand what to avoid for MCP transport

  **Acceptance Criteria**:
  - [ ] Server registers `tools/list` handler returning tool definitions
  - [ ] Server registers `tools/call` handler executing tools
  - [ ] `tools/call` with unknown tool returns JSON-RPC error
  - [ ] Transport creates valid POST handler for Hono
  - [ ] Mcp-Session-Id correctly maps to Yummy session

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: MCP server responds to initialize + tools/list
    Tool: Bash (curl)
    Preconditions: Backend running, MCP server transport mounted
    Steps:
      1. curl -X POST localhost:8000/world/mcp -H "Authorization: Bearer test-token" -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
      2. Assert: response is valid JSON-RPC with serverInfo
      3. curl -X POST localhost:8000/world/mcp -H "Authorization: Bearer test-token" -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
      4. Assert: response.tools is array with length >= 8
    Expected Result: Full MCP handshake + tool discovery
    Failure Indicators: Non-JSON-RPC response, empty tools, protocol version mismatch
    Evidence: .sisyphus/evidence/task-19-mcp-handshake.txt
  ```

  **Commit**: YES (groups with Wave 4)
  - Message: `feat(world): add MCP server transport with tool handlers`

- [x] 20. MCP server router at `/world/mcp` + bearer token auth

  **What to do**:
  - Add to `backend-ts/src/routers/world.router.ts`:
    - `POST /world/mcp` — MCP JSON-RPC endpoint
      - Extract bearer token from `Authorization` header
      - Validate against `worldConfig.mcpServerToken`
      - If `mcpServerEnabled` is false → 503 `{ detail: "MCP server is disabled" }`
      - If token missing or invalid → 401 `{ detail: "Unauthorized" }`
      - If valid: delegate request to MCP transport handler from Task 19
    - `GET /world/config` — get world config (mcpServerEnabled, token masked)
    - `PUT /world/config` — update world config (token, enabled flag)
  - Important: The `/world/mcp` POST handler must NOT use `createRoute()` with OpenAPI — it's a JSON-RPC endpoint
  - Use plain `router.post()` for `/world/mcp` (not OpenAPIHono `createRoute`)
  - Mount in `app.ts`: ensure `/world/mcp` responds correctly alongside REST routes

  **Must NOT do**:
  - Do NOT add `/world/mcp` to OpenAPI docs — JSON-RPC is not REST
  - Do NOT send `{detail}` error shape for `/world/mcp` — it needs JSON-RPC error envelope (but the auth rejection can be HTTP 401 with detail before reaching JSON-RPC handler)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Router endpoint with bearer auth, config management, and MCP transport delegation
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 18, 19, 21, 22)
  - **Blocks**: Tasks 22, F3
  - **Blocked By**: Tasks 2 (config table), 4 (schemas), 5 (guards), 19 (transport)

  **References**:
  - `backend-ts/src/routers/world.router.ts` — existing router from Tasks 9, 10
  - `backend-ts/src/routers/config.router.ts` — config CRUD pattern with singleton row
  - `backend-ts/src/db/repositories/world.repo.ts` — `getWorldConfig()`, `updateWorldConfig()`
  - `backend-ts/src/services/world/server.ts` — transport handler from Task 19

  **Acceptance Criteria**:
  - [ ] `POST /world/mcp` with valid bearer token delegates to MCP transport
  - [ ] `POST /world/mcp` without token returns 401
  - [ ] `POST /world/mcp` with wrong token returns 401
  - [ ] `POST /world/mcp` with `mcpServerEnabled=false` returns 503
  - [ ] `GET /world/config` returns config with masked token
  - [ ] `PUT /world/config` updates token and enabled flag

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Bearer token auth — valid
    Tool: Bash (curl)
    Preconditions: worldConfig.mcpServerToken='test-token', mcpServerEnabled=true
    Steps:
      1. curl -X POST localhost:8000/world/mcp -H "Authorization: Bearer test-token" -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
      2. Assert: 200, valid JSON-RPC response with serverInfo
    Expected Result: Authenticated request succeeds
    Failure Indicators: 401 despite correct token, non-JSON-RPC response
    Evidence: .sisyphus/evidence/task-20-auth-valid.txt

  Scenario: Bearer token auth — invalid/missing
    Tool: Bash (curl)
    Preconditions: Same config
    Steps:
      1. curl -X POST localhost:8000/world/mcp -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"initialize",...}'
         — no auth header
      2. Assert: 401, detail "Unauthorized"
      3. curl -X POST localhost:8000/world/mcp -H "Authorization: Bearer wrong-token" -H "Content-Type: application/json" -d '...'
      4. Assert: 401
      5. Update config: mcpServerEnabled=false
      6. curl with valid token — assert 503, detail "MCP server is disabled"
    Expected Result: Auth rejection and disabled state handled correctly
    Failure Indicators: Auth bypass, wrong status codes, JSON-RPC error instead of HTTP 401
    Evidence: .sisyphus/evidence/task-20-auth-invalid.txt
  ```

  **Commit**: YES (groups with Wave 4)
  - Message: `feat(world): add MCP server endpoint with bearer token auth`

- [x] 21. Request logging for MCP server calls

  **What to do**:
  - Extend request logging to track MCP server invocations:
    - On each `tools/call`, add a log entry to `requestLogs`:
      - `kind`: `"mcp_server_call"` (add `kind` column to `requestLogs` if needed, or use a new `world_logs` table)
      - `agent`: tool name (e.g., `"yummy.rag_ask"`)
      - `provider`: `"mcp"`
      - `model`: `"mcp-server"`
      - `inTokens`/`outTokens`: 0 (not applicable for most MCP calls, but track latency/cost if available)
      - `latency`: actual execution time in seconds
    - Consider adding a `kind` column to `requestLogs` via `ALTER TABLE` in `0002_yummy_world.sql`
    - Log MCP auth failures (kind: `"mcp_auth_failure"`)
  - Update `backend-ts/src/db/repositories/logs.repo.ts` if needed

  **Must NOT do**:
  - Do NOT break existing log format — add `kind` column with default value for backward compat
  - Do NOT log MCP tool call arguments (may contain sensitive data)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Logging extension with optional schema change — straightforward
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 18, 19, 20, 22)
  - **Blocks**: Task 22
  - **Blocked By**: Tasks 19, 20 (server must be generating calls to log)

  **References**:
  - `backend-ts/src/db/schema.ts:98-109` — `requestLogs` table definition
  - `backend-ts/src/db/repositories/logs.repo.ts` — existing logging functions
  - `backend-ts/src/services/ai/track.ts` — usage tracking pattern (adapt for MCP latency tracking)

  **Acceptance Criteria**:
  - [ ] MCP tool calls logged to requestLogs with kind='mcp_server_call'
  - [ ] Auth failures logged with kind='mcp_auth_failure'
  - [ ] Existing log queries still work (backward compat)
  - [ ] Tool arguments NOT present in logs

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: MCP calls appear in logs
    Tool: Bash (curl + GET /metrics)
    Preconditions: MCP server enabled, auth configured
    Steps:
      1. Invoke an MCP tool via /world/mcp
      2. curl localhost:8000/metrics — check logs
      3. Assert: log entry exists with kind='mcp_server_call', tool name in agent field
      4. Attempt MCP call with invalid token
      5. Assert: log entry with kind='mcp_auth_failure'
    Expected Result: MCP activity tracked in logs
    Failure Indicators: No log entries, wrong kind, argument data leaked
    Evidence: .sisyphus/evidence/task-21-mcp-logs.txt
  ```

  **Commit**: YES (groups with Wave 4)
  - Message: `feat(world): add request logging for MCP server calls`

- [x] 22. MCP server integration tests — Phase 2 QA

  **What to do**:
  - Write comprehensive tests for Phase 2 (MCP Server):
    - `backend-ts/tests/integration/world-mcp-server.test.ts`:
      - MCP `initialize` handshake returns server info
      - `tools/list` returns all 8+ Yummy tools
      - `tools/call` with valid tool returns result
      - `tools/call` with unknown tool returns JSON-RPC error
      - Bearer token: valid → success, invalid → 401, missing → 401
      - MCP server disabled → 503
      - Concurrent tool calls handled correctly (no race conditions)
      - Session isolation: calls with different Mcp-Session-Id use different Yummy sessions
    - All tests use mocked AI dispatcher (no real AI calls in CI)

  **Must NOT do**:
  - Do NOT test with real AI providers — use mocks from _setup.ts
  - Do NOT skip a single error path in tests

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Comprehensive MCP protocol-level testing with auth, error handling, and concurrency
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 18, 19, 20, 21)
  - **Blocks**: F1, F2, F3, F4
  - **Blocked By**: Tasks 11 (test setup), 20 (router)

  **References**:
  - `backend-ts/tests/integration/_setup.ts` — shared test setup
  - `backend-ts/tests/integration/world.test.ts` — Phase 1 test patterns from Task 17
  - `@modelcontextprotocol/sdk` — JSON-RPC request/response format

  **Acceptance Criteria**:
  - [ ] 12+ test cases covering MCP protocol, auth, error handling
  - [ ] All tests pass: `cd backend-ts && pnpm test -- tests/integration/world-mcp-server`
  - [ ] No regressions in existing tests

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Full MCP server test suite
    Tool: Bash (pnpm test)
    Preconditions: Phase 2 code implemented
    Steps:
      1. cd backend-ts && pnpm test
      2. Assert: all tests pass, exit code 0
      3. Verify world-mcp-server test file includes:
         - initialize test
         - tools/list test
         - tools/call test
         - auth rejection tests
         - disabled server test
    Expected Result: Comprehensive test coverage for MCP server
    Failure Indicators: Skipped tests, timeouts, partial coverage
    Evidence: .sisyphus/evidence/task-22-mcp-server-tests.txt
  ```

  **Commit**: YES (groups with Wave 4)
  - Message: `test(world): add MCP server integration tests for Phase 2`

### Wave 5 — SDLC Agent Tool Loop (After Wave 4)

- [x] 23. SDLC prompt injection — tool descriptions in agent prompts

  **What to do**:
  - Modify `backend-ts/src/routers/sdlc.router.ts` prompt construction:
    - Before each agent call, inject connected MCP tool descriptions into the system prompt
    - Format: 
      ```
      ## Available External Tools (via MCP)
      You have access to the following external tools. To invoke a tool, output:
      <tool_call server="serverId" tool="toolName">
      {"arg1": "value1", "arg2": "value2"}
      </tool_call>
      
      Available tools:
      - {serverName}/{toolName}: {description}
        Input schema: {schema}
      ```
    - Only inject if there are connected MCP servers (check registry)
    - Tool descriptions fetched from `registry.listConnected()` + `client.listTools()` per connected server
    - Cache tool descriptions per agent run (tools don't change mid-workflow)

  **Must NOT do**:
  - Do NOT modify the core `streamAI()` or `callAI()` functions in `ai/dispatcher.ts`
  - Do NOT inject tool descriptions for non-SDLC agents (only SDLC workflow agents: BA, SA, Dev Lead, DEV, QA, SEC, SRE)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Modify existing complex SDLC prompt construction with careful injection and caching — must not break existing workflow
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with Tasks 24, 25, 26)
  - **Blocks**: Tasks 24, 25, 26
  - **Blocked By**: Tasks 8 (registry), 18 (tool definitions), 20 (MCP server endpoint exists)

  **References**:
  - `backend-ts/src/routers/sdlc.router.ts` — agent prompt construction (find where `streamAI()` and `callAI()` are called with agent roles)
  - `backend-ts/src/services/world/registry.ts` — `listConnected()`, `getClient()` from Task 8
  - `backend-ts/src/services/world/tools.ts` — `getAllToolDefinitions()` from Task 18

  **Acceptance Criteria**:
  - [ ] SDLC agent prompts include tool descriptions when MCP servers connected
  - [ ] No tool descriptions injected when no servers connected (clean prompt)
  - [ ] Tool descriptions cached per agent run (not re-fetched per token)
  - [ ] Existing SDLC workflow tests still pass (regression)

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: SDLC prompt includes MCP tool descriptions
    Tool: Bash (Vitest integration test)
    Preconditions: Mocked MCP servers connected, SDLC workflow started
    Steps:
      1. Start SDLC workflow with a connected MCP server
      2. Inspect the prompt sent to streamAI/callAI for BA agent
      3. Assert: prompt contains "Available External Tools" section
      4. Assert: prompt contains tool names from connected server
      5. Start SDLC workflow with NO MCP servers connected
      6. Assert: prompt does NOT contain tool section
    Expected Result: Conditional tool injection works
    Failure Indicators: Tools injected when none connected, missing when connected, prompt corruption
    Evidence: .sisyphus/evidence/task-23-prompt-injection.txt
  ```

  **Commit**: YES (groups with Wave 5)
  - Message: `feat(world): inject MCP tool descriptions into SDLC agent prompts`

- [x] 24. SDLC tool-call parsing + invocation loop

  **What to do**:
  - Add tool-call parsing to SDLC agent execution flow in `sdlc.router.ts`:
    - After `streamAI()`/`callAI()` returns agent output, parse for `<tool_call>` markers:
      ```
      <tool_call server="srv-1" tool="echo.ping">
      {"message": "hello"}
      </tool_call>
      ```
    - Extract: server ID, tool name, arguments (JSON)
    - Call `registry.getClient(serverId).callTool({ name: toolName, arguments })`
    - Wrap result in markers and feed back to AI:
      ```
      <external_tool_output untrusted="true" server="srv-1" tool="echo.ping">
      {"content": [{"type": "text", "text": "hello"}]}
      </external_tool_output>
      ```
    - Send: `await streamAI(prompt + tool_output, instruction)` for another round
    - Max rounds: 3 (prevent infinite tool-call loops)
    - Timeout: 120s total for all tool-call rounds combined
  - Handle errors:
    - Tool not found → inject error in `<tool_error>` block, let AI handle it
    - Tool execution failed → inject error, continue
    - Timeout → stop loop, return whatever the AI has produced so far
  - This modifies the SSE streaming loop in the SDLC router — ensure SSE events are still sent correctly

  **Must NOT do**:
  - Do NOT modify `ai/dispatcher.ts` — tool calls are intercepted before/after dispatcher calls
  - Do NOT break the SSE event protocol — tool call parsing is transparent to the frontend

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Complex modification to existing SDLC streaming loop with tool-call parsing, re-invocation, and error handling
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with Tasks 23, 25, 26)
  - **Blocks**: Tasks 25, 26
  - **Blocked By**: Tasks 6, 7 (client), 8 (registry), 23 (prompt injection)

  **References**:
  - `backend-ts/src/routers/sdlc.router.ts` — SSE streaming loop (find where agent outputs are accumulated and streamed)
  - `backend-ts/src/services/world/client.ts` — `callTool()` from Task 6
  - `backend-ts/src/services/world/registry.ts` — `getClient()` from Task 8
  - `backend-ts/src/routers/sdlc.router.ts:72-80` — `SdlcEvent` type and `sse()` helper (must preserve event format)

  **Acceptance Criteria**:
  - [ ] `<tool_call>` markers in AI output trigger MCP tool invocation
  - [ ] Tool result is injected back into prompt for AI to process
  - [ ] Max 3 rounds of tool calls (prevents infinite loops)
  - [ ] Failed tool calls inject error markers, AI continues
  - [ ] Tool call parsing handles malformed markers gracefully
  - [ ] SSE events still stream correctly (no protocol breakage)
  - [ ] Existing SDLC tests still pass (regression)

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: SDLC agent invokes MCP tool mid-workflow
    Tool: Bash (Vitest integration test)
    Preconditions: Mocked MCP server connected, AI mocked to output tool_call markers
    Steps:
      1. Set mock AI response to include: '<tool_call server="srv-1" tool="echo.ping">{"message":"test"}</tool_call>'
      2. Start SDLC workflow
      3. Assert: tool is invoked with correct args
      4. Assert: tool result is injected into follow-up prompt
      5. Assert: AI processes the tool result and produces final output
    Expected Result: Tool-call loop works end-to-end
    Failure Indicators: Tool not invoked, result not fed back, infinite loop, SSE protocol broken
    Evidence: .sisyphus/evidence/task-24-tool-loop.txt

  Scenario: Tool call loop respects max rounds
    Tool: Bash (Vitest integration test)
    Preconditions: AI mocked to always output tool_call markers
    Steps:
      1. Set mock AI to always output tool_call markers (would cause infinite loop)
      2. Start SDLC workflow
      3. Assert: exactly 3 rounds of tool calls executed
      4. Assert: workflow completes with accumulated output
    Expected Result: Loop terminates after 3 rounds
    Failure Indicators: Infinite loop, hang, crash
    Evidence: .sisyphus/evidence/task-24-max-rounds.txt
  ```

  **Commit**: YES (groups with Wave 5)
  - Message: `feat(world): add SDLC agent tool-call parsing and invocation loop`

- [x] 25. SDLC tool result rendering in SdlcPanel

  **What to do**:
  - Extend `frontend/components/workspace/SdlcPanel.tsx` to display tool invocations:
    - Parse SSE events: add new event type `{ t: 'tool_call', server: string, tool: string, args: unknown }` and `{ t: 'tool_result', server: string, tool: string, content: unknown }`
    - Backend: emit these SSE events from Task 24 when tool calls happen
    - Frontend: render tool call events in the agent output stream:
      - Collapsed by default: "🔧 Called tool: {server}/{tool}" with expand/collapse toggle
      - Expanded: show args sent and result received
      - Tool error: red styling with error message
    - Tool calls appear inline with agent output text (not in a separate panel)

  **Must NOT do**:
  - Do NOT add a separate tool log panel — inline with agent output
  - Do NOT allow editing tool args retroactively (read-only display)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI component extending existing agent output rendering with tool call cards
  - **Skills**: [`/frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with Tasks 23, 24, 26)
  - **Blocks**: Task 26
  - **Blocked By**: Tasks 15 (chat rendering pattern), 24 (SSE events emitted)

  **References**:
  - `frontend/components/workspace/SdlcPanel.tsx` — existing SDLC output rendering (find where `agent_done` and `c` events are handled)
  - `frontend/components/workspace/AgentCard.tsx` — agent output card pattern
  - `backend-ts/src/routers/sdlc.router.ts:72-80` — `SdlcEvent` type (new event types added here)
  - `frontend/lib/api.ts:19-25` — `SdlcEvent` type (frontend copy, must update)

  **Acceptance Criteria**:
  - [ ] Tool call SSE events rendered inline in agent output
  - [ ] Tool calls collapsible — show server/tool name, expand to see args + result
  - [ ] Tool errors rendered with red styling
  - [ ] Existing SDLC UI tests still pass

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Tool calls visible in SDLC agent output
    Tool: Playwright (playwright skill)
    Preconditions: SDLC workflow running with tool-capable AI, MCP server connected
    Steps:
      1. Start SDLC workflow
      2. Wait for agent output to stream
      3. Assert: tool call card appears with "🔧 Called tool: srv-1/echo.ping"
      4. Click to expand tool call card
      5. Assert: args JSON and result content visible
      6. Assert: tool result is followed by more AI output (AI processed the result)
    Expected Result: Tool calls visible and interactive in UI
    Failure Indicators: Tool calls not rendered, collapse not working, result not showing
    Evidence: .sisyphus/evidence/task-25-sdlc-tool-rendering.png
  ```

  **Commit**: YES (groups with Wave 5)
  - Message: `feat(world): render MCP tool calls in SDLC agent output`

- [x] 26. SDLC tool-loop integration tests + Phase 3 QA

  **What to do**:
  - Write comprehensive tests for Phase 3 (SDLC Agent Tool Loop):
    - `backend-ts/tests/integration/world-sdlc-tool-loop.test.ts`:
      - Mock AI response with valid `<tool_call>` markers → tool invoked
      - Mock AI response with malformed markers → graceful degradation
      - Mock AI response with multiple tool calls → all invoked sequentially
      - Max 3 rounds enforced → loop terminates
      - Tool execution error → error injected, AI continues
      - No connected servers → no tool injection, normal SDLC flow
      - SSE events emitted correctly for tool calls
    - Frontend: `frontend/test/world-sdlc.test.tsx`:
      - Tool call events rendered correctly in SdlcPanel
      - Expand/collapse works
      - Error styling applied for failed tools

  **Must NOT do**:
  - Do NOT test with real LLM API — use mocked `streamAI`/`callAI`
  - Do NOT skip edge cases (malformed markers, concurrent calls, timeout)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Complex test scenarios for tool-call loop with mock AI output and multiple edge cases
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with Tasks 23, 24, 25)
  - **Blocks**: F1, F2, F3, F4
  - **Blocked By**: Tasks 11 (test setup), 24 (tool loop), 25 (UI rendering)

  **References**:
  - `backend-ts/tests/integration/_setup.ts` — mock AI dispatcher (override mock responses per test)
  - `backend-ts/tests/integration/world-mcp-server.test.ts` — Phase 2 test patterns from Task 22
  - `backend-ts/src/routers/sdlc.router.ts` — SSE event types for assertions

  **Acceptance Criteria**:
  - [ ] Backend: 10+ test cases covering tool-call loop, error handling, max rounds
  - [ ] Frontend: 5+ test cases covering tool call rendering
  - [ ] All tests pass with zero regressions
  - [ ] Test with no MCP servers connected — SDLC works normally

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Full Phase 3 test suite passes
    Tool: Bash (pnpm test + npm test)
    Preconditions: Phase 3 code implemented
    Steps:
      1. cd backend-ts && pnpm test -- tests/integration/world-sdlc-tool-loop
      2. Assert: all tool-loop tests pass
      3. cd frontend && npm test -- world-sdlc
      4. Assert: all rendering tests pass
      5. Full suite: backend-ts && pnpm test && cd ../frontend && npm test
      6. Assert: zero regressions, exit code 0
    Expected Result: Green test suite with tool-loop coverage
    Failure Indicators: Test failures, timeouts, regressions in non-world tests
    Evidence: .sisyphus/evidence/task-26-phase3-tests.txt
  ```

  **Commit**: YES (groups with Wave 5)
  - Message: `test(world): add SDLC tool-loop integration tests for Phase 3`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [x] F1. **Plan Compliance Audit** — `oracle` — APPROVED
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high` — APPROVED
  Run `pnpm tsc --noEmit` in backend-ts + `npx tsc --noEmit` in frontend + `pnpm test` in both. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp). Verify no modification to `ai/dispatcher.ts`.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high` — APPROVED (9/9 scenarios)
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration: connect MCP server → list tools → invoke from chat → see result → verify MCP server exposes same tools. Test edge cases: empty state (no servers), invalid transport (broken server), concurrent tool calls, rapid connect/disconnect, bearer token rejection.
  Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep` — APPROVED (26/26 compliant)
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination: Task N touching Task M's files. Flag unaccounted changes (especially `ai/dispatcher.ts` or new state libraries).
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

Group commits by wave for clean history:
- **Wave 1**: `feat(world): add DB schema, migrations, schemas, and guards for Yummy World`
- **Wave 2**: `feat(world): add MCP client service, server registry, and world router`
- **Wave 3**: `feat(world): add WorldPanel UI, /tool slash command, and integration tests`
- **Wave 4**: `feat(world): add MCP server endpoint with bearer token auth`
- **Wave 5**: `feat(world): add SDLC agent tool-call loop`

---

## Success Criteria

### Verification Commands
```bash
# Backend: all tests pass
cd backend-ts && pnpm test

# Frontend: all tests pass
cd frontend && npm test

# Migration works on fresh DB
cd backend-ts && rm -f data/yummy.db && pnpm db:migrate

# MCP server responds to initialize
curl -s -X POST http://localhost:8000/world/mcp \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
# Expected: JSON-RPC response with serverInfo

# MCP server lists tools
curl -s -X POST http://localhost:8000/world/mcp \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
# Expected: { tools: [...] } with Yummy SDLC tools

# Bearer token rejection
curl -s -X POST http://localhost:8000/world/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{...}}'
# Expected: 401 or JSON-RPC error
```

### Final Checklist
- [ ] All "Must Have" present — verified by F1
- [ ] All "Must NOT Have" absent — verified by F1 + F4
- [ ] All 5 AI providers still work (regression) — verified by F3
- [ ] All tests pass — verified by F2
- [ ] Migration applies cleanly — verified by F3
- [ ] All QA scenarios pass — verified by F3
- [ ] User explicitly approves — wait for user "okay" after F1-F4 report
