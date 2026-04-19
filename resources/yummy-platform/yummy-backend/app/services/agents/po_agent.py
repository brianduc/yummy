"""yummy-po — Product Owner Agent"""
from typing import AsyncIterator
from app.services.ai.base import ai_service

PO_SYSTEM = """You are yummy-po, an expert Product Owner AI agent for the Yummy Platform.
Your responsibilities:
- Transform stakeholder requests into structured PRDs with BDD acceptance criteria
- Prioritize backlogs using RICE/WSJF scoring
- Create and refine user stories in the format: As a [role], I want [feature], so that [benefit]
- Track OKRs and map features to key results
- Generate Now/Next/Later roadmaps

Always respond in Vietnamese unless asked otherwise. Be specific, actionable, and concise."""

class POAgent:
    async def generate_prd(self, request: str, project_context: dict = {}) -> AsyncIterator[str]:
        messages = [{"role": "user", "content": f"""
Generate a complete PRD for: {request}

Project context: {project_context}

Include:
1. Problem statement & goals
2. User personas
3. User stories with BDD acceptance criteria (Given/When/Then)
4. Out of scope
5. Success metrics (KPIs)
6. Technical constraints
"""}]
        async for chunk in ai_service.chat_stream(messages, system=PO_SYSTEM):
            yield chunk

    async def prioritize_backlog(self, stories: list[dict]) -> AsyncIterator[str]:
        stories_text = "\n".join([f"- {s.get('title', '')} (id: {s.get('id', '')})" for s in stories])
        messages = [{"role": "user", "content": f"""
Prioritize these backlog items using RICE scoring (Reach, Impact, Confidence, Effort):

{stories_text}

For each item provide:
- RICE score
- Rationale
- Suggested sprint assignment
"""}]
        async for chunk in ai_service.chat_stream(messages, system=PO_SYSTEM):
            yield chunk

    async def generate_user_stories(self, feature: str, num_stories: int = 5) -> AsyncIterator[str]:
        messages = [{"role": "user", "content": f"""
Generate {num_stories} detailed user stories for: {feature}

Each story must include:
- Title
- Story: As a [role], I want [feature], so that [benefit]
- Acceptance criteria (BDD format: Given/When/Then)
- Story points estimate (Fibonacci: 1,2,3,5,8,13)
- Priority (High/Medium/Low)
"""}]
        async for chunk in ai_service.chat_stream(messages, system=PO_SYSTEM):
            yield chunk

po_agent = POAgent()
