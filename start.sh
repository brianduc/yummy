#!/usr/bin/env bash
# ============================================================
# YUMMY - Start both Frontend + Backend with a single command
# Works on: Linux, Mac, Windows Git Bash
# Usage: bash start.sh [mode]
#
# Backend: TypeScript / Hono (backend-ts/). The legacy Python
# backend (backend/) is kept as a fallback but no longer started.
# ============================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend-ts"
FRONTEND_DIR="$ROOT_DIR/frontend"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

# ── Parse mode argument ────────────────────────────────────
MODE_ARG="${1:-}"
case "$MODE_ARG" in
  --help|-h|help)
    echo ""
    echo "Usage: bash start.sh [mode]"
    echo "  mode: dev (default) | staging | prod"
    echo ""
    echo "  dev      Load .env then .env.dev. Start backend + frontend locally."
    echo "  staging  Load .env then .env.staging. Start backend + frontend locally."
    echo "  prod     REFUSED. Use docker compose or your real deploy pipeline."
    echo ""
    echo "  No mode argument is equivalent to 'dev'."
    echo ""
    exit 0
    ;;
  ""|dev)
    MODE="dev"
    ;;
  staging)
    MODE="staging"
    ;;
  prod)
    echo -e "${RED}ERROR: prod mode is not for local launchers. Use docker compose or your real deploy pipeline.${NC}"
    exit 1
    ;;
  *)
    echo -e "${RED}ERROR: Unknown mode: $MODE_ARG. Allowed: dev, staging, prod${NC}"
    exit 1
    ;;
esac

# ── Auto-create .env ───────────────────────────────────────
if [ ! -f "$ROOT_DIR/.env" ]; then
  if [ -f "$ROOT_DIR/.env.example" ]; then
    cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
    echo -e "${YELLOW}Created .env from .env.example"
    echo -e "You can configure provider credentials in the app UI or in .env.${NC}"
  else
    echo -e "${RED}ERROR: .env not found.${NC}"
    exit 1
  fi
fi

# ── Auto-create .env.$MODE ─────────────────────────────────
if [ ! -f "$ROOT_DIR/.env.$MODE" ]; then
  if [ -f "$ROOT_DIR/.env.$MODE.example" ]; then
    cp "$ROOT_DIR/.env.$MODE.example" "$ROOT_DIR/.env.$MODE"
    echo -e "${YELLOW}Created .env.$MODE from .env.$MODE.example"
    echo -e "Edit .env.$MODE if needed, then run again.${NC}"
    exit 0
  else
    echo -e "${RED}ERROR: .env.$MODE not found and .env.$MODE.example missing.${NC}"
    exit 1
  fi
fi

# ── Load .env ──────────────────────────────────────────────
set -a
source "$ROOT_DIR/.env"
[ -f "$ROOT_DIR/.env.$MODE" ] && source "$ROOT_DIR/.env.$MODE"
set +a

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
AI_PROVIDER="${AI_PROVIDER:-gemini}"

echo ""
echo -e "${CYAN}YUMMY - AI SDLC Platform ${YELLOW}[$MODE mode]${NC}"
echo "=================================="

# ── Detect Node ────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo -e "${RED}ERROR: Node.js not found. Install Node 20+ from https://nodejs.org${NC}"
  exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo -e "${RED}ERROR: Node 20+ required (found $(node -v)).${NC}"
  exit 1
fi
echo -e "${GREEN}Using Node: $(node -v)${NC}"

# ── Detect / install pnpm ──────────────────────────────────
if ! command -v pnpm &>/dev/null; then
  echo -e "${YELLOW}pnpm not found. Installing via 'npm install -g pnpm'...${NC}"
  npm install -g pnpm
  if [ $? -ne 0 ]; then
    echo -e "${RED}ERROR: Failed to install pnpm.${NC}"
    exit 1
  fi
fi
echo -e "${GREEN}Using pnpm: $(pnpm -v)${NC}"

# ── Backend (TypeScript / Hono) ────────────────────────────
echo -e "\n${YELLOW}[Backend] Setting up...${NC}"
cd "$BACKEND_DIR"

if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}[Backend] Installing dependencies (first run)...${NC}"
  pnpm install --silent
  if [ $? -ne 0 ]; then
    echo -e "${RED}[Backend] ERROR: pnpm install failed.${NC}"
    exit 1
  fi
fi
echo -e "${GREEN}[Backend] Dependencies OK${NC}"

# Apply DB migrations (idempotent)
pnpm db:migrate >/dev/null 2>&1 || true

echo -e "${YELLOW}[Backend] Starting at http://localhost:$BACKEND_PORT ...${NC}"
PORT="$BACKEND_PORT" pnpm dev &
BACKEND_PID=$!

# ── Frontend ───────────────────────────────────────────────
echo -e "\n${YELLOW}[Frontend] Setting up...${NC}"
cd "$FRONTEND_DIR"

: "${NEXT_PUBLIC_API_URL:=http://localhost:$BACKEND_PORT}"
echo "NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL" > .env.local

if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}[Frontend] Installing npm packages (first run)...${NC}"
  npm install --silent
fi

echo -e "${GREEN}[Frontend] Dependencies OK${NC}"
echo -e "${YELLOW}[Frontend] Starting at http://localhost:$FRONTEND_PORT ...${NC}"
npm run dev -- --port "$FRONTEND_PORT" &
FRONTEND_PID=$!

# ── Done ───────────────────────────────────────────────────
echo ""
echo -e "${GREEN}=================================="
echo -e "YUMMY is running!"
echo -e ""
echo -e "  App:     http://localhost:$FRONTEND_PORT"
echo -e "  API:     http://localhost:$BACKEND_PORT"
echo -e "  Swagger: http://localhost:$BACKEND_PORT/docs"
echo -e "==================================${NC}"
echo ""
echo "Press Ctrl+C to stop..."

cleanup() {
  echo -e "\n${YELLOW}Shutting down...${NC}"
  kill $BACKEND_PID 2>/dev/null || true
  kill $FRONTEND_PID 2>/dev/null || true
  echo -e "${GREEN}Stopped.${NC}"
  exit 0
}
trap cleanup SIGINT SIGTERM

wait
