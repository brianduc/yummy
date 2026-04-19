from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
from app.api.v1.endpoints.auth import get_current_user
from app.db.models.user import User
from app.services.agents.security_agent import security_agent
import json

router = APIRouter()

class ScanRequest(BaseModel):
    code: str
    language: str = "unknown"

class DepsRequest(BaseModel):
    dependencies: List[str]
    ecosystem: str = "npm"

@router.post("/scan")
async def scan_code(data: ScanRequest, current_user: User = Depends(get_current_user)):
    async def stream():
        async for chunk in security_agent.scan_code(data.code, data.language):
            yield f"data: {json.dumps({'chunk': chunk})}\n\n"
        yield f"data: {json.dumps({'done': True})}\n\n"
    return StreamingResponse(stream(), media_type="text/event-stream")

@router.post("/audit-deps")
async def audit_deps(data: DepsRequest, current_user: User = Depends(get_current_user)):
    async def stream():
        async for chunk in security_agent.audit_dependencies(data.dependencies, data.ecosystem):
            yield f"data: {json.dumps({'chunk': chunk})}\n\n"
        yield f"data: {json.dumps({'done': True})}\n\n"
    return StreamingResponse(stream(), media_type="text/event-stream")
