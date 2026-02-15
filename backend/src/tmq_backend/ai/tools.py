TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "tmq_price",
            "description": "Fetch OHLCV price data for a symbol",
            "parameters": {
                "type": "object",
                "properties": {
                    "symbol": {
                        "type": "string",
                        "description": "Ticker symbol (MSFT, AAPL) or crypto pair (BTC/USDT, BTC-USD)",
                    },
                    "interval": {
                        "type": "string",
                        "default": "1d",
                        "description": "Candle interval: 1d, 1h, etc.",
                    },
                    "start": {
                        "type": "string",
                        "description": "Start date YYYY-MM-DD",
                    },
                    "end": {
                        "type": "string",
                        "description": "End date YYYY-MM-DD",
                    },
                },
                "required": ["symbol", "start", "end"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "tmq_indicator",
            "description": "Compute a technical indicator on a symbol. Returns the last 20 values.",
            "parameters": {
                "type": "object",
                "properties": {
                    "symbol": {"type": "string"},
                    "indicator": {
                        "type": "string",
                        "description": "Indicator name: rsi, sma, ema, macd, bbands, stoch, atr, adx, obv, vwap",
                    },
                    "interval": {"type": "string", "default": "1d"},
                    "start": {"type": "string"},
                    "end": {"type": "string"},
                    "params": {
                        "type": "object",
                        "description": "Indicator params like {length: 14}",
                    },
                },
                "required": ["symbol", "indicator"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "tmq_backtest",
            "description": "Run a template backtest strategy. Available: sma_crossover, rsi_mean_reversion, momentum, buy_and_hold",
            "parameters": {
                "type": "object",
                "properties": {
                    "symbol": {"type": "string"},
                    "strategy": {"type": "string"},
                    "start": {"type": "string"},
                    "end": {"type": "string"},
                    "params": {
                        "type": "object",
                        "description": "Strategy params like {fast: 10, slow: 30}",
                    },
                },
                "required": ["symbol", "strategy"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "tmq_backtest_custom",
            "description": (
                "Run a custom strategy. Provide Python code that defines "
                "generate_signals(df) returning (entries, exits) boolean Series. "
                "The df has columns: date, open, high, low, close, volume."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "symbol": {"type": "string"},
                    "code": {
                        "type": "string",
                        "description": "Python code defining generate_signals(df)",
                    },
                    "start": {"type": "string"},
                    "end": {"type": "string"},
                },
                "required": ["symbol", "code"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "tmq_strategies",
            "description": "List available template strategies with their parameters",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "tmq_analyze",
            "description": (
                "Run custom analysis code. Provide Python code defining "
                "analyze(df) that returns a dict. "
                "The df has columns: date, open, high, low, close, volume."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "symbol": {"type": "string"},
                    "code": {
                        "type": "string",
                        "description": "Python code defining analyze(df)",
                    },
                    "start": {"type": "string"},
                    "end": {"type": "string"},
                },
                "required": ["symbol", "code"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "tmq_macro",
            "description": (
                "Fetch macroeconomic data from FRED (Federal Reserve). Use for interest rates, "
                "inflation (CPI/PCE), unemployment, GDP, VIX, dollar index, money supply, credit "
                "spreads, oil, gold. Popular series: FEDFUNDS (fed funds rate), DGS10 (10Y yield), "
                "T10Y2Y (yield curve), CPIAUCSL (CPI), VIXCLS (VIX), UNRATE (unemployment), GDP, "
                "M2SL (money supply), DCOILWTICO (oil), DEXUSEU (EUR/USD)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "series_id": {
                        "type": "string",
                        "description": "FRED series ID (e.g., FEDFUNDS, DGS10, CPIAUCSL, VIXCLS)",
                    },
                    "start": {"type": "string", "description": "Start date YYYY-MM-DD"},
                    "end": {"type": "string", "description": "End date YYYY-MM-DD"},
                },
                "required": ["series_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "tmq_macro_search",
            "description": "Search FRED for economic data series by keyword. Use when you don't know the exact series ID.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query (e.g., 'consumer price index', 'housing starts', 'money supply')",
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "tmq_macro_backtest",
            "description": (
                "Run a custom strategy conditioned on macro data. Provide code that defines "
                "generate_signals(df, macro) where df is OHLCV data and macro is a DataFrame "
                "with FRED series columns aligned to trading dates. Use for regime-conditional strategies."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "symbol": {"type": "string"},
                    "code": {
                        "type": "string",
                        "description": (
                            "Python code defining generate_signals(df, macro) returning (entries, exits). "
                            "macro has columns for each series_id requested."
                        ),
                    },
                    "macro_series": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "FRED series IDs to include as macro data (e.g., ['T10Y2Y', 'VIXCLS'])",
                    },
                    "start": {"type": "string"},
                    "end": {"type": "string"},
                },
                "required": ["symbol", "code", "macro_series"],
            },
        },
    },
]
