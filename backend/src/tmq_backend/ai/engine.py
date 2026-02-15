from __future__ import annotations

import json

import litellm

from tmq_core.backtest import list_strategies, run_backtest
from tmq_core.data import fetch_ohlcv
from tmq_core.indicators import get_indicator
from tmq_core.sandbox import execute_analysis, execute_custom_strategy

from .prompts import build_prompt, get_provider_from_model, build_environment
from .tools import TOOLS

# OpenRouter base URL
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


def execute_tool(name: str, args: dict) -> str:
    """Execute a tool call and return JSON string result.

    Note: AI tools always use yfinance (free, no API key needed).
    """
    try:
        if name == "tmq_price":
            df = fetch_ohlcv(
                args["symbol"],
                args.get("interval", "1d"),
                args["start"],
                args["end"],
            )
            return df.tail(50).to_json(orient="records")

        elif name == "tmq_indicator":
            result = get_indicator(
                args["symbol"],
                args["indicator"],
                interval=args.get("interval", "1d"),
                start=args.get("start"),
                end=args.get("end"),
                **(args.get("params") or {}),
            )
            return result.tail(20).to_json(orient="records")

        elif name == "tmq_backtest":
            result = run_backtest(
                args["symbol"],
                args["strategy"],
                start=args.get("start"),
                end=args.get("end"),
                **(args.get("params") or {}),
            )
            return json.dumps({
                "metrics": result.metrics,
                "trade_count": len(result.trades),
                "trades_sample": result.trades[:10],
                "equity_start": result.equity_curve[0] if result.equity_curve else None,
                "equity_end": result.equity_curve[-1] if result.equity_curve else None,
            })

        elif name == "tmq_backtest_custom":
            df = fetch_ohlcv(
                args["symbol"], "1d", args.get("start"), args.get("end")
            )
            result = execute_custom_strategy(args["code"], df)
            return json.dumps({
                "metrics": result.metrics,
                "trade_count": len(result.trades),
                "trades_sample": result.trades[:10],
            })

        elif name == "tmq_strategies":
            return json.dumps(list_strategies())

        elif name == "tmq_analyze":
            df = fetch_ohlcv(
                args["symbol"], "1d", args.get("start"), args.get("end")
            )
            result = execute_analysis(args["code"], df)
            return json.dumps(result)

        elif name == "tmq_macro":
            from tmq_core.macro import fetch_macro

            df = fetch_macro(
                args["series_id"], args.get("start"), args.get("end")
            )
            return df.tail(60).to_json(orient="records")

        elif name == "tmq_macro_search":
            from tmq_core.macro import search_macro

            results = search_macro(args["query"])
            return json.dumps(results[:10], default=str)

        elif name == "tmq_macro_backtest":
            from tmq_core.macro import fetch_macro_multiple, align_macro_to_prices

            df = fetch_ohlcv(
                args["symbol"], "1d", args.get("start"), args.get("end")
            )
            macro = fetch_macro_multiple(
                args["macro_series"], args.get("start"), args.get("end")
            )
            macro_aligned = align_macro_to_prices(macro, df)
            result = execute_custom_strategy(
                args["code"], df, macro_data=macro_aligned
            )
            return json.dumps(
                {
                    "metrics": result.metrics,
                    "trade_count": len(result.trades),
                    "trades_sample": result.trades[:10],
                    "macro_series_used": args["macro_series"],
                },
                default=str,
            )

        return json.dumps({"error": f"Unknown tool: {name}"})

    except Exception as e:
        return json.dumps({"error": str(e)})


def _sse(event: dict) -> str:
    """Format a dict as an SSE data line."""
    return f"data: {json.dumps(event)}\n\n"


async def chat_stream(
    messages: list,
    api_key: str,
    model: str = "gpt-4o-mini",
    use_openrouter: bool = False,
):
    """
    Agentic chat loop with tool calling.

    Supports multiple AI providers with provider-specific prompts:
    - Anthropic (Claude): XML-formatted prompts
    - OpenAI (GPT): Markdown-formatted prompts
    - Google (Gemini): Concise prompts

    When use_openrouter=True, routes through OpenRouter API for unified access.

    Yields SSE-formatted strings:
      data: {"type": "text", "content": "..."}
      data: {"type": "tool_call", "name": "...", "args": {...}}
      data: {"type": "tool_result", "name": "...", "result": "..."}
      data: {"type": "done"}
    """
    # Build runtime environment context
    env = build_environment()

    # Detect provider from model name and build appropriate prompt
    provider = get_provider_from_model(model)
    system_prompt = build_prompt(provider, env)

    full_messages = [{"role": "system", "content": system_prompt}] + messages

    # Configure litellm for OpenRouter if requested
    completion_kwargs = {
        "model": model,
        "messages": full_messages,
        "tools": TOOLS,
        "stream": True,
        "api_key": api_key,
    }

    if use_openrouter:
        # Route through OpenRouter
        completion_kwargs["api_base"] = OPENROUTER_BASE_URL
        # OpenRouter models already include provider prefix (e.g., "anthropic/claude-sonnet-4")
        # Add OpenRouter-specific headers
        completion_kwargs["extra_headers"] = {
            "HTTP-Referer": "https://thats-my-quant.dev",
            "X-Title": "thats_my_quant",
        }

    max_iterations = 10
    for _ in range(max_iterations):
        # Update messages for each iteration (they grow with tool results)
        completion_kwargs["messages"] = full_messages
        response = litellm.completion(**completion_kwargs)

        # Collect all streamed chunks, then use stream_chunk_builder
        # to properly reconstruct the full response including tool calls.
        chunks = []
        collected_content = ""

        for chunk in response:
            chunks.append(chunk)
            delta = chunk.choices[0].delta
            # Stream text content to client as it arrives
            if delta.content:
                collected_content += delta.content
                yield _sse({"type": "text", "content": delta.content})

        # Use litellm's stream_chunk_builder to properly reconstruct
        # tool calls from accumulated chunks. This handles the tricky
        # accumulation of function name + arguments across chunks.
        full_response = litellm.stream_chunk_builder(chunks, messages=full_messages)
        assistant_message = full_response.choices[0].message

        tool_calls = assistant_message.tool_calls

        # If no tool calls, we're done
        if not tool_calls:
            break

        # Build the assistant message for the conversation history
        assistant_msg_dict = {
            "role": "assistant",
            "content": assistant_message.content or "",
            "tool_calls": [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    },
                }
                for tc in tool_calls
            ],
        }
        full_messages.append(assistant_msg_dict)

        # Execute each tool call and append results
        for tc in tool_calls:
            func_name = tc.function.name
            func_args = json.loads(tc.function.arguments)

            yield _sse({"type": "tool_call", "name": func_name, "args": func_args})

            result = execute_tool(func_name, func_args)

            yield _sse({"type": "tool_result", "name": func_name, "result": result})

            full_messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": result,
            })

    yield _sse({"type": "done"})
