from __future__ import annotations

from datetime import datetime, timedelta
from typing import Protocol

import ccxt
import pandas as pd
import yfinance as yf
from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockBarsRequest
from alpaca.data.timeframe import TimeFrame, TimeFrameUnit

class DataProvider(Protocol):
    def fetch_ohlcv(self, symbol: str, interval: str, start: str, end: str) -> pd.DataFrame:
        """Returns DataFrame with columns: date, open, high, low, close, volume"""
        ...


class YFinanceProvider:
    def fetch_ohlcv(self, symbol: str, interval: str, start: str, end: str) -> pd.DataFrame:
        df = yf.download(symbol, start=start, end=end, interval=interval, multi_level_index=False, progress=False)
        df = df.reset_index()
        # Normalize column names to lowercase
        df.columns = [c.lower() for c in df.columns]
        # Convert date column to ISO string
        df["date"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")
        df = df[["date", "open", "high", "low", "close", "volume"]]
        # Ensure float64 for numeric columns
        for col in ["open", "high", "low", "close", "volume"]:
            df[col] = df[col].astype("float64")
        df = df.dropna().reset_index(drop=True)
        df = df.sort_values("date").reset_index(drop=True)
        return df

class CCXTProvider:
    def __init__(self, exchange_id: str = "coinbase"):
        self.exchange: ccxt.Exchange = getattr(ccxt, exchange_id)()

    def fetch_ohlcv(self, symbol: str, interval: str, start: str, end: str) -> pd.DataFrame:
        self.exchange.load_markets()
        since = self.exchange.parse8601(start + "T00:00:00Z")
        end_ts = self.exchange.parse8601(end + "T00:00:00Z")
        all_candles: list[list] = []
        while since < end_ts:
            candles = self.exchange.fetch_ohlcv(symbol, interval, since, limit=1000)
            if not candles:
                break
            # Filter out candles beyond end date
            candles = [c for c in candles if c[0] < end_ts]
            if not candles:
                break
            all_candles.extend(candles)
            since = candles[-1][0] + 1
        df = pd.DataFrame(all_candles, columns=["timestamp", "open", "high", "low", "close", "volume"])
        df["date"] = pd.to_datetime(df["timestamp"], unit="ms").dt.strftime("%Y-%m-%d")
        df = df[["date", "open", "high", "low", "close", "volume"]]
        for col in ["open", "high", "low", "close", "volume"]:
            df[col] = df[col].astype("float64")
        df = df.dropna().reset_index(drop=True)
        df = df.sort_values("date").reset_index(drop=True)
        return df


_ALPACA_INTERVAL_MAP: dict[str, TimeFrame] = {
    "1m": TimeFrame(1, TimeFrameUnit.Minute),
    "5m": TimeFrame(5, TimeFrameUnit.Minute),
    "15m": TimeFrame(15, TimeFrameUnit.Minute),
    "30m": TimeFrame(30, TimeFrameUnit.Minute),
    "1h": TimeFrame(1, TimeFrameUnit.Hour),
    "4h": TimeFrame(4, TimeFrameUnit.Hour),
    "1d": TimeFrame(1, TimeFrameUnit.Day),
    "1wk": TimeFrame(1, TimeFrameUnit.Week),
    "1mo": TimeFrame(1, TimeFrameUnit.Month),
}


class AlpacaProvider:
    def __init__(self, api_key: str, api_secret: str):
        self.client = StockHistoricalDataClient(api_key=api_key, secret_key=api_secret)

    def fetch_ohlcv(self, symbol: str, interval: str, start: str, end: str) -> pd.DataFrame:
        timeframe = _ALPACA_INTERVAL_MAP.get(interval)
        if timeframe is None:
            raise ValueError(f"Unsupported Alpaca interval: {interval}. Supported: {list(_ALPACA_INTERVAL_MAP)}")

        request = StockBarsRequest(
            symbol_or_symbols=symbol,
            timeframe=timeframe,
            start=datetime.fromisoformat(start),
            end=datetime.fromisoformat(end) + timedelta(days=1),
        )
        bars = self.client.get_stock_bars(request)
        df = bars.df.reset_index()
        df.columns = [c.lower() for c in df.columns]
        df["date"] = pd.to_datetime(df["timestamp"]).dt.strftime("%Y-%m-%d")
        df = df[["date", "open", "high", "low", "close", "volume"]]
        for col in ["open", "high", "low", "close", "volume"]:
            df[col] = df[col].astype("float64")
        df = df.dropna().reset_index(drop=True)
        df = df.sort_values("date").reset_index(drop=True)
        return df


_alpaca_provider: AlpacaProvider | None = None


def configure_alpaca(api_key: str, api_secret: str) -> None:
    """Configure the module-level Alpaca provider with credentials."""
    global _alpaca_provider
    _alpaca_provider = AlpacaProvider(api_key, api_secret)


def get_available_symbols(quote: str = "USD") -> list[str]:
    """Return sorted list of symbols available on Coinbase for a given quote currency."""
    exchange = ccxt.coinbase()
    exchange.load_markets()
    return sorted(s for s in exchange.markets if s.endswith("/" + quote))


def get_provider(symbol: str, preferred_equity_provider: str = "yfinance") -> DataProvider:
    """Auto-detect: if '/' in symbol use CCXT, otherwise use preferred equity provider."""
    if "/" in symbol:
        return CCXTProvider()
    if preferred_equity_provider == "alpaca" and _alpaca_provider is not None:
        return _alpaca_provider
    return YFinanceProvider()


def fetch_ohlcv(
    symbol: str, interval: str, start: str, end: str, equity_provider: str = "yfinance"
) -> pd.DataFrame:
    """One-liner that auto-detects provider and fetches data"""
    provider = get_provider(symbol, preferred_equity_provider=equity_provider)
    return provider.fetch_ohlcv(symbol, interval, start, end)
