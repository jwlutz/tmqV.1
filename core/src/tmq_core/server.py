from __future__ import annotations

import json
import time
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, Query, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from tmq_core.data import fetch_ohlcv, get_available_symbols

app = FastAPI(title="TMQ Core API")

# Rate limiting for feature requests: track last request time by IP
_request_rate_limit: dict[str, float] = {}
RATE_LIMIT_SECONDS = 60
MAX_MESSAGE_LENGTH = 2000
FEATURE_REQUESTS_FILE = Path(__file__).parent.parent.parent.parent / "feature_requests.json"


class FeatureRequestBody(BaseModel):
    message: str = Field(..., max_length=MAX_MESSAGE_LENGTH)

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


@app.post("/api/feature-request")
def feature_request(body: FeatureRequestBody, request: Request):
    """Submit a feature request. Rate limited to 1 per minute per IP."""
    client_ip = request.client.host if request.client else "unknown"
    now = time.time()

    # Check rate limit
    last_request = _request_rate_limit.get(client_ip, 0)
    if now - last_request < RATE_LIMIT_SECONDS:
        remaining = int(RATE_LIMIT_SECONDS - (now - last_request))
        raise HTTPException(
            status_code=429,
            detail=f"Rate limited. Please wait {remaining} seconds before submitting another request.",
        )

    # Update rate limit tracker
    _request_rate_limit[client_ip] = now

    # Load existing requests or create new list
    requests_list: list[dict] = []
    if FEATURE_REQUESTS_FILE.exists():
        try:
            requests_list = json.loads(FEATURE_REQUESTS_FILE.read_text())
        except (json.JSONDecodeError, OSError):
            requests_list = []

    # Append new request
    requests_list.append({
        "timestamp": datetime.utcnow().isoformat(),
        "ip": client_ip,
        "message": body.message.strip(),
    })

    # Save back to file
    FEATURE_REQUESTS_FILE.write_text(json.dumps(requests_list, indent=2))

    return {"status": "ok", "message": "Feature request submitted successfully"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("tmq_core.server:app", host="0.0.0.0", port=8000, reload=True)
