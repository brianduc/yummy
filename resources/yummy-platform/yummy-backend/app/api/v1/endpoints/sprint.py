from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.api.v1.endpoints.auth import get_current_user
from app.db.models.user import User
from app.db.models.sprint import Sprint, UserStory, SprintStatus
from app.services.agents.po_agent import po_agent
import json

router = APIRouter()

class StoryCreateRequest(BaseModel):
    title: str
    description: Optional[str] = None
    projectId: Optional[str] = None

class PRDRequest(BaseModel):
    request: str
    projectId: Optional[str] = None

@router.get("/")
async def get_sprints(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Sprint).limit(10))
    sprints = result.scalars().all()
    return {"items": [{"id": s.id, "name": s.name, "status": s.status, "velocity": s.velocity} for s in sprints]}

@router.get("/current")
async def get_current_sprint(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Sprint).where(Sprint.status == SprintStatus.active).limit(1))
    sprint = result.scalar_one_or_none()
    if not sprint:
        return {"sprint": None, "message": "No active sprint"}
    return {"sprint": {"id": sprint.id, "name": sprint.name, "goal": sprint.goal, "velocity": sprint.velocity}}

@router.post("/stories")
async def create_story(data: StoryCreateRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    story = UserStory(title=data.title, description=data.description, project_id=data.projectId or "default", ai_generated=False)
    db.add(story)
    await db.flush()
    return {"id": story.id, "title": story.title, "status": story.status}

@router.post("/stories/generate")
async def generate_stories(data: PRDRequest, current_user: User = Depends(get_current_user)):
    async def stream():
        async for chunk in po_agent.generate_user_stories(data.request):
            yield f"data: {json.dumps({'chunk': chunk})}\n\n"
        yield f"data: {json.dumps({'done': True})}\n\n"
    return StreamingResponse(stream(), media_type="text/event-stream")

@router.post("/prd")
async def generate_prd(data: PRDRequest, current_user: User = Depends(get_current_user)):
    async def stream():
        async for chunk in po_agent.generate_prd(data.request):
            yield f"data: {json.dumps({'chunk': chunk})}\n\n"
        yield f"data: {json.dumps({'done': True})}\n\n"
    return StreamingResponse(stream(), media_type="text/event-stream")
