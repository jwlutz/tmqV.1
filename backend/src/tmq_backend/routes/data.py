from fastapi import APIRouter, Query

from tmq_core.data import fetch_ohlcv, get_available_symbols

router = APIRouter(prefix="/api")

_symbols_cache: list[str] | None = None


@router.get("/symbols")
def symbols(quote: str = Query("USD")) -> list[str]:
    global _symbols_cache
    if _symbols_cache is None:
        _symbols_cache = get_available_symbols(quote)
    return _symbols_cache


@router.get("/data/ohlcv")
def ohlcv(
    symbol: str = Query(..., description="e.g. BTC/USD or MSFT"),
    interval: str = Query("1d"),
    start: str = Query(..., description="YYYY-MM-DD"),
    end: str = Query(..., description="YYYY-MM-DD"),
) -> dict:
    df = fetch_ohlcv(symbol, interval, start, end)
    return {
        "symbol": symbol,
        "interval": interval,
        "data": df.to_dict(orient="records"),
    }
