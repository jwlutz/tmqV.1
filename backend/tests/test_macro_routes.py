import os

import pytest
from fastapi.testclient import TestClient

from tmq_backend.main import app

client = TestClient(app)


def test_popular_series():
    r = client.get("/api/macro/series")
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 20
    ids = [s["id"] for s in data]
    assert "FEDFUNDS" in ids


FRED_KEY = os.environ.get("FRED_API_KEY", "")


@pytest.mark.skipif(not FRED_KEY, reason="No FRED key")
def test_configure_and_fetch():
    # Configure
    r = client.post("/api/macro/configure", json={"api_key": FRED_KEY})
    assert r.status_code == 200

    # Fetch
    r = client.post(
        "/api/macro/fetch",
        json={"series_id": "DGS10", "start": "2024-06-01", "end": "2024-12-31"},
    )
    assert r.status_code == 200
    data = r.json()
    assert len(data["data"]) > 50


def test_fetch_without_config():
    """Should return 400 if FRED not configured"""
    import tmq_core.macro as m

    m._fred_provider = None  # Reset

    r = client.post("/api/macro/fetch", json={"series_id": "DGS10"})
    assert r.status_code == 400
