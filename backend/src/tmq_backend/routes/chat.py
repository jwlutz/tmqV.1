from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from tmq_backend.ai.engine import chat_stream
from tmq_backend.config import get_api_key, get_configured_providers

router = APIRouter(prefix="/api")


class ChatRequest(BaseModel):
    messages: list[dict]
    model: str = "gpt-4o-mini"
    # Provider to use for server-side key lookup (anthropic, openai, openrouter, etc.)
    provider: str | None = None
    # Custom API key (overrides server-side key if provided)
    api_key: str | None = None
    use_openrouter: bool = False


@router.post("/chat")
async def chat(request: ChatRequest):
    # Determine API key: custom key takes precedence, then server-side
    api_key = request.api_key

    if not api_key and request.provider:
        # Use server-side key for the specified provider
        api_key = get_api_key(request.provider)
        if not api_key:
            configured = get_configured_providers()
            raise HTTPException(
                status_code=400,
                detail=f"Provider '{request.provider}' not configured. "
                       f"Available: {[p for p, v in configured.items() if v]}"
            )

    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="No API key provided. Either set 'api_key' or 'provider' field."
        )

    return StreamingResponse(
        chat_stream(
            request.messages,
            api_key,
            request.model,
            use_openrouter=request.use_openrouter,
        ),
        media_type="text/event-stream",
    )
