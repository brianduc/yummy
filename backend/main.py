"""
YUMMY Backend - FastAPI Entry Point
AI-powered multi-agent SDLC platform for banking/enterprise

Run:
    uvicorn main:app --reload --port 8000

Docs:
    http://localhost:8000/docs     (Swagger UI)
    http://localhost:8000/redoc    (ReDoc)

Production:
    Set CORS_ORIGINS to your frontend origin(s), comma-separated, e.g.
    https://app.example.com,https://www.example.com
    Use CORS_ORIGINS=* only for quick tests (credentials disabled for browser CORS rules).
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Routers
from routers.config_router import router as config_router
from routers.sessions_router import router as sessions_router
from routers.kb_router import router as kb_router
from routers.ask_router import router as ask_router
from routers.sdlc_router import router as sdlc_router
from routers.metrics_router import router as metrics_router
from routers.utils_router import router as utils_router

# ============================================================
# APP INIT
# ============================================================

app = FastAPI(
    title="YUMMY API",
    description=(
        "## YUMMY - AI-powered Multi-Agent SDLC Platform\n\n"
        "**Agent Pipeline:** BA → SA → Dev Lead → DEV → Security → QA → SRE\n\n"
        "**Providers:** Gemini 2.5 Flash (cloud) | Ollama (local)\n\n"
        "See `/help` for the full workflow."
    ),
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ============================================================
# CORS MIDDLEWARE
# CORS_ORIGINS: comma-separated list, e.g. http://localhost:3000,https://app.example.com
# Wildcard * is allowed for local experimentation only (allow_credentials=False).
# ============================================================

def _cors_settings() -> tuple[list[str], bool]:
    raw = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).strip()
    if not raw:
        return ["http://localhost:3000", "http://127.0.0.1:3000"], True
    parts = [p.strip() for p in raw.split(",") if p.strip()]
    if parts == ["*"]:
        return ["*"], False
    return parts, True


_cors_origins, _cors_credentials = _cors_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=_cors_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# ROUTERS
# ============================================================

app.include_router(utils_router)
app.include_router(config_router)
app.include_router(sessions_router)
app.include_router(kb_router)
app.include_router(ask_router)
app.include_router(sdlc_router)
app.include_router(metrics_router)
