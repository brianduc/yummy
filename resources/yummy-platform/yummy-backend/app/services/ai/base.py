"""AI Service — model-agnostic AI provider routing"""
from typing import AsyncIterator, Optional
from anthropic import AsyncAnthropic
from openai import AsyncOpenAI
import httpx
from app.core.config import settings

class AIService:
    """Routes requests to the right AI provider based on model name."""

    def __init__(self):
        self.anthropic = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY) if settings.ANTHROPIC_API_KEY else None
        self.openai = AsyncOpenAI(api_key=settings.OPENAI_API_KEY) if settings.OPENAI_API_KEY else None

    async def chat_stream(
        self,
        messages: list[dict],
        model: Optional[str] = None,
        system: Optional[str] = None,
        max_tokens: int = 8192,
        tools: Optional[list] = None,
    ) -> AsyncIterator[str]:
        model = model or settings.DEFAULT_MODEL
        provider, model_name = self._parse_model(model)

        if provider == "anthropic":
            yield from self._anthropic_stream(messages, model_name, system, max_tokens, tools)
        elif provider == "openai":
            yield from self._openai_stream(messages, model_name, system, max_tokens)
        elif provider == "ollama":
            yield from self._ollama_stream(messages, model_name, system, max_tokens)
        else:
            raise ValueError(f"Unknown provider: {provider}")

    def _parse_model(self, model: str) -> tuple[str, str]:
        if "/" in model:
            provider, name = model.split("/", 1)
            return provider, name
        if "claude" in model:
            return "anthropic", model
        if "gpt" in model or "o1" in model:
            return "openai", model
        return "ollama", model

    async def _anthropic_stream(self, messages, model, system, max_tokens, tools):
        kwargs = dict(model=model, max_tokens=max_tokens, messages=messages)
        if system:
            kwargs["system"] = system
        if tools:
            kwargs["tools"] = tools
        async with self.anthropic.messages.stream(**kwargs) as stream:
            async for text in stream.text_stream:
                yield text

    async def _openai_stream(self, messages, model, system, max_tokens):
        all_msgs = []
        if system:
            all_msgs.append({"role": "system", "content": system})
        all_msgs.extend(messages)
        stream = await self.openai.chat.completions.create(
            model=model, messages=all_msgs, max_tokens=max_tokens, stream=True
        )
        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    async def _ollama_stream(self, messages, model, system, max_tokens):
        all_msgs = []
        if system:
            all_msgs.append({"role": "system", "content": system})
        all_msgs.extend(messages)
        async with httpx.AsyncClient(timeout=300) as client:
            async with client.stream(
                "POST",
                f"{settings.OLLAMA_BASE_URL}/api/chat",
                json={"model": model, "messages": all_msgs, "stream": True},
            ) as resp:
                import json
                async for line in resp.aiter_lines():
                    if line:
                        data = json.loads(line)
                        if data.get("message", {}).get("content"):
                            yield data["message"]["content"]

ai_service = AIService()
