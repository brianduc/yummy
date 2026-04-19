from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth, users, projects, agents,
    chat, sprint, review, security,
    docs_gen, qa, github_webhooks, mcp_gateway
)

api_router = APIRouter()

api_router.include_router(auth.router,            prefix="/auth",     tags=["Authentication"])
api_router.include_router(users.router,           prefix="/users",    tags=["Users"])
api_router.include_router(projects.router,        prefix="/projects", tags=["Projects"])
api_router.include_router(agents.router,          prefix="/agents",   tags=["Agents"])
api_router.include_router(chat.router,            prefix="/chat",     tags=["Chat & Streaming"])
api_router.include_router(sprint.router,          prefix="/sprint",   tags=["Sprint / Agile"])
api_router.include_router(review.router,          prefix="/review",   tags=["Code Review"])
api_router.include_router(security.router,        prefix="/security", tags=["Security Guard"])
api_router.include_router(docs_gen.router,        prefix="/docs-gen", tags=["Documentation"])
api_router.include_router(qa.router,              prefix="/qa",       tags=["QA & Testing"])
api_router.include_router(github_webhooks.router, prefix="/webhooks", tags=["GitHub Webhooks"])
api_router.include_router(mcp_gateway.router,     prefix="/mcp",      tags=["MCP Gateway"])
