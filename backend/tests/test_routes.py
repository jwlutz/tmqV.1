from fastapi.testclient import TestClient

from tmq_backend.main import app

client = TestClient(app)


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_fetch_ohlcv():
    r = client.get(
        "/api/data/ohlcv",
        params={
            "symbol": "MSFT",
            "interval": "1d",
            "start": "2024-06-01",
            "end": "2024-07-01",
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert len(data["data"]) > 10


def test_list_indicators():
    r = client.get("/api/indicators")
    assert r.status_code == 200
    names = [i["name"] for i in r.json()]
    assert "rsi" in names


def test_compute_indicator():
    r = client.post(
        "/api/indicators/compute",
        json={
            "symbol": "MSFT",
            "indicator": "rsi",
            "interval": "1d",
            "start": "2024-06-01",
            "end": "2024-12-31",
            "params": {"length": 14},
        },
    )
    assert r.status_code == 200
    assert len(r.json()["data"]) > 10


def test_run_backtest():
    r = client.post(
        "/api/backtest",
        json={
            "symbol": "MSFT",
            "strategy": "sma_crossover",
            "start": "2023-01-01",
            "end": "2024-12-31",
            "params": {"fast": 10, "slow": 30},
        },
    )
    assert r.status_code == 200
    result = r.json()
    assert "metrics" in result
    assert "equity_curve" in result
    assert len(result["equity_curve"]) > 100
    assert result["metrics"]["sharpe"] != 0


def test_custom_backtest():
    r = client.post(
        "/api/backtest/custom",
        json={
            "symbol": "MSFT",
            "code": """
def generate_signals(df):
    fast = df['close'].rolling(10).mean()
    slow = df['close'].rolling(30).mean()
    entries = (fast > slow) & (fast.shift(1) <= slow.shift(1))
    exits = (fast < slow) & (fast.shift(1) >= slow.shift(1))
    return entries.fillna(False), exits.fillna(False)
""",
            "start": "2023-01-01",
            "end": "2024-12-31",
        },
    )
    assert r.status_code == 200
    assert r.json()["metrics"]["total_trades"] > 0


def test_list_strategies():
    r = client.get("/api/strategies")
    assert r.status_code == 200
    names = [s["name"] for s in r.json()]
    assert "sma_crossover" in names
    assert "buy_and_hold" in names
