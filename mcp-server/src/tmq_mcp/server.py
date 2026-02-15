from fastmcp import FastMCP
import json

from tmq_core.data import fetch_ohlcv
from tmq_core.indicators import get_indicator
from tmq_core.backtest import run_backtest, list_strategies
from tmq_core.sandbox import execute_custom_strategy, execute_analysis
from tmq_core.macro import fetch_macro, search_macro, fetch_macro_multiple, align_macro_to_prices

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


def _tmq_macro(series_id: str, start: str = "", end: str = "") -> str:
    """Fetch macroeconomic data from FRED (Federal Reserve).

    Use for interest rates, inflation (CPI/PCE), unemployment, GDP, VIX, dollar index,
    money supply, credit spreads, oil, gold. Popular series: FEDFUNDS (fed funds rate),
    DGS10 (10Y yield), T10Y2Y (yield curve), CPIAUCSL (CPI), VIXCLS (VIX),
    UNRATE (unemployment), GDP, M2SL (money supply), DCOILWTICO (oil), DEXUSEU (EUR/USD).

    Args:
        series_id: FRED series ID (e.g., FEDFUNDS, DGS10, CPIAUCSL, VIXCLS)
        start: Start date YYYY-MM-DD
        end: End date YYYY-MM-DD
    """
    df = fetch_macro(series_id, start or None, end or None)
    return df.tail(60).to_json(orient="records", date_format="iso")


def _tmq_macro_search(query: str) -> str:
    """Search FRED for economic data series by keyword.

    Use when you don't know the exact series ID.

    Args:
        query: Search query (e.g., 'consumer price index', 'housing starts', 'money supply')
    """
    return json.dumps(search_macro(query)[:10], default=str)


def _tmq_macro_backtest(
    symbol: str, code: str, macro_series: str, start: str = "", end: str = ""
) -> str:
    """Run a custom strategy conditioned on macro data.

    Provide code defining generate_signals(df, macro) where df is OHLCV data and
    macro is a DataFrame with FRED series columns aligned to trading dates.

    Args:
        symbol: Ticker or crypto pair
        code: Python code defining generate_signals(df, macro) returning (entries, exits)
        macro_series: Comma-separated FRED series IDs (e.g., "T10Y2Y,VIXCLS")
        start: Start date YYYY-MM-DD
        end: End date YYYY-MM-DD
    """
    series_list = [s.strip() for s in macro_series.split(",")]
    df = fetch_ohlcv(symbol, "1d", start or None, end or None)
    macro = fetch_macro_multiple(series_list, start or None, end or None)
    macro_aligned = align_macro_to_prices(macro, df)
    result = execute_custom_strategy(code, df, macro_data=macro_aligned)
    return json.dumps(
        {
            "metrics": result.metrics,
            "trade_count": len(result.trades),
            "macro_series_used": series_list,
        },
        default=str,
    )


# Register tools with MCP — use public names
tmq_price = mcp.tool(name="tmq_price")(_tmq_price)
tmq_indicator = mcp.tool(name="tmq_indicator")(_tmq_indicator)
tmq_backtest = mcp.tool(name="tmq_backtest")(_tmq_backtest)
tmq_backtest_custom = mcp.tool(name="tmq_backtest_custom")(_tmq_backtest_custom)
tmq_strategies = mcp.tool(name="tmq_strategies")(_tmq_strategies)
tmq_analyze = mcp.tool(name="tmq_analyze")(_tmq_analyze)
tmq_macro = mcp.tool(name="tmq_macro")(_tmq_macro)
tmq_macro_search = mcp.tool(name="tmq_macro_search")(_tmq_macro_search)
tmq_macro_backtest = mcp.tool(name="tmq_macro_backtest")(_tmq_macro_backtest)


def main():
    mcp.run()


if __name__ == "__main__":
    main()
