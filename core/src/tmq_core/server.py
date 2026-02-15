from __future__ import annotations

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from tmq_core.data import fetch_ohlcv, get_available_symbols

app = FastAPI(title="TMQ Core API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cache symbols in-process so the slow load_markets() call only happens once
_symbols_cache: list[str] | None = None


@app.get("/api/symbols")
def symbols(quote: str = Query("USD")) -> list[str]:
    global _symbols_cache
    if _symbols_cache is None:
        _symbols_cache = get_available_symbols(quote)
    return _symbols_cache


@app.get("/api/ohlcv")
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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("tmq_core.server:app", host="0.0.0.0", port=8000, reload=True)
