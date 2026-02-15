# thats_my_quant V0.1

A crypto and equities charting platform with AI-assisted backtesting.

## Prerequisites

- **Node.js** 18+ (for frontend)
- **Python** 3.10+ (for backend)

### 1. Backend Setup

```bash
cd core
pip install -e .
```

### 2. Frontend Setup

```bash
cd frontend
npm install
```

### 3. Run Both Services

**Terminal 1 - Backend (port 8000):**
```bash
cd core
python -m tmq_core.server
```

**Terminal 2 - Frontend (port 5173):**
```bash
cd frontend
npm run dev
```

Open http://localhost:5173 in your browser.

Set API keys for data providers and LLM in settings.

- AI support for OpenAI, Anthropic, Gemini, Grok
- Crypto Data Support API-key free from Coinbase, Binance, Kraken, Bybit, OKX
- Data Provider support Alpaca, polygon

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
