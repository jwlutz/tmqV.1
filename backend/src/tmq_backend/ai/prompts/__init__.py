"""
Provider-specific prompt templates.

This module exports the main interface for building context-aware prompts
that are formatted appropriately for each AI provider.

Usage:
    from tmq_backend.ai.prompts import build_prompt

    prompt = build_prompt(provider="anthropic", model="claude-sonnet-4")
"""

from .anthropic import build_system_prompt as build_anthropic_prompt
from .openai import build_system_prompt as build_openai_prompt
from .google import build_system_prompt as build_google_prompt
from .context import build_environment, get_provider_from_model

__all__ = [
    "build_prompt",
    "build_environment",
    "get_provider_from_model",
]


def build_prompt(provider: str, env: dict | None = None) -> str:
    """
    Build a provider-specific system prompt with runtime context.

    Args:
        provider: One of "anthropic", "openai", "google"
        env: Optional environment dict. If None, builds fresh from current time.

    Returns:
        Formatted system prompt string appropriate for the provider.
    """
    if env is None:
        env = build_environment()

    if provider == "anthropic":
        return build_anthropic_prompt(env)
    elif provider == "openai":
        return build_openai_prompt(env)
    elif provider == "google":
        return build_google_prompt(env)
    else:
        # Default to OpenAI format for unknown providers
        return build_openai_prompt(env)
