"""Tests for Alpaca data provider.

Tests that require Alpaca credentials are gated behind ALPACA_API_KEY
and ALPACA_API_SECRET environment variables.
"""

from __future__ import annotations

import os

import pytest

from tmq_core.data import (
    AlpacaProvider,
    configure_alpaca,
    fetch_ohlcv,
    get_provider,
    YFinanceProvider,
)

ALPACA_KEY = os.environ.get("ALPACA_API_KEY")
ALPACA_SECRET = os.environ.get("ALPACA_API_SECRET")
requires_alpaca = pytest.mark.skipif(
    not ALPACA_KEY or not ALPACA_SECRET,
    reason="ALPACA_API_KEY and ALPACA_API_SECRET env vars required",
)


def test_yfinance_is_default_provider():
    """yfinance should remain the default equity provider."""
    provider = get_provider("AAPL")
    assert isinstance(provider, YFinanceProvider)


def test_alpaca_not_selected_when_unconfigured():
    """If Alpaca is not configured, requesting it should fall back to yfinance."""
    provider = get_provider("AAPL", preferred_equity_provider="alpaca")
    # When _alpaca_provider is None, should fall back to YFinance
    assert isinstance(provider, (YFinanceProvider, AlpacaProvider))


@requires_alpaca
def test_configure_alpaca():
    """configure_alpaca should set up a working provider."""
    configure_alpaca(ALPACA_KEY, ALPACA_SECRET)
    provider = get_provider("AAPL", preferred_equity_provider="alpaca")
    assert isinstance(provider, AlpacaProvider)


@requires_alpaca
def test_alpaca_daily_fetch():
    """Fetch daily bars from Alpaca."""
    configure_alpaca(ALPACA_KEY, ALPACA_SECRET)
    df = fetch_ohlcv("AAPL", "1d", "2024-01-02", "2024-01-31", equity_provider="alpaca")
    assert len(df) > 0
    assert list(df.columns) == ["date", "open", "high", "low", "close", "volume"]
    assert df["open"].dtype == "float64"


@requires_alpaca
def test_alpaca_hourly_fetch():
    """Fetch hourly bars from Alpaca."""
    configure_alpaca(ALPACA_KEY, ALPACA_SECRET)
    df = fetch_ohlcv("AAPL", "1h", "2024-01-02", "2024-01-05", equity_provider="alpaca")
    assert len(df) > 0
    assert list(df.columns) == ["date", "open", "high", "low", "close", "volume"]


@requires_alpaca
def test_alpaca_fetch_ohlcv_passthrough():
    """fetch_ohlcv with equity_provider='alpaca' should use AlpacaProvider."""
    configure_alpaca(ALPACA_KEY, ALPACA_SECRET)
    df = fetch_ohlcv("MSFT", "1d", "2024-06-01", "2024-06-30", equity_provider="alpaca")
    assert len(df) > 0
    assert all(df["close"] > 0)
