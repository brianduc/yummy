"""Chat endpoint — SSE streaming for all agents"""
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from app.api.v1.endpoints.auth import get_current_user
from app.db.models.user import User
from app.services.agents.po_agent import po_agent
from app.services.agents.review_agent import review_agent
from app.services.agents.security_agent import security_agent
import asyncio, json

router = APIRouter()

class ChatRequest(BaseModel):
    agent: str  # po | ba | review | security | qa | docs | code | scrum
    message: str
    context: dict = {}
    model: Optional[str] = None
    session_id: Optional[str] = None

async def stream_response(agent: str, message: str, context: dict):
    """Route to correct agent and stream response as SSE"""
    async def generate():
        try:
            if agent == "po":
                if "prd" in message.lower():
                    gen = po_agent.generate_prd(message, context)
                elif "story" in message.lower() or "user stor" in message.lower():
                    gen = po_agent.generate_user_stories(message)
                else:
                    gen = po_agent.prioritize_backlog(context.get("stories", []))
            elif agent == "review":
                gen = review_agent.review_snippet(
                    context.get("code", message),
                    context.get("language", "unknown")
                )
            elif agent == "security":
                gen = security_agent.scan_code(
                    context.get("code", message),
                    context.get("language", "unknown")
                )
            else:
                # Generic fallback
                from app.services.ai.base import ai_service
                gen = ai_service.chat_stream(
                    [{"role": "user", "content": message}],
                    system=f"You are yummy-{agent}, an AI assistant for software teams."
                )

            async for chunk in gen:
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"

            yield f"data: {json.dumps({'done': True})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return generate()

@router.post("/stream")
async def chat_stream(req: ChatRequest, current_user: User = Depends(get_current_user)):
    gen = await stream_response(req.agent, req.message, req.context)
    return StreamingResponse(
        gen,
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )

@router.websocket("/ws/{session_id}")
async def websocket_chat(websocket: WebSocket, session_id: str):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            agent = data.get("agent", "po")
            message = data.get("message", "")
            context = data.get("context", {})

            gen = await stream_response(agent, message, context)
            async for chunk_data in gen:
                if chunk_data.startswith("data: "):
                    await websocket.send_text(chunk_data[6:])
    except WebSocketDisconnect:
        pass
