from fastapi import APIRouter
from pydantic import BaseModel

from tmq_core.indicators import compute_indicator, get_indicator, list_indicators

router = APIRouter(prefix="/api")


class ComputeIndicatorRequest(BaseModel):
    symbol: str
    indicator: str
    interval: str = "1d"
    start: str | None = None
    end: str | None = None
    params: dict | None = None


@router.get("/indicators")
def indicators():
    return list_indicators()


@router.post("/indicators/compute")
def compute(req: ComputeIndicatorRequest):
    result = get_indicator(
        req.symbol,
        req.indicator,
        interval=req.interval,
        start=req.start,
        end=req.end,
        **(req.params or {}),
    )
    return {"data": result.to_dict(orient="records")}
