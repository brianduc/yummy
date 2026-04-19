# 🍜 Yummy Platform — AI-Native Software Engineering Platform

> Gartner-aligned AI platform bridging Business ↔ Technical teams  
> Built for top 100 bank innovation award

## Architecture
- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui
- **Backend**: FastAPI (Python 3.12) + SQLAlchemy + PostgreSQL + Redis
- **MCP Server**: TypeScript/Bun — exposes backend as MCP protocol
- **AI Layer**: Ollama (local) / Claude / OpenAI / Gemini — model agnostic
- **IDE Client**: YummyCode (self-hosted, built on sst/opencode)

## Quick Start
```bash
cp .env.example .env          # configure your API keys
docker compose up -d          # starts all services
open http://localhost:3000    # frontend
open http://localhost:8000/docs # backend swagger
```

## Services
| Service | Port | Description |
|---------|------|-------------|
| yummy-frontend | 3000 | Next.js web app |
| yummy-backend | 8000 | FastAPI REST + WebSocket |
| yummy-mcp-server | 3100 | MCP protocol server |
| PostgreSQL | 5432 | Primary database |
| Redis | 6379 | Cache + pub/sub |
| Ollama | 11434 | Local AI models |

## Monorepo structure
```
yummy-platform/
├── yummy-frontend/   # Next.js 15 App Router
├── yummy-backend/    # FastAPI Python
├── yummy-mcp-server/ # MCP Tools/Resources/Prompts (TypeScript)
├── yummy-infra/      # Docker, K8s, Monitoring
└── docs/             # Architecture docs, ADRs
```
