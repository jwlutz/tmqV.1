from unittest.mock import patch

import pandas as pd
from fastapi.testclient import TestClient

from tmq_core.server import app

client = TestClient(app)

FAKE_SYMBOLS = ["BTC/USD", "ETH/USD", "SOL/USD"]

FAKE_DF = pd.DataFrame(
    {
        "date": ["2024-01-01", "2024-01-02"],
        "open": [100.0, 101.0],
        "high": [105.0, 106.0],
        "low": [99.0, 100.0],
        "close": [104.0, 105.0],
        "volume": [1000.0, 1100.0],
    }
)


@patch("tmq_core.server.get_available_symbols", return_value=FAKE_SYMBOLS)
def test_symbols_returns_list(mock_symbols):
    # Clear cache so our mock is used
    import tmq_core.server as srv
    srv._symbols_cache = None

    resp = client.get("/api/symbols")
    assert resp.status_code == 200
    data = resp.json()
    assert data == FAKE_SYMBOLS
    mock_symbols.assert_called_once()


@patch("tmq_core.server.get_available_symbols", return_value=FAKE_SYMBOLS)
def test_symbols_caches(mock_symbols):
    import tmq_core.server as srv
    srv._symbols_cache = None

    client.get("/api/symbols")
    client.get("/api/symbols")
    # Should only call the real function once due to caching
    mock_symbols.assert_called_once()

    # Clean up
    srv._symbols_cache = None


@patch("tmq_core.server.fetch_ohlcv", return_value=FAKE_DF)
def test_ohlcv_returns_data(mock_fetch):
    resp = client.get("/api/ohlcv", params={
        "symbol": "BTC/USD",
        "interval": "1d",
        "start": "2024-01-01",
        "end": "2024-01-03",
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["symbol"] == "BTC/USD"
    assert body["interval"] == "1d"
    assert len(body["data"]) == 2
    assert body["data"][0]["close"] == 104.0
    mock_fetch.assert_called_once_with("BTC/USD", "1d", "2024-01-01", "2024-01-03")


def test_ohlcv_missing_params():
    resp = client.get("/api/ohlcv")
    assert resp.status_code == 422  # FastAPI validation error
