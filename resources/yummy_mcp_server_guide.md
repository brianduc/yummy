# yummy-mcp-server — Turn the backend into an MCP Server
## Technical guide: REST API → Model Context Protocol

---

## Why do this?

When `yummy-mcp-server` exposes all business logic via MCP:

```
BEFORE (without MCP):
Developer → Claude Code → only sees the filesystem
Developer → VS Code → no shared context from Jira/Sprint/Codebase
Developer → each tool is isolated

AFTER (with yummy-mcp-server):
Developer → ANY IDE → can use everything:
  - Sprint data from yummy-scrum
  - Code review from yummy-review
  - Security scan from yummy-guard
  - Docs from yummy-docs
  - Business context from yummy-po / yummy-ba
```

---

## Architecture: yummy-mcp-server

```
┌─────────────────────────────────────────────┐
│            yummy-mcp-server                  │
│                                              │
│  MCP Protocol Layer                          │
│  ├── Tools    → wrap REST endpoints          │
│  ├── Resources → expose read-only context    │
│  └── Prompts  → pre-built workflows          │
│                                              │
│  Transport Layer                             │
│  ├── stdio (local dev: YummyCode, Claude)    │
│  └── HTTP/SSE (team: Cursor, VS Code, JB)    │
│                                              │
│  Auth Layer: OAuth2 / JWT                    │
└──────────────────┬──────────────────────────┘
                   │ HTTP/gRPC
    ┌──────────────▼──────────────┐
    │     yummy Backend APIs      │
    │  (FastAPI / Express / Go)   │
    └─────────────────────────────┘
```

---

## Implementation: TypeScript (Bun)

### 1. Project setup

```bash
mkdir yummy-mcp-server && cd yummy-mcp-server
bun init -y
bun add @modelcontextprotocol/sdk zod
```

### 2. Main file: `src/server.ts`

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";

const YUMMY_API = process.env.YUMMY_API_URL || "http://localhost:8000";
const API_KEY   = process.env.YUMMY_INTERNAL_KEY || "";

// ─────────────────────────────────────────────────
// Helper: call yummy backend
// ─────────────────────────────────────────────────
async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${YUMMY_API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Yummy-Key": API_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Yummy API ${path}: ${res.status}`);
  return res.json();
}

// ─────────────────────────────────────────────────
// Create MCP Server
// ─────────────────────────────────────────────────
const server = new McpServer({
  name: "yummy-mcp-server",
  version: "1.0.0",
});

// ═══════════════════════════════════════
// MCP TOOLS — wrap REST endpoints
// ═══════════════════════════════════════

// --- Sprint tools (yummy-scrum) ---
server.tool(
  "get_current_sprint",
  "Get current sprint info: tasks, velocity, burndown",
  { projectId: z.string().describe("Project ID") },
  async ({ projectId }) => {
    const data = await api("GET", `/api/scrum/sprint/current?project=${projectId}`);
    return {
      content: [{
        type: "text",
        text: JSON.stringify(data, null, 2),
      }],
    };
  }
);

server.tool(
  "create_user_story",
  "Create a new user story in the backlog",
  {
    title:       z.string().describe("Tiêu đề user story"),
    description: z.string().describe("Mô tả chi tiết"),
    acceptance:  z.array(z.string()).describe("Acceptance criteria list"),
    storyPoints: z.number().optional().describe("Story points ước tính"),
    projectId:   z.string(),
  },
  async (args) => {
    const data = await api("POST", "/api/po/stories", args);
    return {
      content: [{ type: "text", text: `✅ User story created: ${data.id} — ${data.url}` }],
    };
  }
);

server.tool(
  "get_sprint_burndown",
  "Lấy dữ liệu burndown chart của sprint hiện tại",
  { projectId: z.string(), sprintId: z.string().optional() },
  async ({ projectId, sprintId }) => {
    const q = sprintId ? `&sprintId=${sprintId}` : "";
    const data = await api("GET", `/api/scrum/burndown?project=${projectId}${q}`);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  }
);

// --- Code Review tools (yummy-review) ---
server.tool(
  "review_pull_request",
  "AI review một pull request: code quality, bugs, performance",
  {
    prNumber: z.number().describe("Pull request number"),
    repo:     z.string().describe("owner/repo format"),
    focus:    z.array(z.enum(["security","performance","tests","style","logic"])).optional(),
  },
  async ({ prNumber, repo, focus }) => {
    const data = await api("POST", "/api/review/pr", { prNumber, repo, focus });
    return {
      content: [{ type: "text", text: data.review }],
    };
  }
);

server.tool(
  "review_code_snippet",
  "Review một đoạn code cụ thể",
  {
    code:     z.string().describe("Đoạn code cần review"),
    language: z.string().describe("Ngôn ngữ lập trình"),
    context:  z.string().optional().describe("Context bổ sung"),
  },
  async (args) => {
    const data = await api("POST", "/api/review/snippet", args);
    return {
      content: [{ type: "text", text: data.review }],
    };
  }
);

// --- Security tools (yummy-guard) ---
server.tool(
  "scan_for_vulnerabilities",
  "Scan code hoặc PR tìm security vulnerabilities (OWASP Top 10)",
  {
    target: z.union([
      z.object({ type: z.literal("pr"), prNumber: z.number(), repo: z.string() }),
      z.object({ type: z.literal("code"), code: z.string(), language: z.string() }),
      z.object({ type: z.literal("file"), filePath: z.string() }),
    ]),
    severity: z.enum(["all","high_critical","critical_only"]).default("all"),
  },
  async ({ target, severity }) => {
    const data = await api("POST", "/api/guard/scan", { target, severity });
    return {
      content: [{ type: "text", text: JSON.stringify(data.findings, null, 2) }],
    };
  }
);

server.tool(
  "check_secrets_in_code",
  "Phát hiện secrets/credentials bị hardcode trong code",
  { code: z.string(), filePath: z.string().optional() },
  async (args) => {
    const data = await api("POST", "/api/guard/secrets", args);
    return {
      content: [{
        type: "text",
        text: data.found.length === 0
          ? "✅ Không tìm thấy hardcoded secrets"
          : `⚠️ Phát hiện ${data.found.length} potential secrets:\n${JSON.stringify(data.found, null, 2)}`,
      }],
    };
  }
);

// --- Documentation tools (yummy-docs) ---
server.tool(
  "generate_documentation",
  "Sinh documentation từ source code (API docs, README, changelog)",
  {
    type:   z.enum(["api_docs","readme","changelog","onboarding"]),
    source: z.string().describe("File path hoặc module name"),
    format: z.enum(["markdown","html","confluence"]).default("markdown"),
  },
  async (args) => {
    const data = await api("POST", "/api/docs/generate", args);
    return {
      content: [{ type: "text", text: data.content }],
    };
  }
);

// --- BA tools (yummy-ba) ---
server.tool(
  "analyze_requirements",
  "Phân tích user story → sinh use cases, sequence diagram, API contract",
  {
    userStory: z.string().describe("User story text"),
    outputType: z.array(z.enum(["use_cases","sequence_diagram","api_contract","test_scenarios"])),
  },
  async (args) => {
    const data = await api("POST", "/api/ba/analyze", args);
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  }
);

// --- QA tools (yummy-qa) ---
server.tool(
  "generate_tests",
  "Sinh unit tests hoặc E2E test scenarios",
  {
    code:       z.string().optional().describe("Source code cần sinh test"),
    filePath:   z.string().optional().describe("File path trong repo"),
    testType:   z.enum(["unit","integration","e2e"]),
    framework:  z.string().describe("Test framework: jest, vitest, pytest, go-testing..."),
    coverage:   z.enum(["basic","full","mutation"]).default("full"),
  },
  async (args) => {
    const data = await api("POST", "/api/qa/generate", args);
    return {
      content: [{ type: "text", text: data.tests }],
    };
  }
);

// ═══════════════════════════════════════
// MCP RESOURCES — read-only context
// ═══════════════════════════════════════

server.resource(
  "codebase-index",
  "yummy://codebase/index",
  async (uri) => {
    const data = await api("GET", "/api/memory/codebase-summary");
    return {
      contents: [{
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(data),
      }],
    };
  }
);

server.resource(
  "architecture-decisions",
  "yummy://adr/list",
  async (uri) => {
    const data = await api("GET", "/api/memory/adrs");
    return {
      contents: [{
        uri: uri.href,
        mimeType: "text/markdown",
        text: data.adrs.map((a: any) => `# ${a.title}\n${a.content}`).join("\n\n---\n\n"),
      }],
    };
  }
);

server.resource(
  "current-sprint",
  "yummy://sprint/current",
  async (uri) => {
    const data = await api("GET", "/api/scrum/sprint/current?project=yummy");
    return {
      contents: [{
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(data),
      }],
    };
  }
);

// ═══════════════════════════════════════
// MCP PROMPTS — pre-built workflows
// ═══════════════════════════════════════

server.prompt(
  "pr-review-full",
  "Full PR review: code quality + security + test coverage",
  [
    { name: "pr_number", description: "PR number", required: true },
    { name: "repo",      description: "owner/repo", required: true },
  ],
  async ({ pr_number, repo }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Review PR #${pr_number} trong repo ${repo}. 
Hãy dùng các tools: review_pull_request, scan_for_vulnerabilities, check_secrets_in_code.
Sau đó đưa ra tổng kết: 
1. Overall assessment (Approve / Request Changes / Block)
2. Critical issues (must fix)
3. Suggestions (nice to have)
4. Security findings`,
      },
    }],
  })
);

server.prompt(
  "sprint-planning-assist",
  "Hỗ trợ sprint planning: analyze backlog, suggest sprint goal",
  [{ name: "project_id", description: "Project ID", required: true }],
  async ({ project_id }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Hỗ trợ sprint planning cho project ${project_id}.
Dùng tools: get_current_sprint, get_sprint_burndown.
Phân tích:
1. Velocity 3 sprint gần nhất
2. Backlog items nên vào sprint tiếp theo
3. Capacity vs demand
4. Sprint goal đề xuất`,
      },
    }],
  })
);

// ═══════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════

async function main() {
  const mode = process.env.MCP_TRANSPORT || "stdio";

  if (mode === "sse") {
    // HTTP/SSE mode cho team server (VS Code, Cursor, JetBrains)
    const port = Number(process.env.PORT || 3000);
    const { createServer } = await import("http");
    const transports: Record<string, SSEServerTransport> = {};

    const httpServer = createServer(async (req, res) => {
      // CORS for IDE clients
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");

      if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

      if (req.url === "/mcp") {
        const transport = new SSEServerTransport("/mcp/messages", res);
        transports[transport.sessionId] = transport;
        await server.connect(transport);
        return;
      }

      if (req.url?.startsWith("/mcp/messages")) {
        const sessionId = new URL(req.url, "http://x").searchParams.get("sessionId") || "";
        const transport = transports[sessionId];
        if (transport) { await transport.handlePostMessage(req, res); return; }
      }

      if (req.url === "/health") {
        res.writeHead(200); res.end(JSON.stringify({ status: "ok", name: "yummy-mcp-server" })); return;
      }

      res.writeHead(404); res.end("Not found");
    });

    httpServer.listen(port, () => {
      console.error(`yummy-mcp-server running on :${port} (SSE mode)`);
      console.error(`Connect: http://localhost:${port}/mcp`);
    });
  } else {
    // stdio mode cho local dev (YummyCode, Claude Code)
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("yummy-mcp-server running in stdio mode");
  }
}

main().catch(console.error);
```

### 3. `package.json`

```json
{
  "name": "yummy-mcp-server",
  "version": "1.0.0",
  "scripts": {
    "dev":   "bun run --watch src/server.ts",
    "start": "bun run src/server.ts",
    "build": "bun build src/server.ts --compile --outfile dist/yummy-mcp-server"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.22.0"
  }
}
```

---

## Kết nối từ các IDEs

### YummyCode (stdio — preferred, local)
```json
// ~/.yummycode/config.json
{
  "mcp": {
    "servers": {
      "yummy": {
        "type": "stdio",
        "command": "yummy-mcp-server",
        "env": {
          "YUMMY_API_URL": "http://localhost:8000",
          "YUMMY_INTERNAL_KEY": "${YUMMY_KEY}"
        }
      }
    }
  }
}
```

### Claude Code (1 lệnh)
```bash
claude mcp add yummy \
  --url http://yummy-server.internal:3000/mcp \
  --header "Authorization: Bearer $YUMMY_KEY"
```

### Cursor
```json
// .cursor/mcp.json (trong project root)
{
  "mcpServers": {
    "yummy": {
      "url": "http://yummy-server.internal:3000/mcp",
      "headers": { "Authorization": "Bearer ${YUMMY_KEY}" }
    }
  }
}
```

### VS Code (settings.json)
```json
{
  "mcp.servers": {
    "yummy": {
      "type": "sse",
      "url": "http://yummy-server.internal:3000/mcp",
      "headers": { "Authorization": "Bearer ${env:YUMMY_KEY}" }
    }
  }
}
```

### JetBrains (AI Assistant settings)
```
Settings → AI Assistant → MCP Servers → Add
URL: http://yummy-server.internal:3000/mcp
Auth: Bearer token
```

---

## Deployment: Docker Compose

```yaml
# docker-compose.yml
version: "3.9"
services:
  yummy-mcp-server:
    build: ./yummy-mcp-server
    ports:
      - "3000:3000"
    environment:
      MCP_TRANSPORT: sse
      YUMMY_API_URL: http://yummy-backend:8000
      YUMMY_INTERNAL_KEY: ${YUMMY_INTERNAL_KEY}
    depends_on:
      - yummy-backend
    restart: unless-stopped

  yummy-backend:
    build: ./yummy-backend
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://postgres:pass@db:5432/yummy
    depends_on:
      - db

  db:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: yummy
      POSTGRES_PASSWORD: pass
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

---

## Tool mapping: Yummy backend API → MCP Tools

| REST Endpoint | MCP Tool Name | IDE hiển thị |
|---|---|---|
| GET /api/scrum/sprint/current | `get_current_sprint` | "Get current sprint" |
| POST /api/po/stories | `create_user_story` | "Create user story" |
| POST /api/review/pr | `review_pull_request` | "Review PR" |
| POST /api/guard/scan | `scan_for_vulnerabilities` | "Scan vulnerabilities" |
| POST /api/guard/secrets | `check_secrets_in_code` | "Check secrets" |
| POST /api/docs/generate | `generate_documentation` | "Generate docs" |
| POST /api/ba/analyze | `analyze_requirements` | "Analyze requirements" |
| POST /api/qa/generate | `generate_tests` | "Generate tests" |
| GET /api/memory/codebase-summary | Resource: `yummy://codebase/index` | (context injected) |
| GET /api/memory/adrs | Resource: `yummy://adr/list` | (context injected) |

---

*yummy-mcp-server — biến toàn bộ Yummy platform thành AI-native context cho mọi IDE.*
