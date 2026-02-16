# thats_my_quant V0.1

A crypto and equities charting platform with AI-assisted backtesting.

## Quick Start

```bash
# 0. (Optionally) Initiate a venv in python 3.11
py -3.11 -m venv .venv
.\.venv\Scripts\activate
python -m pip install -U pip

# 1. Install dependencies
pip install -e .\core
pip install -e ".\backend[dev]"
pip install -e .\mcp-server
cd frontend && npm install && cd ..

# 2. Configure API keys (optional but recommended)
cp .env.example .env
# Edit .env with your API keys

# 3. Run everything
tmq
```

Open http://localhost:5173 in your browser.

## Prerequisites

- **Node.js** 18+ (for frontend)
- **Python** 3.10+ (for backend)

## Installation

### 1. Core Library

```bash
cd core
pip install -e .
```

### 2. Backend

```bash
cd backend
pip install -e .
```

### 3. Frontend

```bash
cd frontend
npm install
```

## Configuration

### API Keys (.env)

Create a `.env` file in the project root with your API keys:

```bash
# AI Providers (at least one recommended)
ANTHROPIC_API_KEY=sk-ant-...      # Anthropic (Claude)
OPENROUTER_API_KEY=sk-or-v1-...   # OpenRouter (access to all models)
OPENAI_API_KEY=sk-...             # OpenAI (GPT)
GOOGLE_API_KEY=...                # Google (Gemini)
XAI_API_KEY=...                   # xAI (Grok)

# Data Providers (optional)
ALPACA_API_KEY=...
ALPACA_SECRET_KEY=...
ALPACA_API_ENDPOINT=https://paper-api.alpaca.markets/v2
```

When you run the app, configured providers will appear in Settings with a checkmark. You can select which provider to use, or enter a custom API key.

### Running the App

**Option A: CLI (recommended)**

```bash
tmq
```

This starts both backend (port 8000) and frontend (port 5173), automatically loading `.env`.

**Option B: Manual (two terminals)**

Terminal 1 - Backend:
```bash
cd backend
uvicorn tmq_backend.main:app --reload
```

Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
```

## Providers

- **AI**: OpenAI, Anthropic, Google, xAI, OpenRouter (unified access)
- **Crypto Data**: Coinbase, Binance, Kraken, Bybit, OKX (API-key free)
- **Equity Data**: Yahoo Finance (free), Alpaca, Polygon

## Features

- **Multi-chart view**: View 1, 2, or 4 charts simultaneously
- **Crypto & Equities**: Supports BTC, ETH, stocks (AAPL, MSFT, etc.)
- **Technical indicators**: SMA, EMA, RSI, Bollinger Bands, etc.
- **AI Chat**: Ask questions about strategies (requires API key in settings)
- **Custom backtesting**: Write Python strategies in the code panel

## Usage

1. **Change symbol**: Click the ticker dropdown (top-left of chart)
2. **Add indicators**: Click "Indicators" button
3. **Multi-chart**: Use the layout buttons (top-right of chart area)
4. **Backtest**: Open the CODE panel, write a strategy, click Run
5. **Settings**: Click the gear icon to configure AI provider and data sources

## Code Panel

The code panel lets you write custom trading strategies:

```python
def generate_signals(df):
    """
    df has columns: date, open, high, low, close, volume
    Return (entries, exits) as boolean Series.
    """
    fast = df['close'].rolling(10).mean()
    slow = df['close'].rolling(30).mean()
    entries = (fast > slow) & (fast.shift(1) <= slow.shift(1))
    exits = (fast < slow) & (fast.shift(1) >= slow.shift(1))
    return entries.fillna(False), exits.fillna(False)
```

## Feature Requests

Type `/request <your idea>` in the code panel and hit Run to submit feedback.

## License

MIT
