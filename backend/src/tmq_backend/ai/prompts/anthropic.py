"""
Anthropic (Claude) prompt formatting.

Claude responds best to XML-tagged structure. This is because XML tags
were prevalent in Claude's training data — Anthropic uses them heavily
in their own prompts.
"""

from .base import ROLE, TOOL_GUIDANCE, CONSTRAINTS, AGENTIC_INSTRUCTIONS, EXAMPLES


def format_environment(env: dict) -> str:
    """Format environment block in XML for Claude."""
    market_status = "US markets are open" if env.get("market_open") else "US markets are closed"
    return f"""<environment>
Current datetime: {env['datetime_iso']}
Human-readable: {env['datetime_human']}
Year: {env['year']}
Market status: {market_status}
Platform: thats_my_quant v2.0
</environment>"""


def format_capabilities(env: dict) -> str:
    """Format data provider capabilities matrix in XML for Claude."""
    matrix = env.get("capabilities_matrix", "")
    if not matrix:
        return ""
    return f"""<data_providers>
{matrix}
</data_providers>"""


def format_role() -> str:
    """Format role in XML."""
    return f"<role>\n{ROLE}\n</role>"


def format_tool_guidance() -> str:
    """Format tool guidance in XML."""
    lines = ["<tool_guidance>"]
    for tool, desc in TOOL_GUIDANCE.items():
        lines.append(f"- {tool}: {desc}")
    lines.append("</tool_guidance>")
    return "\n".join(lines)


def format_constraints() -> str:
    """Format constraints in XML."""
    lines = ["<constraints>"]
    for c in CONSTRAINTS:
        lines.append(f"- {c}")
    for a in AGENTIC_INSTRUCTIONS:
        lines.append(f"- {a}")
    lines.append("</constraints>")
    return "\n".join(lines)


def format_examples() -> str:
    """Format few-shot examples in XML.

    Note: We use 'reasoning' instead of 'thinking' for Claude 4.5 compatibility.
    """
    lines = ["<examples>"]
    for i, ex in enumerate(EXAMPLES, 1):
        lines.append(f"<example_{i}>")
        lines.append(f"User: {ex['user']}")
        lines.append(f"Assistant reasoning: {ex['assistant_reasoning']}")
        if "tool_call" in ex:
            lines.append(f"Tool call: {ex['tool_call']}")
        if "assistant_response" in ex:
            lines.append(f"Response format example:\n{ex['assistant_response']}")
        lines.append(f"</example_{i}>")
    lines.append("</examples>")
    return "\n".join(lines)


def build_system_prompt(env: dict) -> str:
    """
    Build the complete system prompt for Claude.

    Args:
        env: Runtime environment dict with datetime, market_open, etc.

    Returns:
        XML-formatted system prompt string.
    """
    sections = [
        format_environment(env),
        format_role(),
        format_capabilities(env),
        format_tool_guidance(),
        format_constraints(),
        format_examples(),
    ]
    # Filter out empty sections
    sections = [s for s in sections if s]
    return "\n\n".join(sections)
