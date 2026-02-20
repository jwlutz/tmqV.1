from fastmcp import FastMCP
import json

from tmq_core.data import fetch_ohlcv, get_tradeable_universe
from tmq_core.indicators import get_indicator
from tmq_core.backtest import run_backtest, list_strategies
from tmq_core.sandbox import execute_custom_strategy, execute_analysis
from tmq_core.macro import fetch_macro, search_macro, fetch_macro_multiple, align_macro_to_prices
from tmq_core.sec import (
    fetch_filings,
    fetch_insider_transactions,
    filing_to_dict,
    form4_to_dict,
    scan_recent_form4s,
    find_cluster_buying,
)

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
    result = execute_custom_strategy(code, df, symbol=symbol)
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
    result = execute_custom_strategy(code, df, macro_data=macro_aligned, symbol=symbol)
    return json.dumps(
        {
            "metrics": result.metrics,
            "trade_count": len(result.trades),
            "macro_series_used": series_list,
        },
        default=str,
    )


# ─────────────────────────────────────────────────────────────────────────────
# SEC Tools
# ─────────────────────────────────────────────────────────────────────────────


def _tmq_sec_filings(symbol: str, form_types: str = "", limit: int = 20) -> str:
    """Fetch SEC EDGAR filings for a company.

    Args:
        symbol: Stock ticker (e.g., AAPL, MSFT)
        form_types: Comma-separated form types to filter (e.g., "10-K,8-K,4"). Leave empty for all.
        limit: Max filings to return (default 20)

    Returns filings metadata: accession_number, form_type, filing_date, description, sec_url
    """
    types_list = [t.strip() for t in form_types.split(",")] if form_types else None
    filings = fetch_filings(ticker=symbol, form_types=types_list, limit=limit)
    return json.dumps(
        {
            "symbol": symbol,
            "count": len(filings),
            "filings": [filing_to_dict(f) for f in filings],
        }
    )


def _tmq_sec_insider(symbol: str, limit: int = 20) -> str:
    """Fetch parsed insider transactions (Form 4) for a company.

    Args:
        symbol: Stock ticker
        limit: Max Form 4 filings to parse

    Returns structured insider activity: reporter name, title, transaction type, shares, price
    """
    form4s = fetch_insider_transactions(ticker=symbol, limit=limit)
    transactions = []
    for f in form4s:
        f_dict = form4_to_dict(f)
        net_shares = sum(
            t["shares"] if t["acquired"] else -t["shares"]
            for t in f_dict["transactions"]
        )
        transactions.append(
            {
                "date": f_dict["filing_date"],
                "reporter": f_dict["reporter"]["name"],
                "title": f_dict["reporter"].get("officer_title")
                or ("Director" if f_dict["reporter"]["is_director"] else "Insider"),
                "net_shares": net_shares,
                "is_buy": net_shares > 0,
            }
        )
    return json.dumps(
        {"symbol": symbol, "count": len(transactions), "insider_activity": transactions}
    )


def _tmq_sec_scan(
    days_back: int = 7, transaction_filter: str = "purchase", min_insiders: int = 1
) -> str:
    """Scan ALL Form 4 filings MARKET-WIDE for insider activity. O(1) complexity.

    Args:
        days_back: How many days to look back (max 30)
        transaction_filter: "purchase" for buys, "sale" for sells, "all" for both
        min_insiders: Minimum unique insiders per ticker to include

    Returns tickers grouped by insider activity with transaction details.
    """
    results = scan_recent_form4s(
        days_back=days_back,
        transaction_filter=transaction_filter,
        min_insiders=min_insiders,
    )
    return json.dumps(results, default=str)


def _tmq_cluster_buying(days_back: int = 7, min_insiders: int = 3) -> str:
    """Find stocks with CLUSTER insider buying (multiple insiders buying same stock).

    Args:
        days_back: How many days to look back
        min_insiders: Minimum unique insiders buying (3+ is strong signal)

    Returns stocks ranked by number of unique insider buyers.
    """
    results = find_cluster_buying(days_back=days_back, min_insiders=min_insiders)
    return json.dumps(results, default=str)


# ─────────────────────────────────────────────────────────────────────────────
# Universe Tools
# ─────────────────────────────────────────────────────────────────────────────


def _tmq_universe(exchange: str = "") -> str:
    """Get list of ALL tradeable US stocks from Alpaca (~11k symbols). O(1) complexity.

    Args:
        exchange: Optional filter (NYSE, NASDAQ, AMEX, ARCA, BATS)

    Returns list of tradeable symbols with metadata.
    """
    try:
        assets = get_tradeable_universe(exchange=exchange if exchange else None)
        tradeable = [a for a in assets if a.get("tradable")]
        return json.dumps(
            {
                "count": len(tradeable),
                "symbols": [a["symbol"] for a in tradeable],
                "sample": tradeable[:50],
            }
        )
    except ValueError as e:
        return json.dumps({"error": str(e), "hint": "Alpaca API key required"})


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

# SEC tools
tmq_sec_filings = mcp.tool(name="tmq_sec_filings")(_tmq_sec_filings)
tmq_sec_insider = mcp.tool(name="tmq_sec_insider")(_tmq_sec_insider)
tmq_sec_scan = mcp.tool(name="tmq_sec_scan")(_tmq_sec_scan)
tmq_cluster_buying = mcp.tool(name="tmq_cluster_buying")(_tmq_cluster_buying)

# Universe tools
tmq_universe = mcp.tool(name="tmq_universe")(_tmq_universe)


def main():
    mcp.run()


if __name__ == "__main__":
    main()
