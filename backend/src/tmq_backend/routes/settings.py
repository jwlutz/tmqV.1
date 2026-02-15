"""Settings routes for reading/writing .env configuration."""
from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/settings", tags=["settings"])


def get_env_path() -> Path:
    """Get the .env file path from the project root."""
    # Walk up from backend to find project root
    current = Path(__file__).resolve().parent
    while current != current.parent:
        if (current / "frontend").exists() and (current / "backend").exists():
            return current / ".env"
        current = current.parent
    # Fallback
    return Path(__file__).resolve().parent.parent.parent.parent.parent / ".env"


def parse_env_file(path: Path) -> dict[str, str]:
    """Parse .env file into key-value pairs."""
    result = {}
    if not path.exists():
        return result

    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            # Skip empty lines and comments
            if not line or line.startswith("#"):
                continue
            # Parse KEY=VALUE
            if "=" in line:
                key, _, value = line.partition("=")
                key = key.strip()
                value = value.strip()
                # Remove surrounding quotes if present
                if (value.startswith('"') and value.endswith('"')) or \
                   (value.startswith("'") and value.endswith("'")):
                    value = value[1:-1]
                result[key] = value
    return result


def write_env_file(path: Path, settings: dict[str, str]) -> None:
    """Write settings to .env file, preserving comments and structure."""
    existing_lines = []
    existing_keys = set()

    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            existing_lines = f.readlines()

    # Update existing lines
    new_lines = []
    for line in existing_lines:
        stripped = line.strip()
        if stripped and not stripped.startswith("#") and "=" in stripped:
            key = stripped.partition("=")[0].strip()
            if key in settings:
                # Update this line
                new_lines.append(f"{key}={settings[key]}\n")
                existing_keys.add(key)
            else:
                # Keep line as-is (may be a key we don't manage)
                new_lines.append(line)
        else:
            # Keep comments and empty lines
            new_lines.append(line)

    # Add new keys that weren't in the file
    for key, value in settings.items():
        if key not in existing_keys and value:  # Only add non-empty values
            new_lines.append(f"{key}={value}\n")

    with open(path, "w", encoding="utf-8") as f:
        f.writelines(new_lines)


def mask_value(key: str, value: str) -> str:
    """Mask sensitive values for frontend display."""
    sensitive_patterns = ["KEY", "SECRET", "TOKEN", "PASSWORD", "CREDENTIAL"]
    if any(pattern in key.upper() for pattern in sensitive_patterns):
        if len(value) <= 8:
            return "*" * len(value)
        return value[:4] + "*" * (len(value) - 8) + value[-4:]
    return value


# Provider metadata for frontend
PROVIDER_METADATA = {
    # Data Providers
    "alpaca": {
        "name": "Alpaca",
        "description": "Commission-free stock trading API with real-time and historical data",
        "keys": ["ALPACA_API_KEY", "ALPACA_SECRET_KEY"],
        "optional_keys": ["ALPACA_API_ENDPOINT"],
        "docs_url": "https://alpaca.markets/docs/api-documentation/",
        "category": "data"
    },
    "polygon": {
        "name": "Polygon.io",
        "description": "Real-time and historical market data for stocks, options, forex, and crypto",
        "keys": ["POLYGON_API_KEY"],
        "docs_url": "https://polygon.io/docs/",
        "category": "data"
    },
    "yfinance": {
        "name": "Yahoo Finance",
        "description": "Free market data (no API key required)",
        "keys": [],
        "category": "data"
    },
    "fred": {
        "name": "FRED",
        "description": "Federal Reserve Economic Data - macroeconomic indicators",
        "keys": ["FRED_API_KEY"],
        "docs_url": "https://fred.stlouisfed.org/docs/api/api_key.html",
        "category": "data"
    },
    # AI Providers
    "anthropic": {
        "name": "Anthropic",
        "description": "Claude AI models",
        "keys": ["ANTHROPIC_API_KEY"],
        "docs_url": "https://console.anthropic.com/",
        "category": "ai"
    },
    "openai": {
        "name": "OpenAI",
        "description": "GPT models",
        "keys": ["OPENAI_API_KEY"],
        "docs_url": "https://platform.openai.com/api-keys",
        "category": "ai"
    },
    "openrouter": {
        "name": "OpenRouter",
        "description": "Unified API for multiple AI providers",
        "keys": ["OPENROUTER_API_KEY"],
        "docs_url": "https://openrouter.ai/keys",
        "category": "ai"
    },
    "google": {
        "name": "Google",
        "description": "Gemini AI models",
        "keys": ["GOOGLE_API_KEY"],
        "docs_url": "https://makersuite.google.com/app/apikey",
        "category": "ai"
    },
    "xai": {
        "name": "xAI",
        "description": "Grok AI models",
        "keys": ["XAI_API_KEY"],
        "docs_url": "https://console.x.ai/",
        "category": "ai"
    },
    # Crypto Exchanges
    "coinbase": {
        "name": "Coinbase",
        "description": "Major US crypto exchange (no API key needed for public data)",
        "keys": [],
        "category": "crypto"
    },
    "binance": {
        "name": "Binance",
        "description": "Global crypto exchange (may be geo-restricted)",
        "keys": ["BINANCE_API_KEY", "BINANCE_SECRET_KEY"],
        "docs_url": "https://www.binance.com/en/my/settings/api-management",
        "category": "crypto"
    },
    "kraken": {
        "name": "Kraken",
        "description": "US-friendly crypto exchange",
        "keys": ["KRAKEN_API_KEY", "KRAKEN_SECRET_KEY"],
        "docs_url": "https://www.kraken.com/u/security/api",
        "category": "crypto"
    },
    "bybit": {
        "name": "Bybit",
        "description": "Crypto derivatives exchange",
        "keys": ["BYBIT_API_KEY", "BYBIT_SECRET_KEY"],
        "docs_url": "https://www.bybit.com/app/user/api-management",
        "category": "crypto"
    },
    "okx": {
        "name": "OKX",
        "description": "Global crypto exchange",
        "keys": ["OKX_API_KEY", "OKX_SECRET_KEY", "OKX_PASSPHRASE"],
        "docs_url": "https://www.okx.com/account/my-api",
        "category": "crypto"
    },
}


class SettingsResponse(BaseModel):
    """Response model for settings."""
    settings: dict[str, str]  # Masked values
    providers: dict[str, Any]  # Provider metadata with status
    raw: str  # Raw .env content for advanced editor


class SettingsUpdateRequest(BaseModel):
    """Request model for updating settings."""
    settings: dict[str, str] | None = None  # Key-value updates
    raw: str | None = None  # Raw .env content (for advanced editor)


class TestConnectionRequest(BaseModel):
    """Request model for testing a provider connection."""
    provider: str
    credentials: dict[str, str]


@router.get("")
def get_settings() -> SettingsResponse:
    """Get all settings from .env file."""
    env_path = get_env_path()
    settings = parse_env_file(env_path)

    # Build masked settings
    masked = {k: mask_value(k, v) for k, v in settings.items()}

    # Build provider status
    providers = {}
    for provider_id, meta in PROVIDER_METADATA.items():
        provider_info = {**meta}
        # Check if configured
        required_keys = meta.get("keys", [])
        if not required_keys:
            provider_info["status"] = "connected"  # No keys needed
        elif all(settings.get(k) for k in required_keys):
            provider_info["status"] = "connected"
        else:
            provider_info["status"] = "not_configured"
        providers[provider_id] = provider_info

    # Get raw content
    raw_content = ""
    if env_path.exists():
        with open(env_path, "r", encoding="utf-8") as f:
            raw_content = f.read()

    return SettingsResponse(
        settings=masked,
        providers=providers,
        raw=raw_content
    )


@router.post("")
def update_settings(request: SettingsUpdateRequest) -> dict[str, str]:
    """Update settings in .env file."""
    env_path = get_env_path()

    if request.raw is not None:
        # Validate raw content
        try:
            # Check for basic syntax issues
            for i, line in enumerate(request.raw.split("\n"), 1):
                line = line.strip()
                if line and not line.startswith("#"):
                    if "=" not in line:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Invalid syntax on line {i}: missing '=' in '{line[:50]}...'"
                        )
            # Write raw content directly
            with open(env_path, "w", encoding="utf-8") as f:
                f.write(request.raw)
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to write .env: {e}")
    elif request.settings:
        # Merge with existing settings
        current = parse_env_file(env_path)
        # Update with new values (empty string = delete)
        for key, value in request.settings.items():
            if value:
                current[key] = value
            elif key in current:
                del current[key]
        write_env_file(env_path, current)

    # Reload environment variables in current process
    new_settings = parse_env_file(env_path)
    for key, value in new_settings.items():
        os.environ[key] = value

    return {"status": "ok", "message": "Settings saved"}


@router.post("/test/{provider}")
async def test_connection(provider: str, request: TestConnectionRequest) -> dict[str, Any]:
    """Test connection to a provider."""
    if provider not in PROVIDER_METADATA:
        raise HTTPException(status_code=404, detail=f"Unknown provider: {provider}")

    meta = PROVIDER_METADATA[provider]

    try:
        if provider == "alpaca":
            from alpaca.data import StockHistoricalDataClient
            api_key = request.credentials.get("ALPACA_API_KEY", "")
            secret_key = request.credentials.get("ALPACA_SECRET_KEY", "")
            if not api_key or not secret_key:
                return {"status": "error", "message": "API key and secret required"}
            client = StockHistoricalDataClient(api_key, secret_key)
            # Try a simple request
            from alpaca.data.requests import StockBarsRequest
            from alpaca.data.timeframe import TimeFrame
            from datetime import datetime, timedelta
            req = StockBarsRequest(
                symbol_or_symbols="AAPL",
                timeframe=TimeFrame.Day,
                start=datetime.now() - timedelta(days=5),
                end=datetime.now()
            )
            client.get_stock_bars(req)
            return {"status": "ok", "message": "Connection successful"}

        elif provider == "fred":
            from fredapi import Fred
            api_key = request.credentials.get("FRED_API_KEY", "")
            if not api_key:
                return {"status": "error", "message": "API key required"}
            fred = Fred(api_key=api_key)
            # Try fetching a simple series
            fred.get_series("DGS10", limit=1)
            return {"status": "ok", "message": "Connection successful"}

        elif provider == "polygon":
            import httpx
            api_key = request.credentials.get("POLYGON_API_KEY", "")
            if not api_key:
                return {"status": "error", "message": "API key required"}
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"https://api.polygon.io/v2/aggs/ticker/AAPL/prev",
                    params={"apiKey": api_key}
                )
                if resp.status_code == 200:
                    return {"status": "ok", "message": "Connection successful"}
                elif resp.status_code == 403:
                    return {"status": "error", "message": "Invalid API key"}
                else:
                    return {"status": "error", "message": f"API error: {resp.status_code}"}

        elif provider in ["anthropic", "openai", "google", "xai", "openrouter"]:
            # For AI providers, just validate key format
            key_name = meta["keys"][0]
            api_key = request.credentials.get(key_name, "")
            if not api_key:
                return {"status": "error", "message": "API key required"}
            # Basic format validation
            if provider == "anthropic" and not api_key.startswith("sk-ant-"):
                return {"status": "warning", "message": "Key should start with 'sk-ant-'"}
            if provider == "openai" and not api_key.startswith("sk-"):
                return {"status": "warning", "message": "Key should start with 'sk-'"}
            if provider == "openrouter" and not api_key.startswith("sk-or-"):
                return {"status": "warning", "message": "Key should start with 'sk-or-'"}
            return {"status": "ok", "message": "Key format valid (not verified with API)"}

        elif provider in ["coinbase", "yfinance"]:
            # No keys needed
            return {"status": "ok", "message": "No API key required"}

        else:
            return {"status": "warning", "message": "Connection test not implemented for this provider"}

    except ImportError as e:
        return {"status": "error", "message": f"Missing dependency: {e}"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
