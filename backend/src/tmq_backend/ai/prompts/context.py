"""
Runtime context injection for AI prompts.

LLMs have no inherent sense of time, environment, or tools. This module
injects temporal context programmatically into every system prompt at runtime.

Also contains the Provider Registry — a capabilities matrix that tells the AI
which data sources support which access patterns and their computational costs.
"""

import os
from datetime import datetime, timezone
from typing import Literal

Provider = Literal["anthropic", "openai", "google", "xai"]

# ─────────────────────────────────────────────────────────────────────────────
# Provider Registry: Maps data sources to capabilities and costs
# ─────────────────────────────────────────────────────────────────────────────

PROVIDER_REGISTRY = {
    "yfinance": {
        "env_key": None,  # Always available (no API key)
        "universe_type": "closed",  # Must specify ticker
        "capabilities": {
            "price_history": {"supported": True, "cost": "O(1)", "description": "OHLCV for single ticker"},
            "fundamentals": {"supported": True, "cost": "O(1)", "description": "ticker.info with 100+ fields"},
            "market_scan": {"supported": False},
            "insider_data": {"supported": False},
            "macro_data": {"supported": False},
        },
        "limitations": ["survivorship_bias", "no_delisted_stocks", "scraping_based"],
        "best_for": "Single-ticker deep dives, fundamentals",
    },
    "alpaca": {
        "env_key": "ALPACA_API_KEY",
        "universe_type": "open",  # Can list all assets
        "capabilities": {
            "price_history": {"supported": True, "cost": "O(1)", "description": "OHLCV bars with 6+ years history"},
            "market_scan": {"supported": True, "cost": "O(1)", "method": "get_assets", "description": "List all ~11k tradeable US stocks"},
            "fundamentals": {"supported": False},
            "insider_data": {"supported": False},
            "macro_data": {"supported": False},
        },
        "limitations": ["survivorship_bias", "us_equities_only"],
        "best_for": "Universe lists, price data at scale",
    },
    "sec_edgar": {
        "env_key": None,  # Public API
        "universe_type": "open",  # Can scan recent filings market-wide
        "capabilities": {
            "price_history": {"supported": False},
            "market_scan": {"supported": True, "cost": "O(1)", "method": "efts_search", "description": "All Form 4s market-wide for date range"},
            "insider_data": {"supported": True, "cost": "O(1)", "method": "scan_recent_form4s", "description": "PREFER THIS for finding insider buying"},
            "fundamentals": {"supported": False},
            "macro_data": {"supported": False},
            "filings": {"supported": True, "cost": "O(1)", "description": "10-K, 10-Q, 8-K per ticker"},
        },
        "limitations": ["rate_limit_10_per_sec", "2_day_filing_lag"],
        "best_for": "Insider transactions, market-wide filing scans",
    },
    "fred": {
        "env_key": "FRED_API_KEY",
        "universe_type": "closed",  # Must specify series ID
        "capabilities": {
            "price_history": {"supported": False},
            "market_scan": {"supported": False},
            "fundamentals": {"supported": False},
            "insider_data": {"supported": False},
            "macro_data": {"supported": True, "cost": "O(1)", "description": "800k+ economic series: rates, inflation, employment"},
        },
        "limitations": [],
        "best_for": "Macro data, regime conditioning",
    },
    "ccxt": {
        "env_key": None,  # Public for read-only
        "universe_type": "open",  # Can enumerate pairs
        "capabilities": {
            "price_history": {"supported": True, "cost": "O(1)", "description": "Crypto OHLCV via Coinbase"},
            "market_scan": {"supported": True, "cost": "O(1)", "description": "List all trading pairs"},
            "fundamentals": {"supported": False},
            "insider_data": {"supported": False},
            "macro_data": {"supported": False},
        },
        "limitations": ["crypto_only", "coinbase_exchange"],
        "best_for": "Crypto prices",
    },
    "norgate": {
        "env_key": "NORGATE_API_KEY",
        "universe_type": "open",  # Historical index constituents
        "capabilities": {
            "price_history": {"supported": True, "cost": "O(1)", "description": "Survivorship-free OHLCV back to 1950"},
            "market_scan": {"supported": True, "cost": "O(1)", "description": "Historical S&P 500, Russell 3000 constituents"},
            "fundamentals": {"supported": False},
            "insider_data": {"supported": False},
            "macro_data": {"supported": False},
        },
        "limitations": ["paid", "windows_only"],
        "best_for": "Survivorship-bias-free backtests",
    },
}


def get_active_providers() -> dict:
    """
    Check which providers have API keys configured and return their capabilities.

    Returns:
        Dict of provider_name -> {capabilities, limitations, best_for}
    """
    active = {}
    for name, info in PROVIDER_REGISTRY.items():
        env_key = info["env_key"]
        # Provider is active if no key needed OR key is present
        if env_key is None or os.getenv(env_key):
            active[name] = {
                "universe_type": info["universe_type"],
                "capabilities": info["capabilities"],
                "limitations": info["limitations"],
                "best_for": info["best_for"],
            }
    return active


def build_capabilities_matrix() -> str:
    """
    Build a compact capabilities matrix for injection into the system prompt.

    Returns a markdown table the AI can reference for query planning.
    """
    active = get_active_providers()

    if not active:
        return "No data providers configured."

    lines = [
        "## DATA PROVIDERS & CAPABILITIES",
        "",
        "| Provider | Universe? | Price? | Fundamentals? | Insider? | Macro? | Best For |",
        "|----------|-----------|--------|---------------|----------|--------|----------|",
    ]

    for name, info in active.items():
        caps = info["capabilities"]
        universe = "✅ O(1)" if info["universe_type"] == "open" else "❌"
        price = "✅" if caps.get("price_history", {}).get("supported") else "❌"
        funds = "✅" if caps.get("fundamentals", {}).get("supported") else "❌"
        insider = "✅" if caps.get("insider_data", {}).get("supported") else "❌"
        macro = "✅" if caps.get("macro_data", {}).get("supported") else "❌"
        best = info["best_for"]

        lines.append(f"| {name} | {universe} | {price} | {funds} | {insider} | {macro} | {best} |")

    # Add decision rules
    lines.extend([
        "",
        "## QUERY RULES",
        "- **Universe Rule**: To get 'all stocks' or 'tech stocks', use Alpaca (O(1)). yFinance requires explicit tickers.",
        "- **Insider Scan Rule**: Use SEC `scan_recent_form4s` (O(1)) for market-wide insider activity. Do NOT iterate tickers.",
        "- **Bias Warning**: All providers except Norgate have survivorship bias. Warn on backtests > 1 year.",
    ])

    return "\n".join(lines)


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
        Dict with datetime info, market status, active providers, and capabilities.
    """
    now = datetime.now(timezone.utc)

    return {
        "datetime_iso": now.isoformat(),
        "datetime_human": now.strftime("%A, %B %d, %Y at %H:%M UTC"),
        "year": now.year,
        "timestamp": int(now.timestamp()),
        "market_open": is_market_open(now),
        "capabilities_matrix": build_capabilities_matrix(),
        "active_providers": list(get_active_providers().keys()),
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
