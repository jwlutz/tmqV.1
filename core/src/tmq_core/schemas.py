from pydantic import BaseModel


class OHLCVData(BaseModel):
    symbol: str
    interval: str
    data: list[dict]  # [{date, open, high, low, close, volume}, ...]


class BacktestResult(BaseModel):
    symbol: str
    strategy: str
    parameters: dict
    metrics: dict
    # metrics includes:
    #   start_balance, end_balance, total_return, cagr, calmar, sharpe, sortino,
    #   max_drawdown, daily_volatility, annual_volatility, omega_ratio,
    #   total_trades, win_rate, profit_factor, avg_trade_pnl, avg_trade_return
    equity_curve: list[dict]  # [{date: str, equity: float}, ...]
    trades: list[dict]  # [{entry_date, exit_date, side, pnl, return_pct}, ...]
    provider: str  # "vectorbt"
    # Metadata
    start_date: str | None = None
    end_date: str | None = None
    timeframe: str | None = None
    generated_at: str | None = None
