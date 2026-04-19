#!/bin/bash
set -e
echo "🍜 Deploying Yummy Platform..."

# Check dependencies
command -v docker >/dev/null 2>&1 || { echo "Docker required"; exit 1; }
command -v docker-compose >/dev/null 2>&1 || docker compose version >/dev/null 2>&1 || { echo "Docker Compose required"; exit 1; }

# Setup env
[ -f .env ] || { cp .env.example .env; echo "⚠️  Edit .env with your API keys, then re-run"; exit 0; }

# Pull + build
docker compose pull postgres redis
docker compose build yummy-backend yummy-mcp-server yummy-frontend

# Start
docker compose up -d postgres redis
sleep 5
docker compose up -d yummy-backend yummy-mcp-server yummy-frontend

echo ""
echo "✅ Yummy Platform is running!"
echo "   Frontend:   http://localhost:3000"
echo "   Backend:    http://localhost:8000"
echo "   API Docs:   http://localhost:8000/docs"
echo "   MCP Server: http://localhost:3100/mcp"
echo ""
echo "Add to Claude Code:"
echo "   claude mcp add yummy --url http://localhost:3100/mcp"
echo ""
echo "Add to Cursor (.cursor/mcp.json):"
echo '   { "mcpServers": { "yummy": { "url": "http://localhost:3100/mcp" } } }'
