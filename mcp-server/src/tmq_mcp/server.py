from fastmcp import FastMCP
import json

from tmq_core.data import fetch_ohlcv
from tmq_core.indicators import get_indicator
from tmq_core.backtest import run_backtest, list_strategies
from tmq_core.sandbox import execute_custom_strategy, execute_analysis

mcp = FastMCP("thats_my_quant", instructions="Quantitative trading research tools")


def _tmq_price(symbol: str, interval: str = "1d", start: str = "", end: str = "") -> str:
    """Fetch OHLCV price data for a symbol.

    Args:
        symbol: Ticker (MSFT, AAPL) or crypto pair (BTC/USDT, BTC-USD)
        interval: Candle interval — 1m, 5m, 15m, 30m, 1h, 4h, 1d, 1wk, 1mo
        start: Start date YYYY-MM-DD
        end: End date YYYY-MM-DD
    """
    df = fetch_ohlcv(symbol, interval, start, end)
    return df.tail(50).to_json(orient="records", date_format="iso")


def _tmq_indicator(
    symbol: str,
    indicator: str,
    interval: str = "1d",
    start: str = "",
    end: str = "",
    params: str = "",
) -> str:
    """Compute a technical indicator.

    Args:
        symbol: Ticker or crypto pair
        indicator: One of: rsi, sma, ema, macd, bbands, stoch, atr, adx, obv, vwap
        interval: Candle interval
        start: Start date YYYY-MM-DD
        end: End date YYYY-MM-DD
        params: JSON string of indicator params, e.g. '{"length": 14}' for RSI
    """
    extra = json.loads(params) if params else {}
    result = get_indicator(symbol, indicator, interval=interval, start=start, end=end, **extra)
    return result.tail(20).to_json(orient="records", date_format="iso")


def _tmq_backtest(
    symbol: str,
    strategy: str,
    start: str = "",
    end: str = "",
    params: str = "",
) -> str:
    """Run a template backtest strategy.

    Args:
        symbol: Ticker or crypto pair
        strategy: One of: sma_crossover, rsi_mean_reversion, momentum, buy_and_hold
        start: Start date YYYY-MM-DD
        end: End date YYYY-MM-DD
        params: JSON string of strategy params, e.g. '{"fast": 10, "slow": 30}' for sma_crossover

    Returns metrics: sharpe, max_drawdown, cagr, win_rate, total_return, total_trades, profit_factor.
    """
    extra = json.loads(params) if params else {}
    result = run_backtest(symbol, strategy, start=start, end=end, **extra)
    return json.dumps(
        {
            "metrics": result.metrics,
            "trade_count": len(result.trades),
            "trades_sample": result.trades[:10],
            "equity_start": result.equity_curve[0] if result.equity_curve else None,
            "equity_end": result.equity_curve[-1] if result.equity_curve else None,
        },
        default=str,
    )


def _tmq_backtest_custom(symbol: str, code: str, start: str = "", end: str = "") -> str:
    """Run a custom strategy with AI-generated signal code.

    Args:
        symbol: Ticker or crypto pair
        code: Python code defining generate_signals(df) that returns (entries, exits) boolean Series.
              df has columns: date, open, high, low, close, volume
        start: Start date YYYY-MM-DD
        end: End date YYYY-MM-DD
    """
    df = fetch_ohlcv(symbol, "1d", start, end)
    result = execute_custom_strategy(code, df)
    return json.dumps(
        {
            "metrics": result.metrics,
            "trade_count": len(result.trades),
            "trades_sample": result.trades[:10],
        },
        default=str,
    )


def _tmq_strategies() -> str:
    """List available template strategies with their parameters and descriptions."""
    return json.dumps(list_strategies(), default=str)


def _tmq_analyze(symbol: str, code: str, start: str = "", end: str = "") -> str:
    """Run custom analysis code against price data.

    Args:
        symbol: Ticker or crypto pair
        code: Python code defining analyze(df) that returns a dict.
              df has columns: date, open, high, low, close, volume
        start: Start date YYYY-MM-DD
        end: End date YYYY-MM-DD
    """
    df = fetch_ohlcv(symbol, "1d", start, end)
    result = execute_analysis(code, df)
    return json.dumps(result, default=str)


# Register tools with MCP — use public names
tmq_price = mcp.tool(name="tmq_price")(_tmq_price)
tmq_indicator = mcp.tool(name="tmq_indicator")(_tmq_indicator)
tmq_backtest = mcp.tool(name="tmq_backtest")(_tmq_backtest)
tmq_backtest_custom = mcp.tool(name="tmq_backtest_custom")(_tmq_backtest_custom)
tmq_strategies = mcp.tool(name="tmq_strategies")(_tmq_strategies)
tmq_analyze = mcp.tool(name="tmq_analyze")(_tmq_analyze)


def main():
    mcp.run()


if __name__ == "__main__":
    main()
