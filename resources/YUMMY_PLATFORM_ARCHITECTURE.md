# Yummy Platform — Full Architecture (Reference)

## AI-Powered Multi-Agent SDLC Platform

> **Note:** This document is a reference/vision document. The current repo implements only a subset.
>
> - The repo structure: `backend/` + `frontend/`
> - The platform goal: bridge business ↔ technical teams via multi-agent collaboration
> - MCP as the IDE-agnostic integration layer

---

## 1. High-level architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          PERSONAS / ROLES                           │
│  [ PO ] [ BA ] [ Scrum Master ] [ Developer ] [ QA/QC ] [ DevOps ] │
└─────────────────────────┬───────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────────┐
│                  CLIENT / IDE LAYER                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────────┐  │
│  │  YummyCode ✓     │  │  Yummy Web Portal│  │  IDE / MCP Client │  │
│  │  Self-hosted     │  │  Sprint · Docs   │  │  (AGNOSTIC)       │  │
│  │  TUI + Web       │  │  Dashboard       │  │  VS Code · Cursor │  │
│  │  Single binary   │  │  Business users  │  │  JetBrains · Any  │  │
│  └──────────────────┘  └──────────────────┘  └───────────────────┘  │
└─────────────────────────┬───────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────────┐
│                        yummy-hub                                     │
│         API Gateway · Auth (SSO/LDAP) · Routing · Rate Limit         │
│              Audit Log → SIEM · Session Management                   │
└─────────────────────────┬───────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────────┐
│                   AI AGENT MESH                                      │
│  ── Business Side ──────────────────────────────────────────────    │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────────┐    │
│  │  yummy-po   │  │  yummy-ba   │  │      yummy-scrum          │    │
│  │  PO Agent   │  │  BA Agent   │  │   Scrum Master Agent      │    │
│  │  Backlog    │  │  BRD / FRD  │  │   Sprint · Retro · KPI    │    │
│  │  Stories    │  │  Gap Analy. │  │   Velocity · Standup      │    │
│  └─────────────┘  └─────────────┘  └──────────────────────────┘    │
│  ── Technical Side ─────────────────────────────────────────────    │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────────┐    │
│  │  yummy-dev  │  │  yummy-qa   │  │      yummy-guard          │    │
│  │  Dev Agent  │  │  QA Agent   │  │   Security Agent          │    │
│  │  Code gen   │  │  Test gen   │  │   CVE · Secret scan       │    │
│  │  PR review  │  │  Coverage   │  │   Policy · Prompt guard   │    │
│  └─────────────┘  └─────────────┘  └──────────────────────────┘    │
└─────────────────────────┬───────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────────┐
│              yummy-mcp  ←─── KEY INTEGRATION POINT                  │
│         MCP Server · Expose backend as MCP Tools/Resources           │
│    create_story · plan_sprint · review_pr · scan_security · ...      │
│    → Any MCP-capable IDE can use Yummy — no custom plugin required  │
└─────────────────────────┬───────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────────┐
│                 CORE BACKEND SERVICES                                │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐    │
│  │  yummy-core  │  │  yummy-rag   │  │     yummy-collab        │    │
│  │  FastAPI     │  │  RAG Engine  │  │     WebSocket           │    │
│  │  REST API    │  │  pgvector    │  │     Realtime notify     │    │
│  │  Orchestrate │  │  Embeddings  │  │     Shared sessions     │    │
│  └──────────────┘  └──────────────┘  └────────────────────────┘    │
└─────────────────────────┬───────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                                     │
│  ┌──────────────┐  ┌────────────────────┐  ┌──────────────────┐    │
│  │  PostgreSQL  │  │  pgvector/ChromaDB  │  │     Redis        │    │
│  │  Structured  │  │  Code embeddings   │  │  Cache · Queue   │    │
│  │  Sessions    │  │  Doc embeddings    │  │  Pub/Sub         │    │
│  └──────────────┘  └────────────────────┘  └──────────────────┘    │
└─────────────────────────┬───────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────────┐
│                   EXTERNAL INTEGRATIONS                              │
│  [ GitHub ] [ CI/CD: Actions/Jenkins ] [ Slack/Teams ] [ Jira/Linear]│
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Components and use cases

### 2.1 yummy-po — Product Owner Agent

**Role in SDLC:** Generate and manage backlog from business requirements to GitHub Issues


| Use Case               | Description                                                                  |
| ---------------------- | ---------------------------------------------------------------------------- |
| Generate user stories  | Convert business requirements → INVEST user stories with acceptance criteria |
| Prioritize backlog     | Suggest priority based on value + effort estimate                            |
| Link story → Issue     | Create GitHub Issues from approved user stories                              |
| Generate release notes | Summarize release notes from merged PRs per sprint                           |
| Track completion       | Track % completion per sprint                                                |


**MCP Tools exposed:**

- `create_user_story(requirement, context)` → returns structured story
- `prioritize_backlog(stories[])` → returns ordered list with rationale
- `generate_release_notes(sprint_id)` → returns markdown release notes

---

### 2.2 yummy-ba — Business Analyst Agent

**Role in SDLC:** Bridge requirements ↔ implementation, find gaps


| Use Case                   | Mô tả                                              |
| -------------------------- | -------------------------------------------------- |
| Analyze codebase → BRD     | Đọc toàn bộ code → sinh BRD có cấu trúc            |
| Map API → business process | Liên kết endpoint với nghiệp vụ tương ứng          |
| Gap analysis               | So sánh spec đã viết vs code thực tế → liệt kê gap |
| Generate sequence diagram  | Từ code flow → Mermaid sequence diagram            |
| Test scenario từ rules     | Chuyển business rules thành test scenario cho QA   |


**MCP Tools exposed:**

- `analyze_codebase_to_brd(repo_path)` → returns BRD document
- `find_implementation_gaps(spec_doc, codebase)` → returns gap report
- `generate_sequence_diagram(feature_name)` → returns Mermaid syntax

---

### 2.3 yummy-scrum — Scrum Master Agent

**Vai trò trong SDLC:** Automated agile ceremonies và team health monitoring


| Use Case                | Mô tả                                                 |
| ----------------------- | ----------------------------------------------------- |
| Sprint planning support | Estimate story points dựa trên historical commit data |
| Burndown auto-report    | Sinh burndown chart và velocity mỗi cuối sprint       |
| Retrospective summary   | Tóm tắt retro → action items có assignee              |
| Daily standup digest    | Push digest lên Slack mỗi sáng: ai làm gì, blocker gì |
| Blocker detection       | PR chờ review >2 ngày → auto-alert SM và assignee     |


**MCP Tools exposed:**

- `plan_sprint(backlog, team_capacity)` → sprint plan with estimates
- `generate_standup_digest(team_id, date)` → standup summary
- `detect_blockers(sprint_id)` → list of blockers with context

---

### 2.4 yummy-dev — Developer Agent (= YummyCode embedded)

**Vai trò trong SDLC:** AI pair programmer với full codebase context


| Use Case        | Mô tả                                                  |
| --------------- | ------------------------------------------------------ |
| Code generation | Generate code với context từ user story + codebase RAG |
| PR review       | Review PR: convention, security, coverage, logic       |
| Refactoring     | Refactor với đảm bảo test coverage trước và sau        |
| Onboarding      | Giải thích codebase cho dev mới bằng ngôn ngữ tự nhiên |
| Test writing    | Viết unit test từ acceptance criteria                  |


**Deployment modes:**

- Self-hosted: YummyCode binary (TUI + Web UI)
- Via MCP: bất kỳ IDE nào kết nối yummy-mcp

**MCP Tools exposed:**

- `review_pr(pr_number, context)` → detailed review comment
- `generate_code(requirement, context)` → code with explanation
- `explain_codebase(question)` → contextual answer with file refs

---

### 2.5 yummy-qa — QA Agent

**Vai trò trong SDLC:** Automated test generation và quality tracking


| Use Case             | Mô tả                                               |
| -------------------- | --------------------------------------------------- |
| Test case generation | Sinh test case từ acceptance criteria               |
| Coverage gap check   | Kiểm tra coverage gap trên mỗi PR → comment tự động |
| E2E script           | Tạo Playwright/Cypress script từ user flow mô tả    |
| Quality metrics      | Track coverage%, bug rate, MTTR theo sprint         |
| Test data generator  | Sinh test data, mock và fixture cho mọi scenario    |


**MCP Tools exposed:**

- `generate_test_cases(user_story)` → test cases in markdown
- `check_coverage_gaps(pr_diff)` → coverage analysis report
- `generate_e2e_script(flow_description, framework)` → Playwright/Cypress code

---

### 2.6 yummy-guard — Security & Compliance Agent

**Vai trò trong SDLC:** DevSecOps automation và AI prompt safety


| Use Case              | Mô tả                                               |
| --------------------- | --------------------------------------------------- |
| Secret scanning       | Quét hardcoded credential trước khi merge           |
| CVE check             | Kiểm tra dependency CVEs → tạo PR update nếu safe   |
| Policy enforcement    | Enforce deny-list bash commands trong YummyCode     |
| Security audit report | Sinh audit report mỗi release cycle                 |
| Prompt guard          | Kiểm soát AI prompt: chặn PII và IP leak qua AI API |


**MCP Tools exposed:**

- `scan_secrets(codebase_path)` → list of detected secrets with file:line
- `audit_dependencies(package_json)` → CVE report with severity
- `check_prompt_safety(prompt_text)` → safety analysis + redaction

---

### 2.7 yummy-hub — API Gateway & Orchestrator

**Responsibilities:**

- Xác thực: SSO/LDAP, JWT, API key cho external IDEs
- Routing: `/agent/po` → yummy-po, `/agent/dev` → yummy-dev
- Rate limiting và quota per user/team/agent
- Audit log toàn bộ → SIEM (Splunk/ELK)
- Multi-agent session state management

**Tech stack gợi ý:** FastAPI + nginx / Traefik / Kong Gateway

---

### 2.8 yummy-mcp — MCP Server *(ĐIỂM THEN CHỐT)*

Đây là layer quan trọng nhất về mặt tích hợp IDE. Xem Section 4 bên dưới.

---

### 2.9 yummy-core — Core Backend API

**Responsibilities:**

- REST API đầy đủ: `/stories`, `/sprints`, `/sessions`, `/agents`, `/docs`
- Orchestrate multi-agent flow: PO → BA → Dev → QA
- GitHub webhook receiver: push, PR, issue events
- Background job queue (ARQ/Celery) cho async tasks
- File system access control

---

### 2.10 yummy-rag — RAG Engine

**Responsibilities:**

- Re-index codebase mỗi khi có git push (via webhook)
- Semantic search trên code, docs, meeting notes
- Cung cấp top-k context chunk cho mỗi agent prompt
- Index Confluence/Notion docs tự động

**Tech stack:** pgvector + SQLAlchemy, hoặc ChromaDB standalone

---

### 2.11 yummy-collab — Realtime Collaboration

**Responsibilities:**

- WebSocket server: nhiều user cùng xem AI session realtime
- Push notification khi agent hoàn thành task
- Activity feed cho toàn team
- Standup digest → Slack/Teams webhook
- Team knowledge base với AI-generated decisions

---

## 3. IDE Integration — Agnostic via MCP

### 3.1 Chiến lược

```
Nếu self-host YummyCode thành công:
  → Developer dùng YummyCode TUI/Web trực tiếp
  → YummyCode kết nối với yummy-mcp để dùng toàn bộ Yummy agents

Nếu developer thích IDE quen thuộc:
  → Configure IDE để kết nối yummy-mcp qua MCP protocol
  → KHÔNG cần plugin riêng — MCP là chuẩn mở
```

### 3.2 Cấu hình từng IDE

**VS Code + Continue.dev:**

```json
// ~/.continue/config.json
{
  "models": [],
  "contextProviders": [
    {
      "name": "mcp",
      "params": {
        "serverUrl": "http://yummycode.internal:4096/mcp",
        "apiKey": "${YUMMY_API_KEY}"
      }
    }
  ]
}
```

**Claude Desktop:**

```json
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "yummy": {
      "type": "sse",
      "url": "http://yummycode.internal:4096/mcp/sse",
      "headers": {
        "Authorization": "Bearer ${YUMMY_API_KEY}"
      }
    }
  }
}
```

**Cursor:**

```json
// .cursor/mcp.json (project root)
{
  "mcpServers": {
    "yummy": {
      "url": "http://yummycode.internal:4096/mcp/sse"
    }
  }
}
```

**JetBrains (AI Assistant plugin):**
Cần custom MCP provider plugin — đang develop hoặc dùng OpenAI-compatible shim của yummy-mcp.

---

## 4. Backend as MCP — Hướng Dẫn Convert

### 4.1 Tại sao convert backend thành MCP?

Khi backend của Yummy expose MCP server:

- Mọi MCP-compatible client đều dùng được Yummy functionality
- Developer không cần REST API docs — IDE hiểu tool tự động
- Context được pass tự động qua MCP protocol
- Một codebase serve cả REST API + MCP endpoint

### 4.2 Architecture MCP Server

```
yummy-mcp
├── tools/           ← MCP Tools (actions, side effects)
│   ├── create_story.py
│   ├── plan_sprint.py
│   ├── review_pr.py
│   ├── scan_security.py
│   └── generate_tests.py
├── resources/       ← MCP Resources (read-only data)
│   ├── codebase.py       → code://src/**
│   ├── docs.py           → docs://specs/**
│   └── stories.py        → yummy://stories/**
├── prompts/         ← MCP Prompt Templates
│   ├── user_story.py     → "Create a user story for..."
│   └── pr_review.py      → "Review this PR considering..."
└── server.py        ← MCP server entry point
```

### 4.3 Implementation: yummy-mcp với Python MCP SDK

```python
# yummy-mcp/server.py
from mcp.server import Server
from mcp.server.sse import SseServerTransport
from mcp.types import Tool, Resource, Prompt, TextContent
import httpx
import json

# Yummy backend URL (internal)
YUMMY_CORE_URL = "http://yummy-core:8000"

app = Server("yummy-mcp")

# ─────────────────────────────────────────
# MCP TOOLS (mỗi Yummy agent action = 1 tool)
# ─────────────────────────────────────────

@app.list_tools()
async def list_tools():
    return [
        Tool(
            name="create_user_story",
            description="Tạo user story từ business requirement. Dùng yummy-po agent.",
            inputSchema={
                "type": "object",
                "properties": {
                    "requirement": {"type": "string", "description": "Mô tả yêu cầu nghiệp vụ"},
                    "context": {"type": "string", "description": "Context bổ sung (optional)"}
                },
                "required": ["requirement"]
            }
        ),
        Tool(
            name="review_pr",
            description="Review Pull Request với context từ codebase. Dùng yummy-dev agent.",
            inputSchema={
                "type": "object",
                "properties": {
                    "pr_number": {"type": "integer", "description": "PR number trên GitHub"},
                    "focus": {"type": "string", "enum": ["security", "performance", "convention", "all"]}
                },
                "required": ["pr_number"]
            }
        ),
        Tool(
            name="plan_sprint",
            description="Lập kế hoạch sprint từ backlog và team capacity. Dùng yummy-scrum agent.",
            inputSchema={
                "type": "object",
                "properties": {
                    "backlog_ids": {"type": "array", "items": {"type": "string"}},
                    "team_capacity": {"type": "integer", "description": "Story points available"}
                },
                "required": ["backlog_ids", "team_capacity"]
            }
        ),
        Tool(
            name="scan_security",
            description="Quét bảo mật codebase: secrets, CVEs, policy violations. Dùng yummy-guard.",
            inputSchema={
                "type": "object",
                "properties": {
                    "target": {"type": "string", "description": "File path hoặc PR number để scan"}
                },
                "required": ["target"]
            }
        ),
        Tool(
            name="generate_tests",
            description="Sinh test cases từ user story hoặc code. Dùng yummy-qa agent.",
            inputSchema={
                "type": "object",
                "properties": {
                    "story_id": {"type": "string"},
                    "framework": {"type": "string", "enum": ["pytest", "jest", "playwright"]}
                }
            }
        ),
        Tool(
            name="analyze_codebase",
            description="Phân tích codebase → sinh BRD/FRD. Dùng yummy-ba agent.",
            inputSchema={
                "type": "object",
                "properties": {
                    "output_format": {"type": "string", "enum": ["brd", "frd", "gap_analysis"]}
                }
            }
        ),
    ]

@app.call_tool()
async def call_tool(name: str, arguments: dict):
    """Route MCP tool call → Yummy backend API"""
    
    endpoint_map = {
        "create_user_story":  "/api/v1/agents/po/create-story",
        "review_pr":          "/api/v1/agents/dev/review-pr",
        "plan_sprint":        "/api/v1/agents/scrum/plan-sprint",
        "scan_security":      "/api/v1/agents/guard/scan",
        "generate_tests":     "/api/v1/agents/qa/generate-tests",
        "analyze_codebase":   "/api/v1/agents/ba/analyze",
    }
    
    if name not in endpoint_map:
        raise ValueError(f"Unknown tool: {name}")
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{YUMMY_CORE_URL}{endpoint_map[name]}",
            json=arguments,
            timeout=120.0  # AI calls take time
        )
        result = response.json()
    
    return [TextContent(type="text", text=result.get("output", str(result)))]


# ─────────────────────────────────────────
# MCP RESOURCES (read-only data exposure)
# ─────────────────────────────────────────

@app.list_resources()
async def list_resources():
    return [
        Resource(
            uri="yummy://stories/backlog",
            name="Product Backlog",
            description="Danh sách user stories hiện tại",
            mimeType="application/json"
        ),
        Resource(
            uri="yummy://docs/brd",
            name="BRD Document",
            description="Business Requirements Document được yummy-ba generate",
            mimeType="text/markdown"
        ),
        Resource(
            uri="yummy://codebase/summary",
            name="Codebase Summary",
            description="Tóm tắt kiến trúc codebase từ yummy-rag",
            mimeType="text/markdown"
        ),
    ]

@app.read_resource()
async def read_resource(uri: str):
    """Fetch resource từ Yummy backend"""
    async with httpx.AsyncClient() as client:
        if "stories/backlog" in uri:
            r = await client.get(f"{YUMMY_CORE_URL}/api/v1/stories?status=backlog")
        elif "docs/brd" in uri:
            r = await client.get(f"{YUMMY_CORE_URL}/api/v1/docs/brd/latest")
        elif "codebase/summary" in uri:
            r = await client.get(f"{YUMMY_CORE_URL}/api/v1/rag/codebase-summary")
        else:
            raise ValueError(f"Unknown resource: {uri}")
    
    return r.text


# ─────────────────────────────────────────
# MCP PROMPTS (reusable prompt templates)
# ─────────────────────────────────────────

@app.list_prompts()
async def list_prompts():
    return [
        Prompt(
            name="user_story_template",
            description="Template để tạo user story chuẩn INVEST cho Yummy project",
            arguments=[
                {"name": "feature", "description": "Tên feature cần tạo story", "required": True}
            ]
        ),
        Prompt(
            name="pr_review_template",
            description="Template review PR với focus vào Yummy coding standards",
            arguments=[
                {"name": "pr_number", "description": "PR number", "required": True}
            ]
        ),
    ]

@app.get_prompt()
async def get_prompt(name: str, arguments: dict):
    if name == "user_story_template":
        return {
            "messages": [{
                "role": "user",
                "content": f"""Tạo user story cho feature: {arguments.get('feature')}

Theo đúng format:
**As a** [user role]
**I want to** [action/goal]
**So that** [benefit/value]

**Acceptance Criteria:**
- Given [context], When [action], Then [outcome]
- (thêm 3-5 criteria)

**Definition of Done:**
- [ ] Unit tests written (coverage > 80%)
- [ ] Code review approved
- [ ] Documentation updated
- [ ] Deployed to staging"""
            }]
        }
    elif name == "pr_review_template":
        pr_num = arguments.get('pr_number')
        return {
            "messages": [{
                "role": "user",
                "content": f"""Review PR #{pr_num} với focus vào:
1. Coding conventions (xem AGENT.md)
2. Security issues (no hardcoded secrets, input validation)
3. Test coverage gaps
4. Performance concerns
5. Business logic correctness vs user story

Cung cấp: Summary, danh sách issues theo severity, suggested fixes."""
            }]
        }


# ─────────────────────────────────────────
# SERVER STARTUP
# ─────────────────────────────────────────

async def main():
    from mcp.server.stdio import stdio_server
    async with stdio_server() as (read_stream, write_stream):
        await app.run(read_stream, write_stream, app.create_initialization_options())

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
```

### 4.4 Expose qua HTTP/SSE (cho IDE remote connection)

```python
# yummy-mcp/http_server.py
from mcp.server.sse import SseServerTransport
from starlette.applications import Starlette
from starlette.routing import Route, Mount
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
import uvicorn
from server import app as mcp_app

transport = SseServerTransport("/mcp/messages")

async def handle_sse(request):
    """SSE endpoint cho IDE connection"""
    # Auth check
    api_key = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not await verify_api_key(api_key):
        return Response("Unauthorized", status_code=401)
    
    async with transport.connect_sse(
        request.scope, request.receive, request._send
    ) as streams:
        await mcp_app.run(*streams, mcp_app.create_initialization_options())

starlette_app = Starlette(
    routes=[
        Route("/mcp/sse", handle_sse),
        Mount("/mcp/messages", app=transport.handle_post_message),
    ],
    middleware=[
        Middleware(CORSMiddleware, allow_origins=["*"])
    ]
)

if __name__ == "__main__":
    uvicorn.run(starlette_app, host="0.0.0.0", port=4096)
```

### 4.5 Mapping: REST API → MCP Tools


| REST Endpoint                           | MCP Tool                       | Agent       |
| --------------------------------------- | ------------------------------ | ----------- |
| `POST /api/v1/agents/po/create-story`   | `create_user_story`            | yummy-po    |
| `POST /api/v1/agents/po/prioritize`     | `prioritize_backlog`           | yummy-po    |
| `POST /api/v1/agents/ba/analyze`        | `analyze_codebase`             | yummy-ba    |
| `POST /api/v1/agents/scrum/plan-sprint` | `plan_sprint`                  | yummy-scrum |
| `POST /api/v1/agents/scrum/standup`     | `generate_standup`             | yummy-scrum |
| `POST /api/v1/agents/dev/review-pr`     | `review_pr`                    | yummy-dev   |
| `POST /api/v1/agents/dev/generate-code` | `generate_code`                | yummy-dev   |
| `POST /api/v1/agents/qa/generate-tests` | `generate_tests`               | yummy-qa    |
| `POST /api/v1/agents/guard/scan`        | `scan_security`                | yummy-guard |
| `GET /api/v1/stories`                   | Resource: `yummy://stories/*`  | —           |
| `GET /api/v1/docs/*`                    | Resource: `yummy://docs/*`     | —           |
| `GET /api/v1/rag/search`                | Resource: `yummy://codebase/*` | —           |


### 4.6 Cài đặt dependencies

```bash
# requirements.txt
mcp>=1.0.0           # MCP Python SDK
httpx>=0.27          # Async HTTP client
starlette>=0.36      # ASGI framework
uvicorn[standard]    # ASGI server
pydantic>=2.0        # Data validation

# Install
pip install -r requirements.txt
```

### 4.7 Docker deployment

```dockerfile
# Dockerfile.mcp
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY yummy-mcp/ .
EXPOSE 4096
CMD ["python", "http_server.py"]
```

```yaml
# docker-compose.yml (thêm vào existing)
services:
  yummy-mcp:
    build:
      context: .
      dockerfile: Dockerfile.mcp
    ports:
      - "4096:4096"
    environment:
      - YUMMY_CORE_URL=http://yummy-core:8000
      - YUMMY_SECRET_KEY=${YUMMY_SECRET_KEY}
    depends_on:
      - yummy-core
```

---

## 5. Luồng Dữ Liệu Chính

### 5.1 Luồng: PO tạo user story → Dev implement

```
PO nhập requirement vào Yummy Web Portal
  → yummy-hub (auth + route)
  → yummy-po agent
    → yummy-rag (lấy context codebase liên quan)
    → LLM generate user story + AC
    → yummy-core lưu vào PostgreSQL
    → yummy-core tạo GitHub Issue (via GitHub API)
  → Yummy Web Portal hiển thị story
  
Developer nhận GitHub Issue notification
  → Mở YummyCode TUI (hoặc IDE + yummy-mcp)
  → Hỏi: "Implement story #42"
  → yummy-dev agent:
    → yummy-rag: lấy relevant code context
    → Generate code với context từ story + codebase
    → Tạo branch, commit, open PR
  → yummy-qa: sinh test cases tự động
  → yummy-guard: scan PR trước khi merge
```

### 5.2 Luồng: IDE agnostic developer (qua MCP)

```
Developer dùng VS Code + Continue.dev
  → Continue.dev configured với yummy-mcp endpoint
  → Dev gõ: "@yummy review this PR"
  → Continue.dev gọi MCP tool: review_pr(pr_number=current)
  → yummy-mcp → yummy-hub → yummy-dev agent
  → yummy-rag lấy codebase context
  → LLM sinh review comment
  → Kết quả hiển thị ngay trong VS Code chat
```

---

## 6. Roadmap Implementation

### Phase 1 — Foundation (Week 1-2)

- Setup yummy-core FastAPI với basic CRUD
- Setup yummy-rag với pgvector, index Yummy repo
- Deploy yummy-hub (nginx + JWT auth)
- Deploy YummyCode (binary) cho dev team

### Phase 2 — Business Agents (Week 3-4)

- Implement yummy-po agent
- Implement yummy-ba agent
- Implement yummy-scrum với Slack integration
- Yummy Web Portal (basic sprint board)

### Phase 3 — Technical Agents (Week 5-6)

- Implement yummy-dev agent (wrap YummyCode)
- Implement yummy-qa agent
- Implement yummy-guard (secret scan + CVE)
- GitHub Actions integration

### Phase 4 — MCP Layer (Week 7-8)

- Implement yummy-mcp server
- Test với Claude Desktop
- Test với VS Code + Continue.dev
- Test với Cursor
- Document MCP tool catalog

### Phase 5 — Production Hardening (Week 9-10)

- SSO/LDAP integration vào yummy-hub
- SIEM audit log integration
- Performance tuning (Redis cache, async jobs)
- yummy-collab WebSocket
- Company-wide rollout

---

*Yummy Platform Architecture Document — v1.0*
*Based on: github.com/LamHoangCatVy/yummy*
*MCP Spec: modelcontextprotocol.io*