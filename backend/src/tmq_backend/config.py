"""Configuration management with .env support."""
from __future__ import annotations

import os
from pathlib import Path
from functools import lru_cache


def _find_env_file() -> Path | None:
    """Find .env file starting from backend dir, going up to project root."""
    current = Path(__file__).resolve().parent
    for _ in range(5):  # Max 5 levels up
        env_path = current / ".env"
        if env_path.exists():
            return env_path
        current = current.parent
    return None


def _load_env_file():
    """Load .env file into os.environ if not already loaded."""
    env_path = _find_env_file()
    if env_path and env_path.exists():
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, _, value = line.partition("=")
                    key, value = key.strip(), value.strip()
                    # Only set if not already in environment
                    if key not in os.environ:
                        os.environ[key] = value


# Load env on module import
_load_env_file()


# Provider configuration - maps provider name to env var name
PROVIDER_ENV_VARS = {
    "anthropic": "ANTHROPIC_API_KEY",
    "openai": "OPENAI_API_KEY",
    "openrouter": "OPENROUTER_API_KEY",
    "google": "GOOGLE_API_KEY",
    "xai": "XAI_API_KEY",
}


@lru_cache(maxsize=1)
def get_configured_providers() -> dict[str, bool]:
    """Return dict of provider names to whether they're configured."""
    return {
        provider: bool(os.environ.get(env_var))
        for provider, env_var in PROVIDER_ENV_VARS.items()
    }


def get_api_key(provider: str) -> str | None:
    """Get API key for a provider from environment."""
    env_var = PROVIDER_ENV_VARS.get(provider)
    if env_var:
        return os.environ.get(env_var)
    return None


def clear_provider_cache():
    """Clear the provider cache (useful after env changes)."""
    get_configured_providers.cache_clear()