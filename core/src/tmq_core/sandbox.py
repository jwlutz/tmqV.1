from __future__ import annotations

import inspect
import threading
from typing import Any

import numpy as np
import pandas as pd
import vectorbt as vbt

from tmq_core.schemas import BacktestResult

# Modules allowed inside sandbox code
_ALLOWED_IMPORTS = {"pandas", "pd", "numpy", "np", "pandas_ta_classic", "ta", "math"}

# Dangerous builtins to block
_BLOCKED_BUILTINS = {
    "open", "exec", "eval", "compile", "__import__", "globals", "locals",
    "getattr", "setattr", "delattr", "breakpoint", "exit", "quit",
    "input", "memoryview", "classmethod", "staticmethod", "property",
    "super", "type", "vars", "dir",
}


def _make_safe_import(allowed_modules: set[str]):
    """Create a restricted __import__ that only allows whitelisted modules."""
    import builtins
    _real_import = builtins.__import__

    def _safe_import(name, *args, **kwargs):
        top_level = name.split(".")[0]
        if top_level not in allowed_modules:
            raise ImportError(f"Import of '{name}' is not allowed in sandbox. Allowed: {sorted(allowed_modules)}")
        return _real_import(name, *args, **kwargs)

    return _safe_import


def _build_namespace() -> dict:
    """Build a restricted namespace for exec."""
    import pandas_ta_classic

    safe_builtins = {
        k: v for k, v in __builtins__.items() if k not in _BLOCKED_BUILTINS
    } if isinstance(__builtins__, dict) else {
        k: getattr(__builtins__, k) for k in dir(__builtins__) if k not in _BLOCKED_BUILTINS
    }

    allowed_modules = {"pandas", "numpy", "pandas_ta_classic", "math"}
    safe_builtins["__import__"] = _make_safe_import(allowed_modules)

    return {
        "__builtins__": safe_builtins,
        "pd": pd,
        "np": np,
        "ta": pandas_ta_classic,
        "pandas": pd,
        "numpy": np,
    }


def _run_with_timeout(func, args=(), timeout: float = 30.0) -> Any:
    """Run a function with a timeout. Raises TimeoutError if exceeded."""
    result = [None]
    exception = [None]

    def target():
        try:
            result[0] = func(*args)
        except Exception as e:
            exception[0] = e

    thread = threading.Thread(target=target, daemon=True)
    thread.start()
    thread.join(timeout)

    if thread.is_alive():
        raise TimeoutError(f"Execution timed out after {timeout} seconds")
    if exception[0] is not None:
        raise exception[0]
    return result[0]


def _run_portfolio(close: pd.Series, entries: pd.Series, exits: pd.Series, init_cash: float) -> BacktestResult:
    """Run vectorbt portfolio from signals and extract results."""
    from tmq_core.backtest import _extract_metrics, _extract_equity_curve, _extract_trades

    close = close.reset_index(drop=True)
    entries = entries.astype(bool).reset_index(drop=True)
    exits = exits.astype(bool).reset_index(drop=True)

    pf = vbt.Portfolio.from_signals(close, entries, exits, init_cash=init_cash, freq="1D")
    dates = pd.Series([str(i) for i in range(len(close))])

    return BacktestResult(
        symbol="custom",
        strategy="custom",
        parameters={},
        metrics=_extract_metrics(pf, init_cash),
        equity_curve=_extract_equity_curve(pf, dates),
        trades=_extract_trades(pf, dates),
        provider="vectorbt",
    )


def execute_custom_strategy(
    code: str,
    df: pd.DataFrame,
    init_cash: float = 10000,
    macro_data: pd.DataFrame | None = None,
) -> BacktestResult:
    """
    Execute AI-generated signal code against OHLCV data.

    The code must define generate_signals(df) or generate_signals(df, macro)
    returning (entries, exits) boolean Series.

    If macro_data is provided and the function accepts 2 parameters,
    the macro DataFrame is passed as the second argument.

    Only pandas, numpy, pandas_ta_classic are available. 30 second timeout.
    """
    namespace = _build_namespace()

    # Execute the code to define the function
    exec(code, namespace)  # noqa: S102

    if "generate_signals" not in namespace:
        raise ValueError("Code must define a 'generate_signals(df)' function")

    generate_signals = namespace["generate_signals"]

    # Check if function accepts macro data
    sig = inspect.signature(generate_signals)
    param_count = len(sig.parameters)

    if macro_data is not None and param_count >= 2:
        args = (df.copy(), macro_data.copy())
    else:
        args = (df.copy(),)

    # Run with timeout
    entries, exits = _run_with_timeout(generate_signals, args=args, timeout=30.0)

    # Validate output
    if not isinstance(entries, pd.Series) or not isinstance(exits, pd.Series):
        raise TypeError("generate_signals must return two pandas Series")
    if len(entries) != len(df) or len(exits) != len(df):
        raise ValueError(f"Signal Series must have same length as input ({len(df)}), got entries={len(entries)}, exits={len(exits)}")

    close = df["close"].astype(float)
    return _run_portfolio(close, entries, exits, init_cash)


def execute_analysis(
    code: str,
    df: pd.DataFrame,
) -> dict:
    """
    Execute analysis code. Must define analyze(df) returning a dict.
    Same security restrictions. 30 second timeout.
    """
    namespace = _build_namespace()

    exec(code, namespace)  # noqa: S102

    if "analyze" not in namespace:
        raise ValueError("Code must define an 'analyze(df)' function")

    analyze = namespace["analyze"]

    result = _run_with_timeout(analyze, args=(df.copy(),), timeout=30.0)

    if not isinstance(result, dict):
        raise TypeError("analyze must return a dict")

    return result
