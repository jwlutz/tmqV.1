from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

import pandas as pd
import ta

from tmq_core.data import fetch_ohlcv


def _require_cols(df: pd.DataFrame, cols: list[str]) -> None:
    missing = [c for c in cols if c not in df.columns]
    if missing:
        raise ValueError(f"Input DataFrame missing required columns: {missing}")


def _finalize(result: pd.DataFrame | pd.Series, dates: pd.Series) -> pd.DataFrame:
    if isinstance(result, pd.Series):
        result = result.to_frame()
    out = result.copy()
    out["date"] = dates.values
    out = out.dropna().reset_index(drop=True)
    cols = ["date"] + [c for c in out.columns if c != "date"]
    return out[cols]


# Each entry maps our indicator name -> {description, defaults, call(df, **params) -> DataFrame}
INDICATORS: dict[str, dict[str, Any]] = {
    "rsi": {
        "description": "Relative Strength Index",
        "defaults": {"length": 14},
        "call": lambda df, **p: ta.momentum.rsi(
            df["close"], window=int(p["length"])
        ).rename("rsi"),
    },
    "sma": {
        "description": "Simple Moving Average",
        "defaults": {"length": 20},
        "call": lambda df, **p: ta.trend.sma_indicator(
            df["close"], window=int(p["length"])
        ).rename("sma"),
    },
    "ema": {
        "description": "Exponential Moving Average",
        "defaults": {"length": 20},
        "call": lambda df, **p: ta.trend.ema_indicator(
            df["close"], window=int(p["length"])
        ).rename("ema"),
    },
    "macd": {
        "description": "Moving Average Convergence Divergence",
        "defaults": {"fast": 12, "slow": 26, "signal": 9},
        "call": lambda df, **p: pd.DataFrame(
            {
                "macd": ta.trend.macd(
                    df["close"],
                    window_slow=int(p["slow"]),
                    window_fast=int(p["fast"]),
                ),
                "macd_signal": ta.trend.macd_signal(
                    df["close"],
                    window_slow=int(p["slow"]),
                    window_fast=int(p["fast"]),
                    window_sign=int(p["signal"]),
                ),
                "macd_histogram": ta.trend.macd_diff(
                    df["close"],
                    window_slow=int(p["slow"]),
                    window_fast=int(p["fast"]),
                    window_sign=int(p["signal"]),
                ),
            }
        ),
    },
    "bbands": {
        "description": "Bollinger Bands",
        "defaults": {"length": 20, "std": 2.0},
        "call": lambda df, **p: (
            lambda bb: pd.DataFrame(
                {
                    "bb_lower": bb.bollinger_lband(),
                    "bb_mid": bb.bollinger_mavg(),
                    "bb_upper": bb.bollinger_hband(),
                }
            )
        )(
            ta.volatility.BollingerBands(
                df["close"],
                window=int(p["length"]),
                window_dev=float(p["std"]),
            )
        ),
    },
    "stoch": {
        "description": "Stochastic Oscillator",
        "defaults": {"k": 14, "d": 3},
        "call": lambda df, **p: pd.DataFrame(
            {
                "stoch_k": ta.momentum.stoch(
                    high=df["high"],
                    low=df["low"],
                    close=df["close"],
                    window=int(p["k"]),
                    smooth_window=int(p["d"]),
                ),
                "stoch_d": ta.momentum.stoch_signal(
                    high=df["high"],
                    low=df["low"],
                    close=df["close"],
                    window=int(p["k"]),
                    smooth_window=int(p["d"]),
                ),
            }
        ),
    },
    "atr": {
        "description": "Average True Range",
        "defaults": {"length": 14},
        "call": lambda df, **p: ta.volatility.average_true_range(
            high=df["high"],
            low=df["low"],
            close=df["close"],
            window=int(p["length"]),
        ).rename("atr"),
    },
    "adx": {
        "description": "Average Directional Index",
        "defaults": {"length": 14},
        "call": lambda df, **p: (
            lambda a: pd.DataFrame(
                {
                    "adx": a.adx(),
                    "adx_plus": a.adx_pos(),
                    "adx_minus": a.adx_neg(),
                }
            )
        )(
            ta.trend.ADXIndicator(
                high=df["high"],
                low=df["low"],
                close=df["close"],
                window=int(p["length"]),
            )
        ),
    },
    "obv": {
        "description": "On-Balance Volume",
        "defaults": {},
        "call": lambda df, **p: ta.volume.on_balance_volume(
            df["close"], df["volume"]
        ).rename("obv"),
    },
    "vwap": {
        "description": "Volume Weighted Average Price",
        "defaults": {},
        "call": lambda df, **p: ta.volume.volume_weighted_average_price(
            high=df["high"],
            low=df["low"],
            close=df["close"],
            volume=df["volume"],
            window=14,
        ).rename("vwap"),
    },
    "mfi": {
        "description": "Money Flow Index",
        "defaults": {"length": 14},
        "call": lambda df, **p: ta.volume.money_flow_index(
            high=df["high"],
            low=df["low"],
            close=df["close"],
            volume=df["volume"],
            window=int(p["length"]),
        ).rename("mfi"),
    },
    "cci": {
        "description": "Commodity Channel Index",
        "defaults": {"length": 20},
        "call": lambda df, **p: ta.trend.cci(
            high=df["high"],
            low=df["low"],
            close=df["close"],
            window=int(p["length"]),
            constant=0.015,
        ).rename("cci"),
    },
    "willr": {
        "description": "Williams %R",
        "defaults": {"length": 14},
        "call": lambda df, **p: ta.momentum.williams_r(
            high=df["high"],
            low=df["low"],
            close=df["close"],
            lbp=int(p["length"]),
        ).rename("willr"),
    },
    "cmf": {
        "description": "Chaikin Money Flow",
        "defaults": {"length": 20},
        "call": lambda df, **p: ta.volume.chaikin_money_flow(
            high=df["high"],
            low=df["low"],
            close=df["close"],
            volume=df["volume"],
            window=int(p["length"]),
        ).rename("cmf"),
    },
    "roc": {
        "description": "Rate of Change",
        "defaults": {"length": 10},
        "call": lambda df, **p: ta.momentum.roc(
            df["close"], window=int(p["length"])
        ).rename("roc"),
    },
    "trix": {
        "description": "Triple Exponential Average",
        "defaults": {"length": 18},
        "call": lambda df, **p: ta.trend.trix(
            df["close"], window=int(p["length"])
        ).rename("trix"),
    },
    "ppo": {
        "description": "Percentage Price Oscillator",
        "defaults": {"fast": 12, "slow": 26, "signal": 9},
        "call": lambda df, **p: pd.DataFrame(
            {
                "ppo": ta.momentum.ppo(
                    close=df["close"],
                    window_slow=int(p["slow"]),
                    window_fast=int(p["fast"]),
                    window_sign=int(p["signal"]),
                ),
                "ppo_signal": ta.momentum.ppo_signal(
                    close=df["close"],
                    window_slow=int(p["slow"]),
                    window_fast=int(p["fast"]),
                    window_sign=int(p["signal"]),
                ),
                "ppo_histogram": ta.momentum.ppo_hist(
                    close=df["close"],
                    window_slow=int(p["slow"]),
                    window_fast=int(p["fast"]),
                    window_sign=int(p["signal"]),
                ),
            }
        ),
    },
    "aroon": {
        "description": "Aroon Indicator",
        "defaults": {"length": 25},
        "call": lambda df, **p: (
            lambda a: pd.DataFrame(
                {
                    "aroon_down": a.aroon_down(),
                    "aroon_up": a.aroon_up(),
                    "aroon_osc": a.aroon_indicator(),
                }
            )
        )(ta.trend.AroonIndicator(close=df["close"], window=int(p["length"]))),
    },
    "stochrsi": {
        "description": "Stochastic RSI",
        "defaults": {"length": 14, "rsi_length": 14, "k": 3, "d": 3},
        "call": lambda df, **p: (
            lambda s: pd.DataFrame(
                {
                    "stochrsi_k": s.stochrsi_k(),
                    "stochrsi_d": s.stochrsi_d(),
                }
            )
        )(
            ta.momentum.StochRSIIndicator(
                close=df["close"],
                window=int(p["length"]),
                smooth1=int(p["k"]),
                smooth2=int(p["d"]),
            )
        ),
    },
    "psar": {
        "description": "Parabolic SAR",
        "defaults": {"af0": 0.02, "af": 0.02, "max_af": 0.2},
        "call": lambda df, **p: pd.DataFrame(
            {
                "psar": ta.trend.psar(
                    high=df["high"],
                    low=df["low"],
                    close=df["close"],
                    step=float(p["af"]),
                    max_step=float(p["max_af"]),
                )
            }
        ),
    },
    "kc": {
        "description": "Keltner Channels",
        "defaults": {"length": 20, "scalar": 2},
        "call": lambda df, **p: (
            lambda kc: pd.DataFrame(
                {
                    "kc_lower": kc.keltner_channel_lband(),
                    "kc_basis": kc.keltner_channel_mband(),
                    "kc_upper": kc.keltner_channel_hband(),
                }
            )
        )(
            ta.volatility.KeltnerChannel(
                high=df["high"],
                low=df["low"],
                close=df["close"],
                window=int(p["length"]),
                window_atr=int(p["length"]),
                original_version=True,
                multiplier=float(p["scalar"]),
            )
        ),
    },
    "donchian": {
        "description": "Donchian Channels",
        "defaults": {"lower_length": 20, "upper_length": 20},
        "call": lambda df, **p: (
            lambda dc: pd.DataFrame(
                {
                    "dc_lower": dc.donchian_channel_lband(),
                    "dc_mid": dc.donchian_channel_mband(),
                    "dc_upper": dc.donchian_channel_hband(),
                }
            )
        )(
            ta.volatility.DonchianChannel(
                high=df["high"],
                low=df["low"],
                close=df["close"],
                window=int(p.get("upper_length", 20)),
                offset=0,
            )
        ),
    },
    "supertrend": {
        "description": "SuperTrend",
        "defaults": {"length": 7, "multiplier": 3.0},
        "call": lambda df, **p: (
            lambda st: pd.DataFrame(
                {
                    "supertrend": st.supertrend(),
                    "supertrend_direction": st.supertrend_direction(),
                }
            )
        )(
            ta.trend.STCIndicator(
                close=df["close"],
                window_slow=int(max(2, p["length"] * 2)),
                window_fast=int(max(2, p["length"])),
                cycle=int(max(2, p["length"])),
                smooth1=3,
                smooth2=3,
            )
        ),
    },
    "ichimoku": {
        "description": "Ichimoku Cloud",
        "defaults": {"tenkan": 9, "kijun": 26, "senkou": 52},
        "call": lambda df, **p: (
            lambda ic: pd.DataFrame(
                {
                    "ichimoku_tenkan": ic.ichimoku_conversion_line(),
                    "ichimoku_kijun": ic.ichimoku_base_line(),
                    "ichimoku_span_a": ic.ichimoku_a(),
                    "ichimoku_span_b": ic.ichimoku_b(),
                }
            )
        )(
            ta.trend.IchimokuIndicator(
                high=df["high"],
                low=df["low"],
                window1=int(p["tenkan"]),
                window2=int(p["kijun"]),
                window3=int(p["senkou"]),
            )
        ),
    },
}


def compute_indicator(df: pd.DataFrame, indicator: str, **params: Any) -> pd.DataFrame:
    """
    Compute a technical indicator on an OHLCV DataFrame.

    Expects columns: date, open, high, low, close, volume
    Returns a DataFrame with a 'date' column and one or more value columns.
    NaN rows from indicator warmup are dropped.
    """
    _require_cols(df, ["date", "open", "high", "low", "close", "volume"])

    name = indicator.lower()
    if name not in INDICATORS:
        raise ValueError(
            f"Unknown indicator '{indicator}'. Use list_indicators() to see available options."
        )

    spec = INDICATORS[name]
    merged = {**spec["defaults"], **params}

    result = spec["call"](df, **merged)
    if result is None:
        raise ValueError(
            f"Indicator '{indicator}' returned no data. Check input DataFrame."
        )

    return _finalize(result, df["date"])


def get_indicator(
    symbol: str,
    indicator: str,
    interval: str = "1d",
    start: str | None = None,
    end: str | None = None,
    **params: Any,
) -> pd.DataFrame:
    """Fetch OHLCV data and compute an indicator in one call."""
    if end is None:
        end = datetime.now().strftime("%Y-%m-%d")
    if start is None:
        start = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")

    df = fetch_ohlcv(symbol, interval, start, end)
    return compute_indicator(df, indicator, **params)


def list_indicators() -> list[dict[str, Any]]:
    """Return list of supported indicators with descriptions and default params."""
    return [
        {
            "name": name,
            "description": spec["description"],
            "default_params": spec["defaults"],
        }
        for name, spec in INDICATORS.items()
    ]
