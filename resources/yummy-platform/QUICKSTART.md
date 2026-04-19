# 🍜 Yummy Platform — Quick Start Guide

## Prerequisites
- Docker + Docker Compose
- 16GB RAM minimum (32GB recommended for local AI with Ollama)
- Git

## 5-Minute Setup

```bash
# 1. Clone and enter
git clone https://github.com/YOUR_ORG/yummy-platform
cd yummy-platform

# 2. Configure (add at minimum ANTHROPIC_API_KEY)
cp .env.example .env
nano .env

# 3. Deploy
./deploy.sh

# 4. Open browser
open http://localhost:3000

# 5. Connect Claude Code (optional but recommended)
claude mcp add yummy --url http://localhost:3100/mcp
```

## Architecture

```
yummy-frontend  :3000  → Next.js 15 App Router
yummy-backend   :8000  → FastAPI Python 3.12
yummy-mcp-server:3100  → MCP server (TypeScript/Bun)
PostgreSQL      :5432  → Primary DB + pgvector
Redis           :6379  → Cache + pub/sub
Ollama          :11434 → Local AI (optional, 32GB RAM)
```

## Connect Your IDE

**Claude Code**: `claude mcp add yummy --url http://localhost:3100/mcp`
**Cursor**: Add `.cursor/mcp.json` → `{ "mcpServers": { "yummy": { "url": "http://localhost:3100/mcp" } } }`
**VS Code**: settings.json → `"mcp.servers": { "yummy": { "url": "http://localhost:3100/mcp" } }`
