from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from tmq_backend.ai.engine import chat_stream

router = APIRouter(prefix="/api")


class ChatRequest(BaseModel):
    messages: list[dict]
    api_key: str
    model: str = "gpt-4o-mini"
    use_openrouter: bool = False


@router.post("/chat")
async def chat(request: ChatRequest):
    return StreamingResponse(
        chat_stream(
            request.messages,
            request.api_key,
            request.model,
            use_openrouter=request.use_openrouter,
        ),
        media_type="text/event-stream",
    )
