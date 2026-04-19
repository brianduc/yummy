from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
from app.api.v1.endpoints.auth import get_current_user
from app.db.models.user import User
from app.services.agents.review_agent import review_agent
import json

router = APIRouter()

class PRReviewRequest(BaseModel):
    repo: str
    prNumber: int
    focus: Optional[List[str]] = None

class SnippetReviewRequest(BaseModel):
    code: str
    language: str
    context: Optional[str] = None

@router.post("/pr")
async def review_pr(data: PRReviewRequest, current_user: User = Depends(get_current_user)):
    async def stream():
        async for chunk in review_agent.review_pr(data.repo, data.prNumber, data.focus):
            yield f"data: {json.dumps({'chunk': chunk})}\n\n"
        yield f"data: {json.dumps({'done': True})}\n\n"
    return StreamingResponse(stream(), media_type="text/event-stream")

@router.post("/snippet")
async def review_snippet(data: SnippetReviewRequest, current_user: User = Depends(get_current_user)):
    async def stream():
        async for chunk in review_agent.review_snippet(data.code, data.language, data.context):
            yield f"data: {json.dumps({'chunk': chunk})}\n\n"
        yield f"data: {json.dumps({'done': True})}\n\n"
    return StreamingResponse(stream(), media_type="text/event-stream")
