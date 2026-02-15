# tmq-mcp

MCP (Model Context Protocol) server for **thats_my_quant** — quantitative trading research tools.

Exposes price data, technical indicators, backtesting, and custom analysis as MCP tools for Claude Desktop, ChatGPT Desktop, or any MCP client. You bring the AI, this server provides the tools.

## Installation

```bash
# Install the core library
cd tmqV.1/core && pip install -e .

# Install the MCP server
cd ../mcp-server && pip install -e .
```

## Usage with Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "thats_my_quant": {
      "command": "tmq-mcp"
    }
  }
}
```

Restart Claude Desktop. The tools will appear automatically.

## Available Tools

### tmq_price
Fetch OHLCV price data for stocks or crypto.
```
symbol: "MSFT", interval: "1d", start: "2024-01-01", end: "2024-12-31"
```

### tmq_indicator
Compute technical indicators (rsi, sma, ema, macd, bbands, stoch, atr, adx, obv, vwap).
```
symbol: "AAPL", indicator: "rsi", params: '{"length": 14}'
```

### tmq_backtest
Run template strategies (sma_crossover, rsi_mean_reversion, momentum, buy_and_hold).
```
symbol: "SPY", strategy: "sma_crossover", start: "2020-01-01", end: "2024-12-31", params: '{"fast": 10, "slow": 30}'
```

### tmq_backtest_custom
Run a custom strategy with AI-generated Python code.
```
symbol: "BTC-USD", code: "def generate_signals(df): ..."
```

### tmq_strategies
List all available template strategies with their parameters.

### tmq_analyze
Run custom analysis code against price data.
```
symbol: "MSFT", code: "def analyze(df): ..."
```

## Example Prompts

- "What's the RSI for MSFT over the past month?"
- "Backtest an SMA crossover on AAPL from 2020 to 2024"
- "Write a custom mean reversion strategy for BTC and test it"
- "Compare momentum vs buy and hold on SPY over the last 5 years"

## Development

```bash
# Test tools directly
python -c "
from tmq_mcp.server import tmq_price, tmq_strategies
import json
print(json.loads(tmq_strategies()))
"

# Inspect with MCP Inspector
npx @modelcontextprotocol/inspector tmq-mcp
```
