from __future__ import annotations

from datetime import datetime, timedelta
from typing import Protocol

import numpy as np
import pandas as pd
import vectorbt as vbt

from tmq_core.data import fetch_ohlcv
from tmq_core.schemas import BacktestResult


# ---------------------------------------------------------------------------
# Strategy registry
# Each entry: call(close, df, **params) → (entries, exits) boolean Series
# ---------------------------------------------------------------------------


def _sma_crossover(
    close: pd.Series, df: pd.DataFrame, fast: int = 10, slow: int = 30
) -> tuple[pd.Series, pd.Series]:
    fast_sma = close.rolling(fast).mean()
    slow_sma = close.rolling(slow).mean()
    entries = (fast_sma > slow_sma) & (fast_sma.shift(1) <= slow_sma.shift(1))
    exits = (fast_sma < slow_sma) & (fast_sma.shift(1) >= slow_sma.shift(1))
    return entries.fillna(False), exits.fillna(False)


def _rsi_mean_reversion(
    close: pd.Series,
    df: pd.DataFrame,
    length: int = 14,
    oversold: int = 30,
    overbought: int = 70,
) -> tuple[pd.Series, pd.Series]:
    delta = close.diff()
    gain = delta.clip(lower=0).rolling(length).mean()
    loss = (-delta.clip(upper=0)).rolling(length).mean()
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    entries = (rsi < oversold) & (rsi.shift(1) >= oversold)
    exits = (rsi > overbought) & (rsi.shift(1) <= overbought)
    return entries.fillna(False), exits.fillna(False)


def _momentum(
    close: pd.Series, df: pd.DataFrame, lookback: int = 20, threshold: float = 0.0
) -> tuple[pd.Series, pd.Series]:
    returns = close.pct_change(lookback)
    entries = (returns > threshold) & (returns.shift(1) <= threshold)
    exits = (returns < threshold) & (returns.shift(1) >= threshold)
    return entries.fillna(False), exits.fillna(False)


def _buy_and_hold(close: pd.Series, df: pd.DataFrame) -> tuple[pd.Series, pd.Series]:
    entries = pd.Series(False, index=close.index)
    exits = pd.Series(False, index=close.index)
    entries.iloc[0] = True
    return entries, exits


STRATEGIES: dict[str, dict] = {
    "sma_crossover": {
        "description": "SMA crossover — buy when fast SMA crosses above slow SMA",
        "defaults": {"fast": 10, "slow": 30},
        "call": _sma_crossover,
    },
    "rsi_mean_reversion": {
        "description": "RSI mean reversion — buy oversold, sell overbought",
        "defaults": {"length": 14, "oversold": 30, "overbought": 70},
        "call": _rsi_mean_reversion,
    },
    "momentum": {
        "description": "Momentum — buy when N-day return exceeds threshold",
        "defaults": {"lookback": 20, "threshold": 0.0},
        "call": _momentum,
    },
    "buy_and_hold": {
        "description": "Buy and hold — enter on day 1, hold to end",
        "defaults": {},
        "call": _buy_and_hold,
    },
}


# ---------------------------------------------------------------------------
# BacktestProvider protocol + VectorBT implementation
# ---------------------------------------------------------------------------


class BacktestProvider(Protocol):
    def run(self, strategy: str, data: pd.DataFrame, **params) -> BacktestResult: ...
    def list_strategies(self) -> list[dict]: ...


def _safe_float(value: float, default: float = 0.0) -> float:
    """Return value if finite, else default."""
    return float(value) if np.isfinite(value) else default


def _extract_metrics(pf: vbt.Portfolio, init_cash: float) -> dict:
    """Extract comprehensive metrics from a vectorbt portfolio."""
    # Balance metrics
    start_balance = init_cash
    end_balance = float(pf.value().iloc[-1])
    total_return = (end_balance - start_balance) / start_balance

    # Risk-adjusted returns
    sharpe = _safe_float(pf.sharpe_ratio())
    sortino = _safe_float(pf.sortino_ratio())
    calmar = _safe_float(pf.calmar_ratio())
    omega = _safe_float(pf.omega_ratio())

    # Return metrics
    cagr = _safe_float(pf.annualized_return())

    # Risk metrics
    max_dd = _safe_float(pf.max_drawdown())
    max_dd = -abs(max_dd)  # Ensure negative representation

    # Volatility metrics
    daily_vol = _safe_float(pf.returns().std())
    annual_vol = _safe_float(pf.annualized_volatility())

    # Trade metrics
    total_trades = int(pf.trades.count())

    if total_trades > 0:
        win_rate = _safe_float(pf.trades.win_rate())
        profit_factor = _safe_float(pf.trades.profit_factor())
        avg_trade_pnl = _safe_float(pf.trades.pnl.mean())
        avg_trade_return = _safe_float(pf.trades.returns.mean())
    else:
        win_rate = 0.0
        profit_factor = 0.0
        avg_trade_pnl = 0.0
        avg_trade_return = 0.0

    return {
        # Balance
        "start_balance": start_balance,
        "end_balance": end_balance,
        "total_return": total_return,
        # Risk-adjusted returns
        "sharpe": sharpe,
        "sortino": sortino,
        "calmar": calmar,
        "omega_ratio": omega,
        # Return metrics
        "cagr": cagr,
        # Risk metrics
        "max_drawdown": max_dd,
        "daily_volatility": daily_vol,
        "annual_volatility": annual_vol,
        # Trade metrics
        "total_trades": total_trades,
        "win_rate": win_rate,
        "profit_factor": profit_factor,
        "avg_trade_pnl": avg_trade_pnl,
        "avg_trade_return": avg_trade_return,
    }


def _extract_equity_curve(pf: vbt.Portfolio, dates: pd.Series) -> list[dict]:
    """Build equity curve list from portfolio value series."""
    values = pf.value()
    return [
        {"date": str(dates.iloc[i]), "equity": float(values.iloc[i])}
        for i in range(len(values))
    ]


def _extract_trades(pf: vbt.Portfolio, dates: pd.Series) -> list[dict]:
    """Extract trade records."""
    trades_df = pf.trades.records_readable
    result = []
    for _, row in trades_df.iterrows():
        entry_idx = (
            int(row["Entry Timestamp"])
            if isinstance(row["Entry Timestamp"], (int, float, np.integer))
            else 0
        )
        exit_idx = (
            int(row["Exit Timestamp"])
            if isinstance(row["Exit Timestamp"], (int, float, np.integer))
            else len(dates) - 1
        )
        entry_idx = min(entry_idx, len(dates) - 1)
        exit_idx = min(exit_idx, len(dates) - 1)
        result.append(
            {
                "entry_date": str(dates.iloc[entry_idx]),
                "exit_date": str(dates.iloc[exit_idx]),
                "side": str(row["Direction"]).lower(),
                "pnl": float(row["PnL"]),
                "return_pct": float(row["Return"]),
            }
        )
    return result


class VectorBTProvider:
    def run(
        self,
        strategy: str,
        data: pd.DataFrame,
        init_cash: float = 10000.0,
        **params,
    ) -> BacktestResult:
        name = strategy.lower()
        if name not in STRATEGIES:
            raise ValueError(
                f"Unknown strategy '{strategy}'. Use list_strategies() to see options."
            )

        symbol = params.pop("_symbol", "")
        timeframe = params.pop("_timeframe", "1d")
        spec = STRATEGIES[name]
        merged = {**spec["defaults"], **params}

        close = data["close"].astype(float).reset_index(drop=True)
        dates = data["date"].reset_index(drop=True)

        entries, exits = spec["call"](close, data, **merged)
        entries = entries.astype(bool).reset_index(drop=True)
        exits = exits.astype(bool).reset_index(drop=True)

        pf = vbt.Portfolio.from_signals(
            close, entries, exits, init_cash=init_cash, freq="1D"
        )

        # Extract date range for metadata
        start_date = str(dates.iloc[0]) if len(dates) > 0 else None
        end_date = str(dates.iloc[-1]) if len(dates) > 0 else None
        generated_at = datetime.now().isoformat()

        return BacktestResult(
            symbol=symbol,
            strategy=name,
            parameters=merged,
            metrics=_extract_metrics(pf, init_cash),
            equity_curve=_extract_equity_curve(pf, dates),
            trades=_extract_trades(pf, dates),
            provider="vectorbt",
            start_date=start_date,
            end_date=end_date,
            timeframe=timeframe,
            generated_at=generated_at,
        )

    def list_strategies(self) -> list[dict]:
        return [
            {
                "name": name,
                "description": spec["description"],
                "default_params": spec["defaults"],
            }
            for name, spec in STRATEGIES.items()
        ]


# ---------------------------------------------------------------------------
# Convenience functions
# ---------------------------------------------------------------------------

_provider = VectorBTProvider()


def run_backtest(
    symbol: str,
    strategy: str,
    interval: str = "1d",
    start: str | None = None,
    end: str | None = None,
    init_cash: float = 10000.0,
    **params,
) -> BacktestResult:
    """One-liner: fetch data, run strategy, return result.

    Args:
        symbol: Ticker symbol (e.g., "AAPL", "BTC-USD")
        strategy: Strategy name (e.g., "sma_crossover")
        interval: Data interval (e.g., "1d", "1h")
        start: Start date (YYYY-MM-DD), defaults to 1 year ago
        end: End date (YYYY-MM-DD), defaults to today
        init_cash: Initial cash balance (default: 10000.0)
        **params: Strategy-specific parameters
    """
    if end is None:
        end = datetime.now().strftime("%Y-%m-%d")
    if start is None:
        start = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")

    df = fetch_ohlcv(symbol, interval, start, end)
    params["_symbol"] = symbol
    params["_timeframe"] = interval
    return _provider.run(strategy, df, init_cash=init_cash, **params)


def list_strategies() -> list[dict]:
    """Return available strategies with descriptions and default params."""
    return _provider.list_strategies()
