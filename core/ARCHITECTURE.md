# tmq-core Architecture

The core Python library providing data fetching, indicators, and backtesting.

## Installation

```bash
cd core && pip install -e .
```

This installs `tmq-core` package with importable modules under `tmq_core`.

---

## Module: data.py

Fetches OHLCV (Open, High, Low, Close, Volume) data from multiple sources.

### Protocol

```python
class DataProvider(Protocol):
    def fetch_ohlcv(self, symbol: str, interval: str, start: str, end: str) -> pd.DataFrame:
        """Returns DataFrame with columns: date, open, high, low, close, volume"""
```

### Implementations

| Provider | Usage | Notes |
|----------|-------|-------|
| `YFinanceProvider` | Stocks + crypto (BTC-USD format) | Free, no API key |
| `CCXTProvider` | Crypto pairs (BTC/USDT format) | Uses coinbase by default |
| `AlpacaProvider` | US equities | Requires API key |

### Key Functions

```python
# Auto-detect provider by symbol format
df = fetch_ohlcv("AAPL", "1d", "2024-01-01", "2024-12-31")      # → yfinance
df = fetch_ohlcv("BTC/USDT", "1d", "2024-01-01", "2024-12-31")  # → ccxt

# Get available crypto symbols
symbols = get_available_symbols(quote="USD")  # → ["BTC/USD", "ETH/USD", ...]

# Configure Alpaca (optional)
configure_alpaca(api_key, api_secret)
```

### Output Format

```python
# DataFrame columns (always lowercase)
date     open      high      low       close     volume
2024-01-01  100.0    105.0    99.0     103.0    1000000.0
```

---

## Module: indicators.py

Computes technical indicators using pandas-ta-classic.

### Registry

Each indicator is registered in `INDICATORS` dict:

```python
INDICATORS = {
    "rsi": {
        "description": "Relative Strength Index",
        "defaults": {"length": 14},
        "call": lambda df, **p: df.ta.rsi(**p),
        "rename": {"RSI": "rsi"},
    },
    # ... more indicators
}
```

### Available Indicators

| Name | Description | Default Params |
|------|-------------|----------------|
| `rsi` | Relative Strength Index | length=14 |
| `sma` | Simple Moving Average | length=20 |
| `ema` | Exponential Moving Average | length=20 |
| `macd` | MACD | fast=12, slow=26, signal=9 |
| `bbands` | Bollinger Bands | length=20, std=2.0 |
| `stoch` | Stochastic Oscillator | k=14, d=3 |
| `atr` | Average True Range | length=14 |
| `adx` | Average Directional Index | length=14 |
| `obv` | On-Balance Volume | - |
| `vwap` | Volume Weighted Average Price | - |
| `mfi` | Money Flow Index | length=14 |
| `cci` | Commodity Channel Index | length=20 |
| `willr` | Williams %R | length=14 |
| `cmf` | Chaikin Money Flow | length=20 |
| `roc` | Rate of Change | length=10 |
| `trix` | Triple Exponential Average | length=18 |
| `ppo` | Percentage Price Oscillator | fast=12, slow=26, signal=9 |
| `aroon` | Aroon Indicator | length=25 |
| `stochrsi` | Stochastic RSI | length=14, rsi_length=14, k=3, d=3 |
| `psar` | Parabolic SAR | af0=0.02, af=0.02, max_af=0.2 |
| `kc` | Keltner Channels | length=20, scalar=2 |
| `donchian` | Donchian Channels | lower_length=20, upper_length=20 |
| `supertrend` | SuperTrend | length=7, multiplier=3.0 |
| `ichimoku` | Ichimoku Cloud | tenkan=9, kijun=26, senkou=52 |

### Key Functions

```python
# Compute indicator on existing DataFrame
result = compute_indicator(df, "rsi", length=14)

# Fetch data + compute in one call
result = get_indicator("AAPL", "macd", start="2024-01-01")

# List available indicators
indicators = list_indicators()
```

### Column Casing Gotcha

pandas-ta requires capitalized columns (Open, High, etc.).
The module handles this internally via `_capitalize_ohlcv()`.

---

## Module: backtest.py

Runs strategy backtests using vectorbt.

### Strategy Registry

```python
STRATEGIES = {
    "sma_crossover": {
        "description": "SMA crossover — buy when fast SMA crosses above slow SMA",
        "defaults": {"fast": 10, "slow": 30},
        "call": _sma_crossover,
    },
    # ... more strategies
}
```

### Available Strategies

| Name | Description | Default Params |
|------|-------------|----------------|
| `sma_crossover` | Buy when fast SMA > slow SMA | fast=10, slow=30 |
| `rsi_mean_reversion` | Buy oversold, sell overbought | length=14, oversold=30, overbought=70 |
| `momentum` | Buy when N-day return exceeds threshold | lookback=20, threshold=0.0 |
| `buy_and_hold` | Enter day 1, hold forever | - |

### Key Functions

```python
# Run a template strategy
result = run_backtest("SPY", "sma_crossover", start="2020-01-01", fast=10, slow=30)

# List available strategies
strategies = list_strategies()
```

### BacktestResult Schema

```python
class BacktestResult(BaseModel):
    symbol: str
    strategy: str
    parameters: dict
    metrics: dict  # sharpe, max_drawdown, cagr, win_rate, total_return, total_trades, profit_factor
    equity_curve: list[dict]  # [{date, equity}, ...]
    trades: list[dict]  # [{entry_date, exit_date, side, pnl, return_pct}, ...]
    provider: str  # "vectorbt"
```

### vectorbt Gotchas

- **Always pass `freq='1D'`** to Portfolio.from_signals() or sharpe_ratio fails
- Trade timestamps are integer indices — map through dates Series
- Check `np.isfinite()` before returning metrics (can be NaN/inf)

---

## Module: sandbox.py

Safe execution of AI-generated Python code.

### Security Model

1. **Restricted builtins**: Blocks `open`, `exec`, `eval`, `__import__`, etc.
2. **Import auditing**: Only allows `pandas`, `numpy`, `pandas_ta_classic`, `math`
3. **Timeout**: 30-second limit on execution

### Key Functions

```python
# Execute custom strategy code
result = execute_custom_strategy(code, df, init_cash=10000)
# Code must define: def generate_signals(df): return entries, exits

# Execute custom analysis code
result = execute_analysis(code, df)
# Code must define: def analyze(df): return dict
```

### Available in Sandbox

```python
pd       # pandas
np       # numpy
ta       # pandas_ta_classic
pandas   # alias for pd
numpy    # alias for np
```

### Not a Security Boundary

The sandbox prevents accidental damage but is not escape-proof.
Don't run untrusted code from the internet without additional sandboxing.

---

## Module: schemas.py

Pydantic models for API responses.

```python
class OHLCVData(BaseModel):
    symbol: str
    interval: str
    data: list[dict]  # [{date, open, high, low, close, volume}, ...]

class BacktestResult(BaseModel):
    symbol: str
    strategy: str
    parameters: dict
    metrics: dict
    equity_curve: list[dict]
    trades: list[dict]
    provider: str
```

---

## Adding New Indicators

1. Add entry to `INDICATORS` dict in indicators.py:

```python
"new_indicator": {
    "description": "Description here",
    "defaults": {"param1": 10},
    "call": lambda df, **p: df.ta.some_indicator(**p),
    "rename": {"ORIGINAL_NAME": "friendly_name"},
},
```

2. Test: `python -c "from tmq_core.indicators import get_indicator; print(get_indicator('AAPL', 'new_indicator'))"`

## Adding New Strategies

1. Define the signal function:

```python
def _my_strategy(close: pd.Series, df: pd.DataFrame, param1: int = 10) -> tuple[pd.Series, pd.Series]:
    # Calculate signals
    entries = ...  # boolean Series
    exits = ...    # boolean Series
    return entries.fillna(False), exits.fillna(False)
```

2. Register in `STRATEGIES` dict:

```python
"my_strategy": {
    "description": "My strategy description",
    "defaults": {"param1": 10},
    "call": _my_strategy,
},
```

3. Test: `python -c "from tmq_core.backtest import run_backtest; print(run_backtest('SPY', 'my_strategy'))"`
