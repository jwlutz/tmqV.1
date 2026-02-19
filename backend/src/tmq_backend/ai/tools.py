TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "tmq_price",
            "description": (
                "Fetch OHLCV price DATA for analysis (returns numbers only, does NOT change the chart). "
                "Use tmq_set_symbol to VISUALLY change what symbol the chart displays."
            ),
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
            "description": (
                "Fetch indicator DATA for analysis (returns numbers only, does NOT display on chart). "
                "Use tmq_apply_indicator to VISUALLY overlay an indicator on the chart. "
                "This tool is for getting raw values to discuss or analyze."
            ),
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
    # === SEC Filings Tools ===
    {
        "type": "function",
        "function": {
            "name": "tmq_sec_filings",
            "description": (
                "Fetch SEC EDGAR filings for a company. Returns filings metadata like 10-K, 10-Q, "
                "8-K, Form 4 (insider transactions), 13F, proxy statements, etc. "
                "Use tmq_sec_insider for detailed insider transaction data."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "symbol": {
                        "type": "string",
                        "description": "Stock ticker symbol (e.g., AAPL, MSFT, TSLA)",
                    },
                    "form_types": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": (
                            "Filter by form types. Common: 10-K (annual), 10-Q (quarterly), "
                            "8-K (current events), 4 (insider trades), 13F-HR (institutional holdings), "
                            "DEF 14A (proxy). Omit to get all types."
                        ),
                    },
                    "limit": {
                        "type": "integer",
                        "default": 20,
                        "description": "Max number of filings to return",
                    },
                },
                "required": ["symbol"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "tmq_sec_insider",
            "description": (
                "Fetch and parse insider transactions (Form 4) for a company. Returns structured "
                "data about insider buys/sells including reporter name, title, shares, price, "
                "and transaction type. Great for tracking executive and director activity."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "symbol": {
                        "type": "string",
                        "description": "Stock ticker symbol",
                    },
                    "limit": {
                        "type": "integer",
                        "default": 20,
                        "description": "Max number of Form 4 filings to return",
                    },
                },
                "required": ["symbol"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "tmq_sec_read",
            "description": (
                "Read the content of an SEC filing. For Form 4, returns parsed transaction data. "
                "For other forms (10-K, 10-Q, 8-K), returns a text excerpt of the filing content."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "symbol": {
                        "type": "string",
                        "description": "Stock ticker symbol",
                    },
                    "accession_number": {
                        "type": "string",
                        "description": "SEC accession number (e.g., 0000320193-24-000081)",
                    },
                },
                "required": ["symbol", "accession_number"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "tmq_sec_scan",
            "description": (
                "Scan ALL Form 4 filings MARKET-WIDE for insider activity. O(1) complexity — "
                "this is the efficient way to find stocks with insider buying/selling. "
                "PREFER THIS over iterating tickers when looking for insider signals across the market. "
                "Returns tickers grouped by insider activity with transaction details."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "days_back": {
                        "type": "integer",
                        "default": 7,
                        "description": "How many days to look back (max 90)",
                    },
                    "transaction_filter": {
                        "type": "string",
                        "enum": ["purchase", "sale", "all"],
                        "default": "purchase",
                        "description": "Filter by transaction type: 'purchase' for buys, 'sale' for sells, 'all' for both",
                    },
                    "min_insiders": {
                        "type": "integer",
                        "default": 1,
                        "description": "Minimum unique insiders per ticker to include (use 3+ for cluster buying)",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "tmq_cluster_buying",
            "description": (
                "Find stocks with CLUSTER insider buying — multiple different insiders buying the same stock. "
                "This is a strong bullish signal. Returns stocks ranked by number of unique insider buyers."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "days_back": {
                        "type": "integer",
                        "default": 7,
                        "description": "How many days to look back",
                    },
                    "min_insiders": {
                        "type": "integer",
                        "default": 3,
                        "description": "Minimum unique insiders buying (3+ is strong signal)",
                    },
                },
            },
        },
    },
    # === Universe Tools ===
    {
        "type": "function",
        "function": {
            "name": "tmq_universe",
            "description": (
                "Get list of all tradeable US stocks from Alpaca (~11,000 symbols). O(1) complexity. "
                "Use this when you need a stock universe for scanning or filtering. "
                "Can filter by exchange (NYSE, NASDAQ) or tradability."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "exchange": {
                        "type": "string",
                        "enum": ["NYSE", "NASDAQ", "AMEX", "ARCA", "BATS"],
                        "description": "Filter by exchange (optional)",
                    },
                    "tradable_only": {
                        "type": "boolean",
                        "default": True,
                        "description": "Only include currently tradeable stocks",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "tmq_capabilities",
            "description": (
                "Get the current data provider capabilities matrix. Shows which providers are active "
                "and what data they can provide. Use to understand data availability before planning queries."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
    # === UI Control Tools ===
    {
        "type": "function",
        "function": {
            "name": "tmq_set_widget",
            "description": (
                "Change a chart pane's widget type. Use to show different views. "
                "If pane_id is omitted, changes the active/focused pane. "
                "Widget types: candlestick, yield_curve, net_liquidity, credit_spreads, "
                "vix_term_structure, fundamentals, macro_regime, sector_heatmap, "
                "correlation_matrix, economic_calendar, sentiment_gauge."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "widget_type": {
                        "type": "string",
                        "enum": [
                            "candlestick", "yield_curve", "net_liquidity", "credit_spreads",
                            "vix_term_structure", "fundamentals", "macro_regime",
                            "sector_heatmap", "correlation_matrix", "economic_calendar",
                            "sentiment_gauge"
                        ],
                        "description": "The widget type to display",
                    },
                    "pane_id": {
                        "type": "string",
                        "description": "Target pane ID (e.g., 'pane-1'). Omit to use the active/focused pane.",
                    },
                },
                "required": ["widget_type"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "tmq_set_layout",
            "description": (
                "Change the chart grid layout or apply a preset dashboard. "
                "Layouts: 1x1 (single chart), 1x2 (two side-by-side), 2x2 (four charts). "
                "Presets: trading (multi-chart), macro (yields/liquidity/spreads), "
                "research (fundamentals/correlation), sentiment (VIX/sentiment)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "layout": {
                        "type": "string",
                        "enum": ["1x1", "1x2", "2x2"],
                        "description": "Grid layout",
                    },
                    "preset": {
                        "type": "string",
                        "enum": ["trading", "macro", "research", "sentiment"],
                        "description": "Dashboard preset (overrides layout)",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "tmq_set_symbol",
            "description": (
                "VISUALLY change the symbol displayed in a chart pane. This updates what the user sees. "
                "If pane_id is omitted, changes the active/focused pane. "
                "Use this when asked to 'show' or 'display' a different symbol."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "symbol": {
                        "type": "string",
                        "description": "Ticker symbol (e.g., 'AAPL', 'BTC-USD', 'ETH/USDT')",
                    },
                    "pane_id": {
                        "type": "string",
                        "description": "Target pane ID. Omit to use the active/focused pane.",
                    },
                },
                "required": ["symbol"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "tmq_toggle_code_panel",
            "description": "Open or close the code editor panel.",
            "parameters": {
                "type": "object",
                "properties": {
                    "open": {
                        "type": "boolean",
                        "description": "True to open, False to close. Omit to toggle.",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "tmq_open_tab",
            "description": (
                "Open a new workspace tab. Tab types: chart (price chart), chat (AI assistant), "
                "code (strategy editor), backtest (results viewer), rot (research notes), "
                "sec (SEC EDGAR filings viewer). This VISUALLY opens a new tab in the UI."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "tab_type": {
                        "type": "string",
                        "enum": ["chart", "chat", "code", "backtest", "rot", "sec"],
                        "description": "Type of tab to open",
                    },
                },
                "required": ["tab_type"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "tmq_apply_indicator",
            "description": (
                "Toggle a technical indicator ON/OFF on the active chart. This VISUALLY overlays "
                "the indicator on the candlestick chart. Available indicators: sma, ema, wma, rsi, "
                "macd, bbands (Bollinger Bands), stoch (Stochastic), atr, adx, obv, vwap, cci, "
                "williams_r, roc, mom (Momentum), trix, dpo. Use 'volume' to toggle volume bars."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "indicator": {
                        "type": "string",
                        "enum": [
                            "sma", "ema", "wma", "rsi", "macd", "bbands", "stoch", "atr",
                            "adx", "obv", "vwap", "cci", "williams_r", "roc", "mom", "trix",
                            "dpo", "volume"
                        ],
                        "description": "Indicator to toggle on/off the chart",
                    },
                    "pane_id": {
                        "type": "string",
                        "description": "Target chart pane ID. Omit to use the active pane.",
                    },
                },
                "required": ["indicator"],
            },
        },
    },
]
