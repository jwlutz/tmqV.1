"""
FRED (Federal Reserve Economic Data) provider.

Provides access to 800,000+ macroeconomic time series: rates, inflation,
employment, GDP, volatility, FX, money supply, credit spreads, commodities.
"""

from __future__ import annotations

from datetime import datetime, timedelta

import pandas as pd
from fredapi import Fred

# Curated list of high-impact series for trading/macro analysis
POPULAR_SERIES = [
    {"id": "FEDFUNDS", "name": "Federal Funds Rate", "category": "rates", "frequency": "monthly"},
    {"id": "DGS10", "name": "10-Year Treasury Yield", "category": "rates", "frequency": "daily"},
    {"id": "DGS2", "name": "2-Year Treasury Yield", "category": "rates", "frequency": "daily"},
    {"id": "T10Y2Y", "name": "10Y-2Y Yield Spread (Recession Indicator)", "category": "rates", "frequency": "daily"},
    {"id": "T10YIE", "name": "10-Year Breakeven Inflation", "category": "inflation", "frequency": "daily"},
    {"id": "CPIAUCSL", "name": "Consumer Price Index (CPI)", "category": "inflation", "frequency": "monthly"},
    {"id": "CPILFESL", "name": "Core CPI (Ex Food & Energy)", "category": "inflation", "frequency": "monthly"},
    {"id": "PCEPI", "name": "PCE Price Index (Fed's Preferred)", "category": "inflation", "frequency": "monthly"},
    {"id": "UNRATE", "name": "Unemployment Rate", "category": "employment", "frequency": "monthly"},
    {"id": "PAYEMS", "name": "Nonfarm Payrolls", "category": "employment", "frequency": "monthly"},
    {"id": "ICSA", "name": "Initial Jobless Claims", "category": "employment", "frequency": "weekly"},
    {"id": "GDP", "name": "Gross Domestic Product", "category": "output", "frequency": "quarterly"},
    {"id": "GDPC1", "name": "Real GDP", "category": "output", "frequency": "quarterly"},
    {"id": "INDPRO", "name": "Industrial Production Index", "category": "output", "frequency": "monthly"},
    {"id": "VIXCLS", "name": "VIX (Volatility Index)", "category": "volatility", "frequency": "daily"},
    {"id": "DEXUSEU", "name": "EUR/USD Exchange Rate", "category": "fx", "frequency": "daily"},
    {"id": "DTWEXBGS", "name": "US Dollar Index (Broad)", "category": "fx", "frequency": "daily"},
    {"id": "M2SL", "name": "M2 Money Supply", "category": "money", "frequency": "monthly"},
    {"id": "WALCL", "name": "Fed Balance Sheet (Total Assets)", "category": "money", "frequency": "weekly"},
    {"id": "MORTGAGE30US", "name": "30-Year Mortgage Rate", "category": "rates", "frequency": "weekly"},
    {"id": "HOUST", "name": "Housing Starts", "category": "housing", "frequency": "monthly"},
    {"id": "UMCSENT", "name": "Consumer Sentiment (UMich)", "category": "sentiment", "frequency": "monthly"},
    {"id": "BAMLH0A0HYM2", "name": "High Yield Credit Spread", "category": "credit", "frequency": "daily"},
    {"id": "DCOILWTICO", "name": "WTI Crude Oil Price", "category": "commodities", "frequency": "daily"},
    {"id": "GOLDAMGBD228NLBM", "name": "Gold Price (London Fix)", "category": "commodities", "frequency": "daily"},
]


class FREDProvider:
    """Federal Reserve Economic Data provider."""

    def __init__(self, api_key: str):
        self.fred = Fred(api_key=api_key)

    def fetch_series(
        self, series_id: str, start: str | None = None, end: str | None = None
    ) -> pd.DataFrame:
        """Fetch a FRED series.

        Args:
            series_id: FRED series ID (e.g., "FEDFUNDS", "CPIAUCSL")
            start: Start date YYYY-MM-DD (default: 10 years ago)
            end: End date YYYY-MM-DD (default: today)

        Returns:
            DataFrame with columns: date (str ISO), value (float).
            Sorted ascending by date. NaNs dropped.
        """
        if not start:
            start = (datetime.now() - timedelta(days=3650)).strftime("%Y-%m-%d")
        if not end:
            end = datetime.now().strftime("%Y-%m-%d")

        series = self.fred.get_series(series_id, observation_start=start, observation_end=end)
        # fredapi returns a pandas Series with DatetimeIndex
        df = series.dropna().reset_index()
        df.columns = ["date", "value"]
        df["date"] = df["date"].dt.strftime("%Y-%m-%d")
        df["value"] = df["value"].astype(float)
        return df.sort_values("date").reset_index(drop=True)

    def fetch_multiple(
        self, series_ids: list[str], start: str | None = None, end: str | None = None
    ) -> pd.DataFrame:
        """Fetch multiple series and merge on date.

        Returns:
            DataFrame with columns: date, series_id_1, series_id_2, ...
            Forward-filled to handle different frequencies (daily vs monthly).
        """
        frames = {}
        for sid in series_ids:
            df = self.fetch_series(sid, start, end)
            df = df.set_index("date")
            frames[sid] = df["value"]

        merged = pd.DataFrame(frames)
        merged.index.name = "date"
        # Sort by date, forward-fill to align different frequencies
        merged = merged.sort_index().ffill()
        merged = merged.reset_index()
        return merged

    def _search_via_api(self, query: str, limit: int = 20) -> list[dict]:
        """Direct FRED API search, bypassing fredapi's buggy date parser."""
        import requests
        url = "https://api.stlouisfed.org/fred/series/search"
        params = {
            "search_text": query,
            "api_key": self.fred.api_key,
            "file_type": "json",
            "limit": limit,
            "order_by": "popularity",
            "sort_order": "desc",
        }
        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        serieses = resp.json().get("seriess", [])
        return [
            {
                "id": s.get("id", ""),
                "title": s.get("title", ""),
                "frequency": s.get("frequency_short", s.get("frequency", "")),
                "units": s.get("units", ""),
                "seasonal_adjustment": s.get("seasonal_adjustment_short", s.get("seasonal_adjustment", "")),
                "last_updated": s.get("last_updated", ""),
            }
            for s in serieses[:limit]
        ]

    def search_series(self, query: str, limit: int = 20) -> list[dict]:
        """Search FRED for series by keyword.

        Returns:
            [{id, title, frequency, units, seasonal_adjustment, last_updated}, ...]
        """
        try:
            results = self.fred.search(query)
        except (OverflowError, Exception) as e:
            # fredapi can fail parsing ancient dates (e.g. 1209 AD) that overflow
            # pandas nanosecond timestamps. Fall back to direct API call.
            err_str = f"{type(e).__name__}: {e}"
            if "overflow" in err_str.lower() or "outofbounds" in err_str.lower():
                results = self._search_via_api(query, limit)
            else:
                raise
        if results is None:
            return []

        # _search_via_api returns a list directly
        if isinstance(results, list):
            return results

        if isinstance(results, pd.DataFrame) and results.empty:
            return []

        out = []
        for _, row in results.head(limit).iterrows():
            out.append({
                "id": row.get("id", row.name) if "id" in results.columns else row.name,
                "title": str(row.get("title", "")),
                "frequency": str(row.get("frequency_short", row.get("frequency", ""))),
                "units": str(row.get("units", "")),
                "seasonal_adjustment": str(row.get("seasonal_adjustment_short", row.get("seasonal_adjustment", ""))),
                "last_updated": str(row.get("last_updated", "")),
            })
        return out

    def get_series_info(self, series_id: str) -> dict:
        """Get metadata about a series."""
        info = self.fred.get_series_info(series_id)
        return {
            "id": str(info.get("id", series_id)),
            "title": str(info.get("title", "")),
            "frequency": str(info.get("frequency_short", info.get("frequency", ""))),
            "units": str(info.get("units", "")),
            "seasonal_adjustment": str(info.get("seasonal_adjustment_short", "")),
            "observation_start": str(info.get("observation_start", "")),
            "observation_end": str(info.get("observation_end", "")),
            "last_updated": str(info.get("last_updated", "")),
        }

    def get_popular_series(self) -> list[dict]:
        """Return the curated POPULAR_SERIES list."""
        return POPULAR_SERIES

    def get_release_dates(self, series_id: str, upcoming: bool = True) -> list[dict]:
        """Get release dates for a series (economic calendar)."""
        info = self.fred.get_series_info(series_id)
        series_name = str(info.get("title", series_id))
        try:
            dates = self.fred.get_series_all_releases(series_id)
            if dates is None or dates.empty:
                return []
            result = []
            today = datetime.now().strftime("%Y-%m-%d")
            for date_val in dates.index.unique():
                date_str = pd.Timestamp(date_val).strftime("%Y-%m-%d")
                if upcoming and date_str < today:
                    continue
                result.append({
                    "date": date_str,
                    "series_id": series_id,
                    "series_name": series_name,
                })
            return result
        except Exception:
            return []


def align_macro_to_prices(
    macro_df: pd.DataFrame, price_df: pd.DataFrame
) -> pd.DataFrame:
    """Align macro data (possibly lower frequency) to a price DataFrame's date index.

    Forward-fills macro values to match daily price dates.
    This is the correct approach: use the most recently available macro value
    as of each trading day (no look-ahead bias).

    Args:
        macro_df: DataFrame with 'date' column and value column(s)
        price_df: DataFrame with 'date' column (from fetch_ohlcv)

    Returns:
        DataFrame with price_df's dates and macro values forward-filled.
    """
    macro = macro_df.copy()
    prices = price_df.copy()

    # Ensure date columns are datetime for proper alignment
    macro["date"] = pd.to_datetime(macro["date"])
    prices["date"] = pd.to_datetime(prices["date"])

    # Get the value columns (everything except 'date')
    value_cols = [c for c in macro.columns if c != "date"]

    macro = macro.set_index("date")
    prices = prices.set_index("date")

    # Reindex macro to price dates, forward-fill
    aligned = macro[value_cols].reindex(prices.index, method="ffill")

    # Back-fill any leading NaNs (price dates before first macro observation)
    aligned = aligned.bfill()

    aligned = aligned.reset_index()
    aligned = aligned.rename(columns={"index": "date"})
    if "date" not in aligned.columns and aligned.index.name == "date":
        aligned = aligned.reset_index()
    aligned["date"] = aligned["date"].dt.strftime("%Y-%m-%d")

    return aligned


# Module-level provider (configured at runtime)
_fred_provider: FREDProvider | None = None


def configure_fred(api_key: str):
    """Configure FRED with user's API key."""
    global _fred_provider
    _fred_provider = FREDProvider(api_key)


def get_fred() -> FREDProvider:
    """Get configured FRED provider. Raises if not configured."""
    if _fred_provider is None:
        raise RuntimeError("FRED not configured. Call configure_fred(api_key) first.")
    return _fred_provider


# Convenience functions
def fetch_macro(
    series_id: str, start: str | None = None, end: str | None = None
) -> pd.DataFrame:
    """One-liner to fetch a FRED series."""
    return get_fred().fetch_series(series_id, start, end)


def fetch_macro_multiple(
    series_ids: list[str], start: str | None = None, end: str | None = None
) -> pd.DataFrame:
    """One-liner to fetch multiple FRED series aligned by date."""
    return get_fred().fetch_multiple(series_ids, start, end)


def search_macro(query: str) -> list[dict]:
    """One-liner to search FRED."""
    return get_fred().search_series(query)
