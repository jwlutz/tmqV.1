"""
OpenAI (GPT) prompt formatting.

GPT models respond well to Markdown-structured prompts. GPT-4.1+ models
follow instructions very literally — more so than predecessors.
"""

from .base import ROLE, TOOL_GUIDANCE, CONSTRAINTS, AGENTIC_INSTRUCTIONS, EXAMPLES


def format_environment(env: dict) -> str:
    """Format environment block in Markdown for GPT."""
    market_status = "US markets are open" if env.get("market_open") else "US markets are closed"
    return f"""## Environment
- Current datetime: {env['datetime_iso']}
- Human-readable: {env['datetime_human']}
- Year: {env['year']}
- Market status: {market_status}
- Platform: thats_my_quant v2.0"""


def format_capabilities(env: dict) -> str:
    """Format data provider capabilities matrix in Markdown for GPT."""
    matrix = env.get("capabilities_matrix", "")
    if not matrix:
        return ""
    return matrix  # Already in markdown format from build_capabilities_matrix()


def format_role() -> str:
    """Format role in Markdown."""
    return f"## Role\n{ROLE}"


def format_tool_guidance() -> str:
    """Format tool guidance in Markdown."""
    lines = ["## Available Tools"]
    for tool, desc in TOOL_GUIDANCE.items():
        lines.append(f"- **{tool}**: {desc}")
    return "\n".join(lines)


def format_constraints() -> str:
    """Format constraints in Markdown."""
    lines = ["## Rules"]
    for c in CONSTRAINTS:
        lines.append(f"- {c}")
    lines.append("")
    lines.append("## Agentic Behavior")
    for a in AGENTIC_INSTRUCTIONS:
        lines.append(f"- {a}")
    return "\n".join(lines)


def format_examples() -> str:
    """Format few-shot examples in Markdown."""
    lines = ["## Examples"]
    for i, ex in enumerate(EXAMPLES, 1):
        lines.append(f"\n### Example {i}")
        lines.append(f"**User**: {ex['user']}")
        lines.append(f"**Reasoning**: {ex['assistant_reasoning']}")
        if "tool_call" in ex:
            lines.append(f"**Action**: {ex['tool_call']}")
        if "assistant_response" in ex:
            lines.append(f"**Response**:\n{ex['assistant_response']}")
    return "\n".join(lines)


def build_system_prompt(env: dict) -> str:
    """
    Build the complete system prompt for GPT.

    Args:
        env: Runtime environment dict with datetime, market_open, etc.

    Returns:
        Markdown-formatted system prompt string.
    """
    sections = [
        "# TMQ Quant Assistant",
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
