#!/usr/bin/env bash
# ============================================================
# YUMMY - Start both Frontend + Backend with a single command
# Works on: Linux, Mac, Windows Git Bash
# Usage: bash start.sh
# ============================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

# ── Auto-create .env ───────────────────────────────────────
if [ ! -f "$ROOT_DIR/.env" ]; then
  if [ -f "$ROOT_DIR/.env.example" ]; then
    cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
    echo -e "${YELLOW}Created .env from .env.example"
    echo -e "Please fill in GEMINI_API_KEY in .env, then run again.${NC}"
    exit 0
  else
    echo -e "${RED}ERROR: .env not found.${NC}"
    exit 1
  fi
fi

# ── Load .env ──────────────────────────────────────────────
set -a
source "$ROOT_DIR/.env"
set +a

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
AI_PROVIDER="${AI_PROVIDER:-gemini}"

if [ "$AI_PROVIDER" = "gemini" ] && [ -z "$GEMINI_API_KEY" ]; then
  echo -e "${RED}ERROR: GEMINI_API_KEY is not set in .env${NC}"
  exit 1
fi

echo ""
echo -e "${CYAN}YUMMY - AI SDLC Platform${NC}"
echo "=================================="

# ── Detect Python ──────────────────────────────────────────
PYTHON=""
for cmd in python3 python python3.13 python3.12; do
  if command -v "$cmd" &>/dev/null; then
    PYTHON="$cmd"
    break
  fi
done
if [ -z "$PYTHON" ]; then
  echo -e "${RED}ERROR: Python not found. Install Python 3.10+ and try again.${NC}"
  exit 1
fi
echo -e "${GREEN}Using Python: $(command -v $PYTHON)${NC}"

# ── Backend ────────────────────────────────────────────────
echo -e "\n${YELLOW}[Backend] Setting up...${NC}"
cd "$BACKEND_DIR"

if [ ! -d "venv" ]; then
  $PYTHON -m venv venv
  echo -e "${GREEN}[Backend] venv created${NC}"
fi

# Activate - Windows Git Bash uses Scripts/, Unix uses bin/
if [ -f "venv/Scripts/activate" ]; then
  source venv/Scripts/activate
elif [ -f "venv/bin/activate" ]; then
  source venv/bin/activate
else
  echo -e "${RED}ERROR: venv activation script not found.${NC}"
  exit 1
fi

pip install -r requirements.txt -q
if [ $? -ne 0 ]; then
  echo -e "${RED}[Backend] ERROR: pip install failed.${NC}"
  exit 1
fi
echo -e "${GREEN}[Backend] Dependencies OK${NC}"

echo -e "${YELLOW}[Backend] Starting at http://localhost:$BACKEND_PORT ...${NC}"
python -m uvicorn main:app --reload --port "$BACKEND_PORT" --log-level warning &
BACKEND_PID=$!

# ── Frontend ───────────────────────────────────────────────
echo -e "\n${YELLOW}[Frontend] Setting up...${NC}"
cd "$FRONTEND_DIR"

echo "NEXT_PUBLIC_API_URL=http://localhost:$BACKEND_PORT" > .env.local

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
