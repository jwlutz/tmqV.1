import pytest
from tmq_core.data import fetch_ohlcv
from tmq_core.backtest import run_backtest, list_strategies, BacktestResult


@pytest.fixture(scope="module")
def msft_df():
    return fetch_ohlcv("MSFT", "1d", "2020-01-01", "2024-12-31")


def test_sma_crossover():
    result = run_backtest(
        "MSFT", "sma_crossover", start="2020-01-01", end="2024-12-31", fast=10, slow=30
    )
    assert isinstance(result, BacktestResult)
    assert "sharpe" in result.metrics
    assert "max_drawdown" in result.metrics
    assert "total_return" in result.metrics
    assert "total_trades" in result.metrics
    assert len(result.equity_curve) > 100
    assert result.provider == "vectorbt"


def test_rsi_mean_reversion():
    result = run_backtest(
        "MSFT", "rsi_mean_reversion", start="2020-01-01", end="2024-12-31"
    )
    assert isinstance(result, BacktestResult)
    assert result.metrics["total_trades"] >= 0


def test_momentum():
    result = run_backtest(
        "MSFT", "momentum", start="2020-01-01", end="2024-12-31", lookback=20
    )
    assert isinstance(result, BacktestResult)


def test_buy_and_hold():
    result = run_backtest("MSFT", "buy_and_hold", start="2020-01-01", end="2024-12-31")
    assert isinstance(result, BacktestResult)
    # Buy and hold on MSFT 2020-2024 should be positive
    assert result.metrics["total_return"] > 0
    # Should have exactly 1 trade
    assert result.metrics["total_trades"] == 1


def test_backtest_result_structure():
    result = run_backtest("MSFT", "sma_crossover", start="2023-01-01", end="2024-12-31")
    # Equity curve should have date and equity
    assert "date" in result.equity_curve[0]
    assert "equity" in result.equity_curve[0]
    # Metrics should have all required fields
    required = [
        "sharpe",
        "max_drawdown",
        "cagr",
        "win_rate",
        "total_return",
        "total_trades",
        "profit_factor",
    ]
    for key in required:
        assert key in result.metrics, f"Missing metric: {key}"


def test_list_strategies():
    strats = list_strategies()
    names = [s["name"] for s in strats]
    assert "sma_crossover" in names
    assert "buy_and_hold" in names
    assert len(strats) == 4


def test_sharpe_is_real_number():
    """Sharpe should be a real finite number, not NaN or Inf"""
    result = run_backtest("MSFT", "sma_crossover", start="2020-01-01", end="2024-12-31")
    import math

    assert math.isfinite(result.metrics["sharpe"])
