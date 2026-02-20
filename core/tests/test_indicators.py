from tmq_core.data import fetch_ohlcv
from tmq_core.indicators import compute_indicator, get_indicator, list_indicators

import pytest


@pytest.fixture(scope="module")
def msft_df():
    return fetch_ohlcv("MSFT", "1d", "2024-01-01", "2025-01-01")


def test_rsi(msft_df):
    result = compute_indicator(msft_df, "rsi", length=14)
    assert "date" in result.columns
    assert "rsi" in result.columns
    assert len(result) > 0
    assert result["rsi"].min() >= 0
    assert result["rsi"].max() <= 100


def test_sma(msft_df):
    result = compute_indicator(msft_df, "sma", length=20)
    assert "sma" in result.columns
    assert result["sma"].iloc[-1] > 0


def test_macd(msft_df):
    result = compute_indicator(msft_df, "macd", fast=12, slow=26, signal=9)
    assert "macd" in result.columns
    assert "macd_signal" in result.columns
    assert "macd_histogram" in result.columns


def test_bbands(msft_df):
    result = compute_indicator(msft_df, "bbands", length=20, std=2.0)
    assert "bb_lower" in result.columns
    assert "bb_mid" in result.columns
    assert "bb_upper" in result.columns
    # Upper should always be above lower
    assert (result["bb_upper"] >= result["bb_lower"]).all()


def test_atr(msft_df):
    result = compute_indicator(msft_df, "atr", length=14)
    assert "atr" in result.columns
    assert (result["atr"] > 0).all()


def test_get_indicator_convenience():
    """One-liner should work"""
    result = get_indicator(
        "MSFT", "rsi", interval="1d", start="2024-06-01", end="2025-01-01", length=14
    )
    assert "rsi" in result.columns
    assert len(result) > 30


def test_list_indicators():
    indicators = list_indicators()
    names = [i["name"] for i in indicators]
    assert "rsi" in names
    assert "macd" in names
    assert "bbands" in names
    assert len(indicators) >= 10


def test_no_nans(msft_df):
    """All results should have NaNs dropped"""
    result = compute_indicator(msft_df, "rsi", length=14)
    assert result["rsi"].isna().sum() == 0


def test_unknown_indicator(msft_df):
    """Should raise a clear error for unsupported indicators"""
    with pytest.raises((ValueError, KeyError)):
        compute_indicator(msft_df, "not_a_real_indicator")
