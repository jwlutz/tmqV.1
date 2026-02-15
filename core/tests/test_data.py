from tmq_core.data import fetch_ohlcv, get_provider, get_available_symbols, YFinanceProvider, CCXTProvider


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
