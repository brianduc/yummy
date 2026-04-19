/**
 * yummy-mcp-server — Exposes all yummy backend services as MCP Tools/Resources/Prompts
 * Compatible with: YummyCode, Claude Code, Cursor, VS Code, JetBrains, Neovim
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";

const YUMMY_API = process.env.YUMMY_API_URL || "http://localhost:8000";
const API_KEY   = process.env.MCP_INTERNAL_KEY || "";

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${YUMMY_API}/api/v1${path}`, {
    method,
    headers: { "Content-Type": "application/json", "X-MCP-Key": API_KEY },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

const server = new McpServer({ name: "yummy-mcp-server", version: "1.0.0" });

// ── SPRINT / AGILE TOOLS ──
server.tool("get_current_sprint", "Get current sprint data, tasks, velocity",
  { projectId: z.string() },
  async ({ projectId }) => {
    const data = await api("GET", `/sprint?project=${projectId}`);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

server.tool("create_user_story", "Create a new user story with AI-generated acceptance criteria",
  { title: z.string(), description: z.string(), projectId: z.string() },
  async (args) => {
    const data = await api("POST", "/sprint/stories", args);
    return { content: [{ type: "text", text: `✅ Story created: ${data.id}` }] };
  }
);

server.tool("generate_prd", "Generate a full Product Requirements Document",
  { request: z.string(), projectId: z.string().optional() },
  async ({ request, projectId }) => {
    const data = await api("POST", "/agents/po/prd", { request, projectId });
    return { content: [{ type: "text", text: data.prd }] };
  }
);

// ── CODE REVIEW TOOLS ──
server.tool("review_pull_request", "AI code review for a GitHub Pull Request",
  { repo: z.string(), prNumber: z.number(), focus: z.array(z.string()).optional() },
  async (args) => {
    const data = await api("POST", "/review/pr", args);
    return { content: [{ type: "text", text: data.review }] };
  }
);

server.tool("review_code", "Review a code snippet for quality, bugs, performance",
  { code: z.string(), language: z.string(), context: z.string().optional() },
  async (args) => {
    const data = await api("POST", "/review/snippet", args);
    return { content: [{ type: "text", text: data.review }] };
  }
);

// ── SECURITY TOOLS ──
server.tool("scan_security", "Scan code for OWASP Top 10 vulnerabilities and secrets",
  { code: z.string(), language: z.string().default("unknown") },
  async (args) => {
    const data = await api("POST", "/security/scan", args);
    return { content: [{ type: "text", text: data.findings }] };
  }
);

server.tool("audit_dependencies", "Check dependencies for known CVEs",
  { dependencies: z.array(z.string()), ecosystem: z.enum(["npm","pip","maven","cargo"]) },
  async (args) => {
    const data = await api("POST", "/security/audit-deps", args);
    return { content: [{ type: "text", text: JSON.stringify(data.vulnerabilities, null, 2) }] };
  }
);

// ── TESTING TOOLS ──
server.tool("generate_tests", "Generate unit or E2E tests for code",
  { code: z.string(), language: z.string(), framework: z.string(), testType: z.enum(["unit","integration","e2e"]).default("unit") },
  async (args) => {
    const data = await api("POST", "/qa/generate", args);
    return { content: [{ type: "text", text: data.tests }] };
  }
);

// ── DOCUMENTATION TOOLS ──
server.tool("generate_docs", "Generate API docs, README, or changelog",
  { source: z.string(), type: z.enum(["api","readme","changelog","onboarding"]) },
  async (args) => {
    const data = await api("POST", "/docs-gen/generate", args);
    return { content: [{ type: "text", text: data.content }] };
  }
);

// ── MCP RESOURCES ──
server.resource("sprint-context", "yummy://sprint/current",
  async (uri) => {
    const data = await api("GET", "/sprint?project=default");
    return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(data) }] };
  }
);

// ── MCP PROMPTS ──
server.prompt("full-pr-review", "Complete PR review: code + security + tests",
  [{ name: "pr_number", required: true }, { name: "repo", required: true }],
  async ({ pr_number, repo }) => ({
    messages: [{ role: "user", content: { type: "text",
      text: `Review PR #${pr_number} in ${repo}. Use tools: review_pull_request, scan_security. Give verdict: Approve/Request Changes/Block with reasoning.`
    }}]
  })
);

// ── START ──
async function main() {
  const mode = process.env.MCP_TRANSPORT || "stdio";
  if (mode === "sse") {
    const port = Number(process.env.PORT || 3100);
    const { createServer } = await import("node:http");
    const transports: Record<string, SSEServerTransport> = {};
    const httpServer = createServer(async (req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
      if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
      if (req.url === "/mcp") {
        const t = new SSEServerTransport("/mcp/messages", res);
        transports[t.sessionId] = t;
        await server.connect(t);
        return;
      }
      if (req.url?.startsWith("/mcp/messages")) {
        const id = new URL(req.url, "http://x").searchParams.get("sessionId") || "";
        if (transports[id]) { await transports[id].handlePostMessage(req, res); return; }
      }
      if (req.url === "/health") { res.writeHead(200); res.end('{"status":"ok","name":"yummy-mcp-server"}'); return; }
      res.writeHead(404); res.end("Not found");
    });
    httpServer.listen(port, () => console.error(`yummy-mcp-server SSE on :${port}`));
  } else {
    const t = new StdioServerTransport();
    await server.connect(t);
    console.error("yummy-mcp-server stdio mode");
  }
}
main().catch(console.error);
