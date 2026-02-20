from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from tmq_backend.ai.engine import chat_stream
from tmq_backend.config import get_api_key, get_configured_providers

router = APIRouter(prefix="/api")


class ActivePane(BaseModel):
    """Active/focused chart pane."""
    id: str | None = None
    symbol: str | None = None
    widget_type: str | None = None
    interval: str | None = None


class ChartPane(BaseModel):
    """A chart pane in the workspace."""
    id: str | None = None
    symbol: str | None = None
    widget_type: str | None = None


class WorkspaceState(BaseModel):
    """Current workspace layout state."""
    layout: str | None = None  # e.g., "1x1", "1x2", "2x2"
    code_panel_open: bool | None = None


class ChatContext(BaseModel):
    """Full workspace context for AI context awareness."""
    active_pane: ActivePane | None = None
    chart_panes: list[ChartPane] | None = None
    workspace: WorkspaceState | None = None


class ChatRequest(BaseModel):
    messages: list[dict]
    model: str = "gpt-4o-mini"
    # Provider to use for server-side key lookup (anthropic, openai, openrouter, etc.)
    provider: str | None = None
    # Custom API key (overrides server-side key if provided)
    api_key: str | None = None
    use_openrouter: bool = False
    # Current workspace context for state-aware responses
    context: ChatContext | None = None


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

    # Build context dict for chat_stream (matching engine.py expected structure)
    context_dict = None
    if request.context:
        context_dict = {}

        if request.context.active_pane:
            context_dict["active_pane"] = {
                "id": request.context.active_pane.id,
                "symbol": request.context.active_pane.symbol,
                "widget_type": request.context.active_pane.widget_type,
                "interval": request.context.active_pane.interval,
            }

        if request.context.chart_panes:
            context_dict["chart_panes"] = [
                {
                    "id": p.id,
                    "symbol": p.symbol,
                    "widget_type": p.widget_type,
                }
                for p in request.context.chart_panes
            ]

        if request.context.workspace:
            context_dict["workspace"] = {
                "layout": request.context.workspace.layout,
                "code_panel_open": request.context.workspace.code_panel_open,
            }

    return StreamingResponse(
        chat_stream(
            request.messages,
            api_key,
            request.model,
            use_openrouter=request.use_openrouter,
            context=context_dict,
        ),
        media_type="text/event-stream",
    )
