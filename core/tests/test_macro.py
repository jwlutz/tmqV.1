import pytest
import os

FRED_KEY = os.environ.get("FRED_API_KEY", "")
has_fred = bool(FRED_KEY)


@pytest.mark.skipif(not has_fred, reason="No FRED API key")
class TestFREDProvider:
    @pytest.fixture(autouse=True)
    def setup(self):
        from tmq_core.macro import configure_fred

        configure_fred(FRED_KEY)

    def test_fetch_fed_funds(self):
        from tmq_core.macro import fetch_macro

        df = fetch_macro("FEDFUNDS", "2020-01-01", "2024-12-31")
        assert len(df) > 30
        assert list(df.columns) == ["date", "value"]
        assert df["value"].iloc[-1] > 0  # Fed funds rate should be positive

    def test_fetch_daily_series(self):
        from tmq_core.macro import fetch_macro

        df = fetch_macro("DGS10", "2024-01-01", "2024-12-31")
        assert len(df) > 100  # Daily series should have many points

    def test_fetch_multiple(self):
        from tmq_core.macro import fetch_macro_multiple

        df = fetch_macro_multiple(
            ["DGS10", "DGS2", "VIXCLS"], "2024-01-01", "2024-12-31"
        )
        assert "DGS10" in df.columns
        assert "DGS2" in df.columns
        assert "VIXCLS" in df.columns
        assert "date" in df.columns

    def test_search(self):
        from tmq_core.macro import search_macro

        results = search_macro("consumer price index")
        assert len(results) > 0
        assert any(
            "CPI" in r.get("id", "") or "price" in r.get("title", "").lower()
            for r in results
        )

    def test_popular_series(self):
        from tmq_core.macro import POPULAR_SERIES

        assert len(POPULAR_SERIES) >= 20
        ids = [s["id"] for s in POPULAR_SERIES]
        assert "FEDFUNDS" in ids
        assert "CPIAUCSL" in ids
        assert "VIXCLS" in ids

    def test_align_to_prices(self):
        from tmq_core.macro import fetch_macro, align_macro_to_prices
        from tmq_core.data import fetch_ohlcv

        # Monthly CPI aligned to daily MSFT prices
        macro = fetch_macro("CPIAUCSL", "2024-01-01", "2024-12-31")
        prices = fetch_ohlcv("MSFT", "1d", "2024-01-01", "2024-12-31")

        aligned = align_macro_to_prices(macro, prices)
        # Should have same number of rows as prices
        assert len(aligned) == len(prices)
        # Should have no NaNs (forward fill)
        assert aligned["value"].isna().sum() == 0

    def test_series_info(self):
        from tmq_core.macro import get_fred

        info = get_fred().get_series_info("FEDFUNDS")
        assert info["id"] == "FEDFUNDS"
        assert "title" in info


def test_popular_series_no_key():
    """Popular series list should work without API key"""
    from tmq_core.macro import POPULAR_SERIES

    assert len(POPULAR_SERIES) >= 20


def test_unconfigured_raises():
    """Should raise clear error if FRED not configured"""
    import tmq_core.macro as macro_module

    macro_module._fred_provider = None  # Reset
    with pytest.raises(RuntimeError, match="not configured"):
        from tmq_core.macro import get_fred

        get_fred()
