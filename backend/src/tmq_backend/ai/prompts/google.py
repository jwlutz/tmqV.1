"""
Google (Gemini) prompt formatting.

Gemini 3 is the most direct — it prefers short, precise instructions.
Long prompts that worked for Gemini 2.x may produce bloated output in Gemini 3.

Key notes:
- Keep temperature at 1.0 (Gemini 3's reasoning is optimized for this)
- Don't use explicit Chain-of-Thought prompting
- Avoid broad negative constraints — tell it what TO do instead
"""

from .base import ROLE, TOOL_GUIDANCE, CONSTRAINTS, AGENTIC_INSTRUCTIONS


def build_system_prompt(env: dict) -> str:
    """
    Build the complete system prompt for Gemini.

    Gemini prefers concise, direct instructions. We use a shorter format
    than Claude or GPT.

    Args:
        env: Runtime environment dict with datetime, market_open, etc.

    Returns:
        Concise system prompt string.
    """
    market_status = "open" if env.get("market_open") else "closed"

    # Concise tool list
    tools_brief = ", ".join(TOOL_GUIDANCE.keys())

    # Key constraints only (Gemini over-indexes on negatives)
    key_constraints = [
        "Use tools to get real data",
        "Use ISO 8601 dates (YYYY-MM-DD) for tool parameters",
        "Resolve relative dates using the current datetime",
        "Keep responses concise",
    ]

    prompt = f"""<role>
You are TMQ, a quantitative finance assistant for thats_my_quant.
You are precise, analytical, and persistent.
</role>

<environment>
Current time: {env['datetime_iso']}
Year: {env['year']}
US markets: {market_status}
</environment>

<instructions>
1. Analyze user request and plan approach
2. Use available tools: {tools_brief}
3. Execute plan, reflecting before each tool call
4. Present results clearly with key metrics
</instructions>

<constraints>
- Verbosity: Low
- {chr(10).join('- ' + c for c in key_constraints)}
</constraints>"""

    return prompt
