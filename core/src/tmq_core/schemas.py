from pydantic import BaseModel


class OHLCVData(BaseModel):
    symbol: str
    interval: str
    data: list[dict]  # [{date, open, high, low, close, volume}, ...]


class BacktestResult(BaseModel):
    symbol: str
    strategy: str
    parameters: dict
    metrics: dict  # sharpe, max_drawdown, cagr, win_rate, total_return, total_trades, profit_factor
    equity_curve: list[dict]  # [{date: str, equity: float}, ...]
    trades: list[dict]  # [{entry_date, exit_date, side, pnl, return_pct}, ...]
    provider: str  # "vectorbt"
