from tmq_core.data import fetch_ohlcv
from tmq_core.sandbox import execute_custom_strategy, execute_analysis
from tmq_core.backtest import BacktestResult

import pytest


@pytest.fixture(scope="module")
def msft_df():
    return fetch_ohlcv("MSFT", "1d", "2023-01-01", "2024-12-31")


def test_custom_rsi_strategy(msft_df):
    code = """
def generate_signals(df):
    import pandas as pd
    delta = df['close'].diff()
    gain = delta.clip(lower=0).rolling(14).mean()
    loss = (-delta.clip(upper=0)).rolling(14).mean()
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    entries = (rsi < 30).fillna(False)
    exits = (rsi > 70).fillna(False)
    return entries, exits
"""
    result = execute_custom_strategy(code, msft_df)
    assert isinstance(result, BacktestResult)
    assert result.strategy == "custom"


def test_custom_sma_strategy(msft_df):
    code = """
def generate_signals(df):
    fast = df['close'].rolling(10).mean()
    slow = df['close'].rolling(30).mean()
    entries = (fast > slow) & (fast.shift(1) <= slow.shift(1))
    exits = (fast < slow) & (fast.shift(1) >= slow.shift(1))
    return entries.fillna(False), exits.fillna(False)
"""
    result = execute_custom_strategy(code, msft_df)
    assert isinstance(result, BacktestResult)


def test_analysis_execution(msft_df):
    code = """
def analyze(df):
    returns = df['close'].pct_change().dropna()
    return {
        "mean_daily_return": float(returns.mean()),
        "volatility": float(returns.std()),
        "max_price": float(df['close'].max()),
        "min_price": float(df['close'].min())
    }
"""
    result = execute_analysis(code, msft_df)
    assert "mean_daily_return" in result
    assert "volatility" in result
    assert isinstance(result["max_price"], float)


def test_sandbox_rejects_dangerous_imports(msft_df):
    code = """
def generate_signals(df):
    import os
    os.system("rm -rf /")
    return df['close'] > 0, df['close'] < 0
"""
    with pytest.raises(Exception):
        execute_custom_strategy(code, msft_df)


def test_sandbox_rejects_no_function(msft_df):
    code = "x = 1 + 1"
    with pytest.raises(Exception):
        execute_custom_strategy(code, msft_df)
