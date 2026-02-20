from tmq_core.data import (
    fetch_ohlcv,
    get_provider,
    get_available_symbols,
    YFinanceProvider,
    CCXTProvider,
)


EXPECTED_COLUMNS = ["date", "open", "high", "low", "close", "volume"]


def test_yfinance_stock():
    df = fetch_ohlcv("MSFT", "1d", "2024-01-01", "2024-06-01")
    assert len(df) > 50
    assert list(df.columns) == ["date", "open", "high", "low", "close", "volume"]
    assert df["close"].iloc[-1] > 0


def test_yfinance_crypto():
    df = fetch_ohlcv("BTC-USD", "1d", "2024-01-01", "2024-06-01")
    assert len(df) > 50
    assert df["close"].iloc[-1] > 1000


def test_ccxt_crypto():
    df = fetch_ohlcv("BTC/USDT", "1d", "2024-01-01", "2024-06-01")
    assert len(df) > 50
    assert df["close"].iloc[-1] > 1000


def test_auto_detect():
    """get_provider should return YFinanceProvider for 'MSFT' and CCXTProvider for 'BTC/USDT'"""
    assert isinstance(get_provider("MSFT"), YFinanceProvider)
    assert isinstance(get_provider("BTC/USDT"), CCXTProvider)


def test_get_available_symbols():
    """get_available_symbols should return a sorted list of USD pairs from Coinbase"""
    symbols = get_available_symbols("USD")
    assert len(symbols) > 100
    assert "BTC/USD" in symbols
    assert "ETH/USD" in symbols
    assert all("/" in s for s in symbols)


def test_dataframe_consistency():
    """Both providers should return the same column format"""
    df1 = fetch_ohlcv("BTC-USD", "1d", "2024-06-01", "2024-06-15")
    df2 = fetch_ohlcv("BTC/USDT", "1d", "2024-06-01", "2024-06-15")
    assert list(df1.columns) == list(df2.columns)
    assert df1["close"].dtype == df2["close"].dtype


# ─────────────────────────────────────────────────────────────────────────────
# Error Handling Tests - Providers should never crash, always return valid schema
# ─────────────────────────────────────────────────────────────────────────────


def test_yfinance_invalid_symbol_returns_empty_df():
    """YFinanceProvider should return empty DataFrame with correct schema for invalid symbols"""
    provider = YFinanceProvider()
    df = provider.fetch_ohlcv("INVALID_SYMBOL_XYZ123", "1d", "2024-01-01", "2024-01-10")

    # Should not crash, should return empty DataFrame with correct schema
    assert list(df.columns) == EXPECTED_COLUMNS
    assert len(df) == 0


def test_ccxt_invalid_symbol_returns_empty_df():
    """CCXTProvider should return empty DataFrame with correct schema for invalid symbols"""
    provider = CCXTProvider()
    df = provider.fetch_ohlcv("INVALID/SYMBOL", "1d", "2024-01-01", "2024-01-10")

    # Should not crash, should return empty DataFrame with correct schema
    assert list(df.columns) == EXPECTED_COLUMNS
    assert len(df) == 0


def test_yfinance_future_date_returns_empty_df():
    """YFinanceProvider should return empty DataFrame for future dates"""
    provider = YFinanceProvider()
    df = provider.fetch_ohlcv("MSFT", "1d", "2099-01-01", "2099-01-10")

    # Should not crash, should return empty DataFrame with correct schema
    assert list(df.columns) == EXPECTED_COLUMNS
    assert len(df) == 0


def test_ccxt_future_date_returns_empty_df():
    """CCXTProvider should return empty DataFrame for future dates"""
    provider = CCXTProvider()
    df = provider.fetch_ohlcv("BTC/USDT", "1d", "2099-01-01", "2099-01-10")

    # Should not crash, should return empty DataFrame with correct schema
    assert list(df.columns) == EXPECTED_COLUMNS
    assert len(df) == 0


def test_all_providers_have_retry_constants():
    """All providers should have retry configuration"""
    assert hasattr(YFinanceProvider, "MAX_RETRIES")
    assert hasattr(YFinanceProvider, "RETRY_DELAYS")
    assert hasattr(CCXTProvider, "MAX_RETRIES")
    assert hasattr(CCXTProvider, "RETRY_DELAYS")

    # Verify retry config values
    assert YFinanceProvider.MAX_RETRIES == 3
    assert CCXTProvider.MAX_RETRIES == 3
    assert len(YFinanceProvider.RETRY_DELAYS) == 3
    assert len(CCXTProvider.RETRY_DELAYS) == 3
