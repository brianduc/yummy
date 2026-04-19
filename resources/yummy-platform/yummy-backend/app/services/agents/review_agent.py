"""yummy-review — Code Review Agent"""
from typing import AsyncIterator
import httpx
from app.services.ai.base import ai_service
from app.core.config import settings

REVIEW_SYSTEM = """You are yummy-review, an expert code review AI agent.
Review code for:
- Code quality and readability
- Performance anti-patterns (N+1, blocking calls, memory leaks)
- Security vulnerabilities (OWASP Top 10)
- Test coverage gaps
- Architecture violations
- Coding standards compliance

Be specific, reference exact line numbers, provide actionable suggestions.
Format: ## Summary → ## Critical Issues → ## Suggestions → ## Verdict (Approve/Request Changes/Block)"""

class ReviewAgent:
    async def review_pr(self, repo: str, pr_number: int, focus: list[str] = None) -> AsyncIterator[str]:
        diff = await self._fetch_pr_diff(repo, pr_number)
        focus_text = f"\nFocus especially on: {', '.join(focus)}" if focus else ""
        messages = [{"role": "user", "content": f"""
Review this Pull Request diff from {repo} PR #{pr_number}:{focus_text}

```diff
{diff[:15000]}
```

Provide a comprehensive code review.
"""}]
        async for chunk in ai_service.chat_stream(messages, system=REVIEW_SYSTEM):
            yield chunk

    async def review_snippet(self, code: str, language: str, context: str = "") -> AsyncIterator[str]:
        messages = [{"role": "user", "content": f"""
Review this {language} code:
{f'Context: {context}' if context else ''}

```{language}
{code}
```
"""}]
        async for chunk in ai_service.chat_stream(messages, system=REVIEW_SYSTEM):
            yield chunk

    async def _fetch_pr_diff(self, repo: str, pr_number: int) -> str:
        if not settings.GITHUB_CLIENT_ID:
            return f"# Mock diff for {repo} PR #{pr_number}\n+ Added feature X\n- Removed old code"
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://api.github.com/repos/{repo}/pulls/{pr_number}",
                headers={"Accept": "application/vnd.github.diff"},
            )
            return resp.text if resp.status_code == 200 else "Could not fetch PR diff"

review_agent = ReviewAgent()
