"""
Runtime context injection for AI prompts.

LLMs have no inherent sense of time, environment, or tools. This module
injects temporal context programmatically into every system prompt at runtime.
"""

from datetime import datetime, timezone
from typing import Literal

Provider = Literal["anthropic", "openai", "google", "xai"]


def is_market_open(dt: datetime) -> bool:
    """
    Check if US stock markets are currently open.

    Simplified check: Mon-Fri 9:30 AM - 4:00 PM Eastern.
    Does not account for holidays.
    """
    # Convert to Eastern time (UTC-5, ignoring DST for simplicity)
    eastern_hour = (dt.hour - 5) % 24

    # Weekend check
    if dt.weekday() >= 5:  # Saturday = 5, Sunday = 6
        return False

    # Market hours: 9:30 AM - 4:00 PM Eastern
    if eastern_hour < 9 or eastern_hour >= 16:
        return False
    if eastern_hour == 9 and dt.minute < 30:
        return False

    return True


def build_environment() -> dict:
    """
    Build the runtime environment context.

    Returns:
        Dict with datetime info, market status, etc.
    """
    now = datetime.now(timezone.utc)

    return {
        "datetime_iso": now.isoformat(),
        "datetime_human": now.strftime("%A, %B %d, %Y at %H:%M UTC"),
        "year": now.year,
        "timestamp": int(now.timestamp()),
        "market_open": is_market_open(now),
    }


def get_provider_from_model(model: str) -> Provider:
    """
    Detect the AI provider from the model identifier.

    Works with both direct model names and OpenRouter-style prefixed names.

    Args:
        model: Model identifier (e.g., "gpt-4o", "openai/gpt-4o", "claude-sonnet-4")

    Returns:
        Provider name: "anthropic", "openai", "google", or "xai"
    """
    model_lower = model.lower()

    # OpenRouter format: "provider/model-name"
    if "/" in model:
        prefix = model.split("/")[0].lower()
        if prefix in ("anthropic", "openai", "google", "xai"):
            return prefix

    # Direct model name detection
    if any(x in model_lower for x in ["claude", "anthropic"]):
        return "anthropic"
    elif any(x in model_lower for x in ["gpt", "o1", "o3", "o4", "openai"]):
        return "openai"
    elif any(x in model_lower for x in ["gemini", "google", "palm"]):
        return "google"
    elif any(x in model_lower for x in ["grok", "xai"]):
        return "xai"  # xAI uses OpenAI-compatible format

    # Default to OpenAI format
    return "openai"


def resolve_relative_date(text: str, now: datetime | None = None) -> str | None:
    """
    Resolve common relative date expressions to ISO 8601 dates.

    This is called in the application layer BEFORE sending to the LLM,
    as LLMs are unreliable at date math.

    Args:
        text: User input text that may contain relative dates
        now: Reference datetime (defaults to current UTC time)

    Returns:
        ISO 8601 date string if a relative date was found, else None

    Examples:
        "yesterday" -> "2026-02-14"
        "last week" -> "2026-02-08"
        "last month" -> "2026-01-15"
    """
    from datetime import timedelta

    if now is None:
        now = datetime.now(timezone.utc)

    text_lower = text.lower().strip()

    # Simple relative date patterns
    if text_lower in ("today", "now"):
        return now.strftime("%Y-%m-%d")
    elif text_lower == "yesterday":
        return (now - timedelta(days=1)).strftime("%Y-%m-%d")
    elif text_lower in ("last week", "past week", "1 week ago"):
        return (now - timedelta(weeks=1)).strftime("%Y-%m-%d")
    elif text_lower in ("last month", "past month", "1 month ago"):
        # Approximate: 30 days
        return (now - timedelta(days=30)).strftime("%Y-%m-%d")
    elif text_lower in ("last year", "1 year ago"):
        return (now - timedelta(days=365)).strftime("%Y-%m-%d")

    return None
