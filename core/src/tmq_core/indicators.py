from __future__ import annotations

from datetime import datetime, timedelta

import pandas as pd
import pandas_ta_classic  # noqa: F401  — registers the .ta accessor on DataFrames

from tmq_core.data import fetch_ohlcv

# ---------------------------------------------------------------------------
# Indicator registry
# Each entry maps our name → {call, rename, defaults, description}
#   call:    function(ta_df, **params) → pd.DataFrame of result columns
#   rename:  dict mapping pandas-ta output column substrings → our names
#   defaults: default parameters
# ---------------------------------------------------------------------------

INDICATORS: dict[str, dict] = {
    "rsi": {
        "description": "Relative Strength Index",
        "defaults": {"length": 14},
        "call": lambda df, **p: df.ta.rsi(**p),
        "rename": {"RSI": "rsi"},
    },
    "sma": {
        "description": "Simple Moving Average",
        "defaults": {"length": 20},
        "call": lambda df, **p: df.ta.sma(**p),
        "rename": {"SMA": "sma"},
    },
    "ema": {
        "description": "Exponential Moving Average",
        "defaults": {"length": 20},
        "call": lambda df, **p: df.ta.ema(**p),
        "rename": {"EMA": "ema"},
    },
    "macd": {
        "description": "Moving Average Convergence Divergence",
        "defaults": {"fast": 12, "slow": 26, "signal": 9},
        "call": lambda df, **p: df.ta.macd(**p),
        "rename": {"MACDh": "macd_histogram", "MACDs": "macd_signal", "MACD_": "macd"},
    },
    "bbands": {
        "description": "Bollinger Bands",
        "defaults": {"length": 20, "std": 2.0},
        "call": lambda df, **p: df.ta.bbands(**p),
        "rename": {"BBL": "bb_lower", "BBM": "bb_mid", "BBU": "bb_upper"},
    },
    "stoch": {
        "description": "Stochastic Oscillator",
        "defaults": {"k": 14, "d": 3},
        "call": lambda df, **p: df.ta.stoch(**p),
        "rename": {"STOCHk": "stoch_k", "STOCHd": "stoch_d"},
    },
    "atr": {
        "description": "Average True Range",
        "defaults": {"length": 14},
        "call": lambda df, **p: df.ta.atr(**p),
        "rename": {"ATR": "atr"},
    },
    "adx": {
        "description": "Average Directional Index",
        "defaults": {"length": 14},
        "call": lambda df, **p: df.ta.adx(**p),
        "rename": {"ADX": "adx", "DMP": "adx_plus", "DMN": "adx_minus"},
    },
    "obv": {
        "description": "On-Balance Volume",
        "defaults": {},
        "call": lambda df, **p: df.ta.obv(**p),
        "rename": {"OBV": "obv"},
    },
    "vwap": {
        "description": "Volume Weighted Average Price",
        "defaults": {},
        "call": lambda df, **p: df.ta.vwap(**p),
        "rename": {"VWAP": "vwap"},
    },
    "mfi": {
        "description": "Money Flow Index",
        "defaults": {"length": 14},
        "call": lambda df, **p: df.ta.mfi(**p),
        "rename": {"MFI": "mfi"},
    },
    "cci": {
        "description": "Commodity Channel Index",
        "defaults": {"length": 20},
        "call": lambda df, **p: df.ta.cci(**p),
        "rename": {"CCI": "cci"},
    },
    "willr": {
        "description": "Williams %R",
        "defaults": {"length": 14},
        "call": lambda df, **p: df.ta.willr(**p),
        "rename": {"WILLR": "willr"},
    },
    "cmf": {
        "description": "Chaikin Money Flow",
        "defaults": {"length": 20},
        "call": lambda df, **p: df.ta.cmf(**p),
        "rename": {"CMF": "cmf"},
    },
    # New indicators
    "roc": {
        "description": "Rate of Change",
        "defaults": {"length": 10},
        "call": lambda df, **p: df.ta.roc(**p),
        "rename": {"ROC": "roc"},
    },
    "trix": {
        "description": "Triple Exponential Average",
        "defaults": {"length": 18},
        "call": lambda df, **p: df.ta.trix(**p),
        "rename": {"TRIX": "trix", "TRIXs": "trix_signal"},
    },
    "ppo": {
        "description": "Percentage Price Oscillator",
        "defaults": {"fast": 12, "slow": 26, "signal": 9},
        "call": lambda df, **p: df.ta.ppo(**p),
        "rename": {"PPO_": "ppo", "PPOh": "ppo_histogram", "PPOs": "ppo_signal"},
    },
    "aroon": {
        "description": "Aroon Indicator",
        "defaults": {"length": 25},
        "call": lambda df, **p: df.ta.aroon(**p),
        "rename": {"AROOND": "aroon_down", "AROONU": "aroon_up", "AROONOSC": "aroon_osc"},
    },
    "stochrsi": {
        "description": "Stochastic RSI",
        "defaults": {"length": 14, "rsi_length": 14, "k": 3, "d": 3},
        "call": lambda df, **p: df.ta.stochrsi(**p),
        "rename": {"STOCHRSIk": "stochrsi_k", "STOCHRSId": "stochrsi_d"},
    },
    "psar": {
        "description": "Parabolic SAR",
        "defaults": {"af0": 0.02, "af": 0.02, "max_af": 0.2},
        "call": lambda df, **p: df.ta.psar(**p),
        "rename": {"PSARl": "psar_long", "PSARs": "psar_short", "PSARaf": "psar_af", "PSARr": "psar_reversal"},
    },
    "kc": {
        "description": "Keltner Channels",
        "defaults": {"length": 20, "scalar": 2},
        "call": lambda df, **p: df.ta.kc(**p),
        "rename": {"KCL": "kc_lower", "KCB": "kc_basis", "KCU": "kc_upper"},
    },
    "donchian": {
        "description": "Donchian Channels",
        "defaults": {"lower_length": 20, "upper_length": 20},
        "call": lambda df, **p: df.ta.donchian(**p),
        "rename": {"DCL": "dc_lower", "DCM": "dc_mid", "DCU": "dc_upper"},
    },
    "supertrend": {
        "description": "SuperTrend",
        "defaults": {"length": 7, "multiplier": 3.0},
        "call": lambda df, **p: df.ta.supertrend(**p),
        "rename": {"SUPERT": "supertrend", "SUPERTd": "supertrend_direction", "SUPERTl": "supertrend_long", "SUPERTs": "supertrend_short"},
    },
    "ichimoku": {
        "description": "Ichimoku Cloud",
        "defaults": {"tenkan": 9, "kijun": 26, "senkou": 52},
        "call": lambda df, **p: df.ta.ichimoku(**p)[0],  # Returns tuple, first is the indicator df
        "rename": {"ISA": "ichimoku_span_a", "ISB": "ichimoku_span_b", "ITS": "ichimoku_tenkan", "IKS": "ichimoku_kijun", "ICS": "ichimoku_chikou"},
    },
}


def _capitalize_ohlcv(df: pd.DataFrame) -> pd.DataFrame:
    """Map lowercase ohlcv columns to capitalized names for pandas-ta."""
    col_map = {"open": "Open", "high": "High", "low": "Low", "close": "Close", "volume": "Volume"}
    return df.rename(columns=col_map)


def _rename_result_columns(result: pd.DataFrame | pd.Series, rename_map: dict[str, str]) -> pd.DataFrame:
    """Rename pandas-ta output columns using substring matching."""
    if isinstance(result, pd.Series):
        result = result.to_frame()

    new_names = {}
    for col in result.columns:
        for pattern, new_name in rename_map.items():
            if pattern in col:
                new_names[col] = new_name
                break
        else:
            # Fallback: lowercase the original name
            new_names[col] = col.lower()
    return result.rename(columns=new_names)


def compute_indicator(df: pd.DataFrame, indicator: str, **params) -> pd.DataFrame:
    """
    Compute a technical indicator on an OHLCV DataFrame.

    Returns a DataFrame with a 'date' column and one or more value columns.
    NaN rows from indicator warmup are dropped.
    """
    name = indicator.lower()
    if name not in INDICATORS:
        raise ValueError(f"Unknown indicator '{indicator}'. Use list_indicators() to see available options.")

    spec = INDICATORS[name]

    # Merge defaults with user params (user wins)
    merged = {**spec["defaults"], **params}

    # Capitalize columns for pandas-ta
    ta_df = _capitalize_ohlcv(df.copy())

    # Call the indicator
    result = spec["call"](ta_df, **merged)
    if result is None:
        raise ValueError(f"Indicator '{indicator}' returned no data. Check input DataFrame.")

    # Rename columns
    result = _rename_result_columns(result, spec["rename"])

    # Attach date and drop NaN rows
    result["date"] = df["date"].values
    result = result.dropna().reset_index(drop=True)

    # Reorder so date is first
    cols = ["date"] + [c for c in result.columns if c != "date"]
    return result[cols]


def get_indicator(
    symbol: str,
    indicator: str,
    interval: str = "1d",
    start: str | None = None,
    end: str | None = None,
    **params,
) -> pd.DataFrame:
    """Fetch OHLCV data and compute an indicator in one call."""
    if end is None:
        end = datetime.now().strftime("%Y-%m-%d")
    if start is None:
        start = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")

    df = fetch_ohlcv(symbol, interval, start, end)
    return compute_indicator(df, indicator, **params)


def list_indicators() -> list[dict]:
    """Return list of supported indicators with descriptions and default params."""
    return [
        {
            "name": name,
            "description": spec["description"],
            "default_params": spec["defaults"],
        }
        for name, spec in INDICATORS.items()
    ]
