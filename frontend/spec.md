# thats_my_quant — Technical Specification

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    tmq-frontend                          │
│              Vite + React + Tailwind                     │
│         TradingView lightweight-charts                   │
│                                                         │
│  ┌──────────────────────┐  ┌──────────────────────────┐ │
│  │   Chart Panel         │  │   Chat Sidebar           │ │
│  │   - Live candles      │  │   - Messages             │ │
│  │   - Backtest results  │  │   - Quick actions        │ │
│  │   - Equity curves     │  │   - Typing indicator     │ │
│  └──────────┬───────────┘  └────────────┬─────────────┘ │
│             │ WebSocket (live data)       │ REST (chat)   │
└─────────────┼───────────────────────────┼───────────────┘
              │                           │
┌─────────────┼───────────────────────────┼───────────────┐
│             ▼          tmq-backend      ▼               │
│                    FastAPI Server                        │
│                                                         │
│  ┌──────────────────┐  ┌──────────────────────────────┐ │
│  │  /ws/market-data  │  │  /api/chat                   │ │
│  │  WebSocket proxy   │  │  POST message → LiteLLM     │ │
│  │  Binance → Client  │  │  Tool calls → MCP client    │ │
│  └──────────────────┘  └──────────────┬───────────────┘ │
│                                       │ MCP protocol     │
│                        ┌──────────────▼───────────────┐ │
│                        │  MCP Client (mcp sdk)        │ │
│                        │  Connects to tmq MCP server  │ │
│                        └──────────────┬───────────────┘ │
└───────────────────────────────────────┼─────────────────┘
                                        │ stdio
┌───────────────────────────────────────┼─────────────────┐
│                tmq-mcp-server         ▼                 │
│           Python FastMCP Server                         │
│                                                         │
│  Tools exposed:                                         │
│  - tmq_run_backtest      (run a strategy backtest)      │
│  - tmq_list_strategies   (available strategy templates)  │
│  - tmq_get_results       (fetch backtest results)       │
│  - tmq_analyze_strategy  (statistical analysis)         │
│  - tmq_get_price_history (fetch OHLCV data)             │
│                                                         │
│  Imports from: thats_my_quant core library              │
└─────────────────────────────────────────────────────────┘
```

## Why This Architecture

**Why MCP instead of just calling Python functions directly?**

The backtesting engine as an MCP server means:
1. The same tools work in Claude Desktop, Claude Code, Cursor, etc.
2. Users can connect ANY MCP client to your engine — not just your app
3. The frontend app is just one of many possible interfaces
4. Tool schemas are self-documenting via MCP protocol
5. Clean separation: the backend doesn't need to know backtest internals

**Why LiteLLM?**

User plugs in any API key (OpenAI, Anthropic, Groq, local Ollama) and it
just works. LiteLLM normalizes the interface. You define tools once.

**Why Binance WebSocket for v1?**

Zero auth, zero setup, free real-time crypto data. The provider pattern
means adding Alpaca/Polygon later is just a new provider class.

---

## Repository Structure

```
thats_my_quant/
├── packages/
│   ├── frontend/              # Vite + React + Tailwind
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── layout/
│   │   │   │   │   ├── TopBar.tsx
│   │   │   │   │   ├── ChatSidebar.tsx
│   │   │   │   │   └── MainPanel.tsx
│   │   │   │   ├── chart/
│   │   │   │   │   ├── LiveChart.tsx         # TradingView lightweight-charts
│   │   │   │   │   ├── EquityCurveChart.tsx  # Backtest equity curve
│   │   │   │   │   └── VolumeChart.tsx
│   │   │   │   ├── backtest/
│   │   │   │   │   ├── BacktestResults.tsx
│   │   │   │   │   ├── KPIGrid.tsx
│   │   │   │   │   └── StrategyParams.tsx
│   │   │   │   └── chat/
│   │   │   │       ├── ChatMessage.tsx
│   │   │   │       ├── ChatInput.tsx
│   │   │   │       └── QuickActions.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useMarketData.ts      # WebSocket to backend
│   │   │   │   ├── useChat.ts            # Chat state + API calls
│   │   │   │   └── useBacktestResults.ts
│   │   │   ├── providers/
│   │   │   │   └── MarketDataProvider.ts  # Provider interface
│   │   │   ├── lib/
│   │   │   │   ├── api.ts                # Backend REST client
│   │   │   │   └── ws.ts                 # WebSocket client
│   │   │   ├── styles/
│   │   │   │   └── tokens.css            # CSS variables (design system)
│   │   │   ├── App.tsx
│   │   │   └── main.tsx
│   │   ├── index.html
│   │   ├── tailwind.config.ts
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── backend/               # FastAPI server
│   │   ├── src/
│   │   │   ├── main.py               # FastAPI app, CORS, lifespan
│   │   │   ├── routes/
│   │   │   │   ├── chat.py           # POST /api/chat
│   │   │   │   └── market_data.py    # WS /ws/market-data
│   │   │   ├── services/
│   │   │   │   ├── llm_service.py    # LiteLLM wrapper
│   │   │   │   ├── mcp_client.py     # MCP client → tmq tools
│   │   │   │   └── binance_ws.py     # Binance WebSocket manager
│   │   │   └── config.py             # Settings / env vars
│   │   ├── pyproject.toml
│   │   └── requirements.txt
│   │
│   └── mcp-server/            # MCP server wrapping backtesting engine
│       ├── src/
│       │   ├── server.py             # FastMCP server definition
│       │   ├── tools/
│       │   │   ├── backtest.py       # tmq_run_backtest, tmq_get_results
│       │   │   ├── strategies.py     # tmq_list_strategies
│       │   │   ├── analysis.py       # tmq_analyze_strategy
│       │   │   └── data.py           # tmq_get_price_history
│       │   └── engine/
│       │       └── __init__.py       # Imports from thats_my_quant core
│       ├── pyproject.toml
│       └── requirements.txt
│
├── .env.example
├── docker-compose.yml         # Optional: run everything together
├── Makefile                   # dev commands
└── README.md
```

---

## Phase 1: The Reel Demo (Ship Target: 1-2 weeks)

### What gets built:
1. Frontend with live BTC chart (TradingView lightweight-charts + Binance WS)
2. Chat sidebar with hardcoded quick actions
3. Backend proxying Binance WebSocket data
4. Visual mode toggle (Live ↔ Backtest) with mock backtest data

### What's mocked:
- AI chat responses (no LLM calls yet)
- Backtest results (static mock data)
- MCP server (not needed yet)

### The reel: `npm run dev` → live BTC chart streaming → type "backtest" → see results

---

## Phase 2: The Brain (2-3 weeks after Phase 1)

### What gets built:
1. MCP server wrapping your backtesting engine
2. Backend MCP client connecting to the server
3. LiteLLM integration with tool calling
4. Real backtest results flowing to frontend

### The flow:
User types "backtest momentum on BTC" →
Backend sends to LiteLLM with tool schemas →
LLM decides to call tmq_run_backtest →
Backend routes tool call through MCP client →
MCP server runs actual backtest →
Results return through the chain →
Frontend renders equity curve + KPIs

---

## Phase 3: Polish (ongoing)

- Strategy template library
- Additional data providers (Alpaca, Polygon)
- Backtest results overlaid on live chart
- Settings panel (API keys, preferences)
- Deploy (Vercel frontend + Railway/Fly backend)

---

## Key Design Decisions

### TradingView Lightweight Charts
- Package: `lightweight-charts` (v4+)
- React wrapper: `lightweight-charts` has official React API
- Use `CandlestickSeries` for OHLCV
- Use `LineSeries` for equity curves
- Use `HistogramSeries` for volume
- Theme: custom dark theme matching our design tokens

### Design Tokens (from approved mockup)
```
Background scale:  #0b0f19 → #0f1420 → #141925
Green (up/accent):  #22c55e
Red (down):         #ef4444
Border:             rgba(255,255,255,0.06)
Text primary:       #e8ecf4
Text secondary:     rgba(255,255,255,0.45)
Text tertiary:      rgba(255,255,255,0.25)
Fonts:              Plus Jakarta Sans (UI) + JetBrains Mono (numbers)
```

### MCP Tool Definitions

```python
# tmq_run_backtest
# Runs a strategy backtest on historical data
# Input: strategy_name, symbol, start_date, end_date, params (dict)
# Output: backtest_id, summary stats, equity curve data

# tmq_list_strategies
# Returns available strategy templates
# Output: list of {name, description, default_params}

# tmq_get_results
# Fetches detailed results for a completed backtest
# Input: backtest_id
# Output: full KPIs, equity curve, trade log

# tmq_analyze_strategy
# Statistical analysis (Deflated Sharpe, Monte Carlo)
# Input: backtest_id, analysis_type
# Output: analysis results

# tmq_get_price_history
# Fetches OHLCV data for a symbol
# Input: symbol, timeframe, start_date, end_date
# Output: OHLCV array
```

### WebSocket Flow (Live Data)
```
Binance WS ──→ Backend (FastAPI WS manager) ──→ Frontend (React)
  │                    │                              │
  │ Raw trades/klines  │ Normalize to OHLCV           │ Feed to TradingView
  │                    │ Fan out to connected clients  │ chart.update()
```