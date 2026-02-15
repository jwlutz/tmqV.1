from fastapi import APIRouter, Query
from pydantic import BaseModel

from tmq_core.data import configure_alpaca, fetch_ohlcv, get_available_symbols

router = APIRouter(prefix="/api")

_symbols_cache: list[str] | None = None


class DataProviderConfig(BaseModel):
    provider: str
    api_key: str
    api_secret: str


@router.get("/symbols")
def symbols(quote: str = Query("USD")) -> list[str]:
    global _symbols_cache
    if _symbols_cache is None:
        _symbols_cache = get_available_symbols(quote)
    return _symbols_cache


@router.post("/data/configure")
def configure_provider(config: DataProviderConfig) -> dict:
    if config.provider == "alpaca":
        configure_alpaca(config.api_key, config.api_secret)
        return {"status": "ok", "provider": "alpaca"}
    return {"status": "error", "message": f"Unknown provider: {config.provider}"}


@router.get("/data/ohlcv")
def ohlcv(
    symbol: str = Query(..., description="e.g. BTC/USD or MSFT"),
    interval: str = Query("1d"),
    start: str = Query(..., description="YYYY-MM-DD"),
    end: str = Query(..., description="YYYY-MM-DD"),
    equity_provider: str = Query("yfinance"),
) -> dict:
    df = fetch_ohlcv(symbol, interval, start, end, equity_provider=equity_provider)
    return {
        "symbol": symbol,
        "interval": interval,
        "data": df.to_dict(orient="records"),
    }
