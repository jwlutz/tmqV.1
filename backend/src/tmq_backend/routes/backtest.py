import math

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from tmq_core.backtest import run_backtest, list_strategies
from tmq_core.data import fetch_ohlcv
from tmq_core.sandbox import execute_custom_strategy

router = APIRouter(prefix="/api")


class BacktestRequest(BaseModel):
    symbol: str
    strategy: str
    start: str | None = None
    end: str | None = None
    params: dict | None = None


class CustomBacktestRequest(BaseModel):
    symbol: str
    code: str
    start: str | None = None
    end: str | None = None


@router.get("/strategies")
def strategies():
    return list_strategies()


def _sanitize_floats(obj):
    """Replace inf/nan with None so JSON serialization doesn't fail."""
    if isinstance(obj, float) and (math.isinf(obj) or math.isnan(obj)):
        return None
    if isinstance(obj, dict):
        return {k: _sanitize_floats(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize_floats(v) for v in obj]
    return obj


@router.post("/backtest")
def backtest(req: BacktestRequest):
    result = run_backtest(
        req.symbol,
        req.strategy,
        start=req.start,
        end=req.end,
        **(req.params or {}),
    )
    # Return FULL BacktestResult — frontend needs equity_curve + all trades
    return JSONResponse(content=_sanitize_floats(result.model_dump()))


@router.post("/backtest/custom")
def backtest_custom(req: CustomBacktestRequest):
    df = fetch_ohlcv(req.symbol, "1d", req.start, req.end)
    result = execute_custom_strategy(req.code, df, symbol=req.symbol)
    # Return FULL BacktestResult
    return JSONResponse(content=_sanitize_floats(result.model_dump()))
