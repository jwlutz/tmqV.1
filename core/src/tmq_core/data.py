from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta
from typing import Protocol

import ccxt
import pandas as pd
import yfinance as yf
from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockBarsRequest
from alpaca.data.timeframe import TimeFrame, TimeFrameUnit

logger = logging.getLogger(__name__)

# Intervals that require full timestamp (not just date)
# Used across all providers for consistent formatting
INTRADAY_INTERVALS = frozenset(
    {
        "1m",
        "2m",
        "5m",
        "15m",
        "30m",
        "60m",
        "90m",  # Minutes
        "1h",
        "2h",
        "4h",  # Hours
    }
)

# Supported intervals per provider:
# - YFinance: 1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo
#   (intraday limited to last 7-60 days depending on interval)
# - CCXT/Coinbase: 1m, 5m, 15m, 1h, 6h, 1d (exchange-dependent)
# - Alpaca: 1m, 5m, 15m, 30m, 1h, 4h, 1d, 1wk, 1mo

# Valid intervals per provider (for validation)
YFINANCE_INTERVALS = frozenset(
    {
        "1m",
        "2m",
        "5m",
        "15m",
        "30m",
        "60m",
        "90m",
        "1h",
        "1d",
        "5d",
        "1wk",
        "1mo",
        "3mo",
    }
)
CCXT_INTERVALS = frozenset({"1m", "5m", "15m", "1h", "6h", "1d"})
ALPACA_INTERVALS = frozenset({"1m", "5m", "15m", "30m", "1h", "4h", "1d", "1wk", "1mo"})


def validate_interval(interval: str, provider: str) -> bool:
    """Check if interval is supported by provider.

    Args:
        interval: Candle interval (e.g., "1d", "1h", "15m")
        provider: Provider name ("yfinance", "ccxt", "alpaca")

    Returns:
        True if interval is supported, False otherwise
    """
    if provider == "yfinance":
        return interval in YFINANCE_INTERVALS
    elif provider == "ccxt":
        return interval in CCXT_INTERVALS
    elif provider == "alpaca":
        return interval in ALPACA_INTERVALS
    return True  # Unknown provider, assume valid


class DataProvider(Protocol):
    def fetch_ohlcv(
        self, symbol: str, interval: str, start: str, end: str
    ) -> pd.DataFrame:
        """Returns DataFrame with columns: date, open, high, low, close, volume"""
        ...


class YFinanceProvider:
    MAX_RETRIES = 3
    RETRY_DELAYS = [1, 2, 4]  # Exponential backoff in seconds

    def fetch_ohlcv(
        self, symbol: str, interval: str, start: str, end: str
    ) -> pd.DataFrame:
        empty_df = pd.DataFrame(
            columns=["date", "open", "high", "low", "close", "volume"]
        )

        for attempt in range(self.MAX_RETRIES):
            try:
                df = yf.download(
                    symbol,
                    start=start,
                    end=end,
                    interval=interval,
                    multi_level_index=False,
                    progress=False,
                )

                # Check if download returned empty DataFrame
                if df.empty:
                    if attempt < self.MAX_RETRIES - 1:
                        delay = self.RETRY_DELAYS[attempt]
                        logger.warning(
                            f"yfinance returned empty DataFrame for {symbol}, "
                            f"retrying in {delay}s (attempt {attempt + 1}/{self.MAX_RETRIES})"
                        )
                        time.sleep(delay)
                        continue
                    else:
                        logger.warning(
                            f"yfinance returned empty DataFrame for {symbol} after "
                            f"{self.MAX_RETRIES} attempts, returning empty result"
                        )
                        return empty_df

                df = df.reset_index()
                # Normalize column names to lowercase
                df.columns = [c.lower() for c in df.columns]

                # Handle missing date column (yfinance may use 'index' or other names)
                if "date" not in df.columns:
                    # Try common alternatives
                    for alt in ["index", "datetime", "timestamp"]:
                        if alt in df.columns:
                            df = df.rename(columns={alt: "date"})
                            break
                    else:
                        logger.warning(
                            f"yfinance returned DataFrame without recognizable date column "
                            f"for {symbol}. Columns: {list(df.columns)}"
                        )
                        return empty_df

                # Convert date column to ISO string
                # For intraday intervals, preserve the full timestamp
                df["date"] = pd.to_datetime(df["date"])
                if interval in INTRADAY_INTERVALS:
                    df["date"] = df["date"].dt.strftime("%Y-%m-%dT%H:%M:%S")
                else:
                    df["date"] = df["date"].dt.strftime("%Y-%m-%d")
                df = df[["date", "open", "high", "low", "close", "volume"]]
                # Ensure float64 for numeric columns
                for col in ["open", "high", "low", "close", "volume"]:
                    df[col] = df[col].astype("float64")
                df = df.dropna().reset_index(drop=True)
                df = df.sort_values("date").reset_index(drop=True)
                return df

            except Exception as e:
                if attempt < self.MAX_RETRIES - 1:
                    delay = self.RETRY_DELAYS[attempt]
                    logger.warning(
                        f"yfinance error for {symbol}: {e}, "
                        f"retrying in {delay}s (attempt {attempt + 1}/{self.MAX_RETRIES})"
                    )
                    time.sleep(delay)
                else:
                    logger.error(
                        f"yfinance failed for {symbol} after {self.MAX_RETRIES} attempts: {e}"
                    )
                    return empty_df

        return empty_df


class CCXTProvider:
    MAX_RETRIES = 3
    RETRY_DELAYS = [1, 2, 4]  # Exponential backoff in seconds

    def __init__(self, exchange_id: str = "coinbase"):
        self.exchange: ccxt.Exchange = getattr(ccxt, exchange_id)()

    def fetch_ohlcv(
        self, symbol: str, interval: str, start: str, end: str
    ) -> pd.DataFrame:
        empty_df = pd.DataFrame(
            columns=["date", "open", "high", "low", "close", "volume"]
        )

        for attempt in range(self.MAX_RETRIES):
            try:
                self.exchange.load_markets()
                since = self.exchange.parse8601(start + "T00:00:00Z")
                end_ts = self.exchange.parse8601(end + "T00:00:00Z")
                all_candles: list[list] = []

                while since < end_ts:
                    candles = self.exchange.fetch_ohlcv(
                        symbol, interval, since, limit=1000
                    )
                    if not candles:
                        break
                    # Filter out candles beyond end date
                    candles = [c for c in candles if c[0] < end_ts]
                    if not candles:
                        break
                    all_candles.extend(candles)
                    since = candles[-1][0] + 1

                # Check if we got any data
                if not all_candles:
                    if attempt < self.MAX_RETRIES - 1:
                        delay = self.RETRY_DELAYS[attempt]
                        logger.warning(
                            f"CCXT returned no candles for {symbol}, "
                            f"retrying in {delay}s (attempt {attempt + 1}/{self.MAX_RETRIES})"
                        )
                        time.sleep(delay)
                        continue
                    else:
                        logger.warning(
                            f"CCXT returned no candles for {symbol} after "
                            f"{self.MAX_RETRIES} attempts, returning empty result"
                        )
                        return empty_df

                df = pd.DataFrame(
                    all_candles,
                    columns=["timestamp", "open", "high", "low", "close", "volume"],
                )
                # For intraday intervals, preserve the full timestamp
                df["date"] = pd.to_datetime(df["timestamp"], unit="ms")
                if interval in INTRADAY_INTERVALS:
                    df["date"] = df["date"].dt.strftime("%Y-%m-%dT%H:%M:%S")
                else:
                    df["date"] = df["date"].dt.strftime("%Y-%m-%d")
                df = df[["date", "open", "high", "low", "close", "volume"]]
                for col in ["open", "high", "low", "close", "volume"]:
                    df[col] = df[col].astype("float64")
                df = df.dropna().reset_index(drop=True)
                df = df.sort_values("date").reset_index(drop=True)
                return df

            except Exception as e:
                if attempt < self.MAX_RETRIES - 1:
                    delay = self.RETRY_DELAYS[attempt]
                    logger.warning(
                        f"CCXT error for {symbol}: {e}, "
                        f"retrying in {delay}s (attempt {attempt + 1}/{self.MAX_RETRIES})"
                    )
                    time.sleep(delay)
                else:
                    logger.error(
                        f"CCXT failed for {symbol} after {self.MAX_RETRIES} attempts: {e}"
                    )
                    return empty_df

        return empty_df


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
    MAX_RETRIES = 3
    RETRY_DELAYS = [1, 2, 4]  # Exponential backoff in seconds

    def __init__(self, api_key: str, api_secret: str):
        self.client = StockHistoricalDataClient(api_key=api_key, secret_key=api_secret)

    def fetch_ohlcv(
        self, symbol: str, interval: str, start: str, end: str
    ) -> pd.DataFrame:
        empty_df = pd.DataFrame(
            columns=["date", "open", "high", "low", "close", "volume"]
        )

        timeframe = _ALPACA_INTERVAL_MAP.get(interval)
        if timeframe is None:
            raise ValueError(
                f"Unsupported Alpaca interval: {interval}. Supported: {list(_ALPACA_INTERVAL_MAP)}"
            )

        for attempt in range(self.MAX_RETRIES):
            try:
                request = StockBarsRequest(
                    symbol_or_symbols=symbol,
                    timeframe=timeframe,
                    start=datetime.fromisoformat(start),
                    end=datetime.fromisoformat(end) + timedelta(days=1),
                )
                bars = self.client.get_stock_bars(request)

                # Check if we got any data
                if bars.df.empty:
                    if attempt < self.MAX_RETRIES - 1:
                        delay = self.RETRY_DELAYS[attempt]
                        logger.warning(
                            f"Alpaca returned empty DataFrame for {symbol}, "
                            f"retrying in {delay}s (attempt {attempt + 1}/{self.MAX_RETRIES})"
                        )
                        time.sleep(delay)
                        continue
                    else:
                        logger.warning(
                            f"Alpaca returned empty DataFrame for {symbol} after "
                            f"{self.MAX_RETRIES} attempts, returning empty result"
                        )
                        return empty_df

                df = bars.df.reset_index()
                df.columns = [c.lower() for c in df.columns]
                # For intraday intervals, preserve the full timestamp
                df["date"] = pd.to_datetime(df["timestamp"])
                if interval in INTRADAY_INTERVALS:
                    df["date"] = df["date"].dt.strftime("%Y-%m-%dT%H:%M:%S")
                else:
                    df["date"] = df["date"].dt.strftime("%Y-%m-%d")
                df = df[["date", "open", "high", "low", "close", "volume"]]
                for col in ["open", "high", "low", "close", "volume"]:
                    df[col] = df[col].astype("float64")
                df = df.dropna().reset_index(drop=True)
                df = df.sort_values("date").reset_index(drop=True)
                return df

            except Exception as e:
                if attempt < self.MAX_RETRIES - 1:
                    delay = self.RETRY_DELAYS[attempt]
                    logger.warning(
                        f"Alpaca error for {symbol}: {e}, "
                        f"retrying in {delay}s (attempt {attempt + 1}/{self.MAX_RETRIES})"
                    )
                    time.sleep(delay)
                else:
                    logger.error(
                        f"Alpaca failed for {symbol} after {self.MAX_RETRIES} attempts: {e}"
                    )
                    return empty_df

        return empty_df


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


def get_provider(
    symbol: str, preferred_equity_provider: str = "yfinance"
) -> DataProvider:
    """Auto-detect: if '/' in symbol use CCXT, otherwise use preferred equity provider."""
    if "/" in symbol:
        return CCXTProvider()
    if preferred_equity_provider == "alpaca" and _alpaca_provider is not None:
        return _alpaca_provider
    return YFinanceProvider()


def fetch_ohlcv(
    symbol: str, interval: str, start: str, end: str, equity_provider: str = "yfinance"
) -> pd.DataFrame:
    """One-liner that auto-detects provider and fetches data."""
    provider = get_provider(symbol, preferred_equity_provider=equity_provider)
    provider_name = "ccxt" if "/" in symbol else equity_provider

    if not validate_interval(interval, provider_name):
        logger.warning(f"Interval '{interval}' may not be supported by {provider_name}")

    return provider.fetch_ohlcv(symbol, interval, start, end)


# ─────────────────────────────────────────────────────────────────────────────
# Universe Functions (for market-wide scans)
# ─────────────────────────────────────────────────────────────────────────────


def get_tradeable_universe(
    asset_class: str = "us_equity",
    status: str = "active",
    exchange: str | None = None,
) -> list[dict]:
    """
    Get list of all tradeable assets from Alpaca.

    This is an O(1) operation that returns the full universe of ~11,000
    tradeable US stocks in a single API call.

    Args:
        asset_class: Asset class to filter ("us_equity" or "crypto")
        status: Filter by status ("active", "inactive", or None for all)
        exchange: Optional exchange filter (e.g., "NYSE", "NASDAQ")

    Returns:
        List of dicts with asset info:
            - symbol: Ticker symbol
            - name: Company name
            - exchange: Trading exchange
            - asset_class: "us_equity" or "crypto"
            - tradable: Whether currently tradeable
            - shortable: Whether can be shorted
            - easy_to_borrow: Borrowing availability

    Raises:
        ValueError: If Alpaca is not configured (no API key)
    """
    import os

    api_key = os.getenv("ALPACA_API_KEY")
    api_secret = os.getenv("ALPACA_SECRET_KEY")

    if not api_key or not api_secret:
        raise ValueError(
            "Alpaca not configured. Set ALPACA_API_KEY and ALPACA_SECRET_KEY environment variables."
        )

    from alpaca.trading.client import TradingClient
    from alpaca.trading.requests import GetAssetsRequest
    from alpaca.trading.enums import AssetClass, AssetStatus

    client = TradingClient(api_key=api_key, secret_key=api_secret)

    # Build request
    asset_class_enum = (
        AssetClass.US_EQUITY if asset_class == "us_equity" else AssetClass.CRYPTO
    )

    request_params = GetAssetsRequest(asset_class=asset_class_enum)

    assets = client.get_all_assets(request_params)

    # Convert to list of dicts and apply filters
    result = []
    for asset in assets:
        # Apply status filter
        if status == "active" and asset.status != AssetStatus.ACTIVE:
            continue
        if status == "inactive" and asset.status != AssetStatus.INACTIVE:
            continue

        # Apply exchange filter
        if exchange and asset.exchange.value != exchange:
            continue

        result.append(
            {
                "symbol": asset.symbol,
                "name": asset.name,
                "exchange": asset.exchange.value if asset.exchange else None,
                "asset_class": asset.asset_class.value if asset.asset_class else None,
                "tradable": asset.tradable,
                "shortable": asset.shortable,
                "easy_to_borrow": asset.easy_to_borrow,
            }
        )

    return result


def get_sector_stocks(sector: str) -> list[str]:
    """
    Get list of stock symbols in a sector.

    Note: This uses yfinance sector data which is available per-ticker.
    For efficient sector filtering, we'd need a fundamentals database.

    This is a placeholder that returns common sector ETF components.

    Args:
        sector: Sector name (e.g., "technology", "healthcare", "financials")

    Returns:
        List of ticker symbols
    """
    # Common sector proxies via ETFs or well-known constituents
    # In production, this would query a fundamentals API
    SECTOR_PROXIES = {
        "technology": [
            "AAPL",
            "MSFT",
            "GOOGL",
            "NVDA",
            "META",
            "AMZN",
            "CRM",
            "ADBE",
            "INTC",
            "AMD",
        ],
        "healthcare": [
            "JNJ",
            "UNH",
            "PFE",
            "ABBV",
            "MRK",
            "TMO",
            "LLY",
            "ABT",
            "BMY",
            "CVS",
        ],
        "financials": [
            "JPM",
            "BAC",
            "WFC",
            "GS",
            "MS",
            "C",
            "AXP",
            "BLK",
            "SCHW",
            "USB",
        ],
        "energy": [
            "XOM",
            "CVX",
            "COP",
            "SLB",
            "EOG",
            "MPC",
            "OXY",
            "PSX",
            "VLO",
            "PXD",
        ],
        "consumer": [
            "WMT",
            "PG",
            "KO",
            "PEP",
            "COST",
            "HD",
            "MCD",
            "NKE",
            "SBUX",
            "TGT",
        ],
        "industrials": [
            "BA",
            "CAT",
            "GE",
            "MMM",
            "HON",
            "UPS",
            "LMT",
            "RTX",
            "DE",
            "UNP",
        ],
    }

    sector_lower = sector.lower()
    for key, stocks in SECTOR_PROXIES.items():
        if key in sector_lower or sector_lower in key:
            return stocks

    return []
