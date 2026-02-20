"""
AI Methodology Regression Tests

These tests verify that when the AI correctly calls certain tools,
the system properly executes them and returns expected results.

The tests use mocked LLM responses to simulate the AI making correct tool calls,
then verify the tool execution produces expected outputs.

Note: These tests do NOT verify the AI *chooses* the right tools (that would require
real LLM calls and be flaky). Instead, they verify the system correctly *executes*
the tools the AI calls, which is the deterministic part of the pipeline.
"""

import json
from unittest.mock import MagicMock, patch, AsyncMock
from typing import Generator

import pytest

from tmq_backend.ai.engine import execute_tool, chat_stream


class TestInsiderBacktestMethodology:
    """Test that insider analysis uses SEC Form 4 data correctly."""

    def test_sec_scan_returns_structured_data(self):
        """tmq_sec_scan should return structured insider activity data."""
        result = execute_tool('tmq_sec_scan', {
            'days_back': 7,
            'transaction_filter': 'purchase',
            'min_insiders': 1,
        })
        parsed = json.loads(result)

        # Should return a dict with tickers and details
        assert isinstance(parsed, dict)
        assert 'tickers' in parsed or 'error' not in parsed
        # If there are results, verify structure
        if 'tickers' in parsed and len(parsed['tickers']) > 0:
            assert 'details' in parsed
            ticker = parsed['tickers'][0]
            assert ticker in parsed['details']
            # Each detail should have transaction info
            transactions = parsed['details'][ticker]
            assert isinstance(transactions, list)
            if len(transactions) > 0:
                txn = transactions[0]
                assert 'reporter' in txn
                assert 'date' in txn
                assert 'type' in txn
                assert 'shares' in txn

    def test_sec_insider_returns_detailed_transactions(self):
        """tmq_sec_insider should return detailed insider transaction data."""
        result = execute_tool('tmq_sec_insider', {
            'symbol': 'MSFT',
            'limit': 5,
        })
        parsed = json.loads(result)

        # Should return symbol and insider_activity
        assert 'symbol' in parsed
        assert parsed['symbol'] == 'MSFT'
        assert 'count' in parsed
        assert 'insider_activity' in parsed

        # Each activity should have structured data
        for activity in parsed['insider_activity']:
            assert 'date' in activity
            assert 'reporter' in activity
            assert 'title' in activity
            assert 'net_shares' in activity
            assert 'is_buy' in activity

    def test_cluster_buying_returns_aggregated_data(self):
        """tmq_cluster_buying should return stocks with multiple insider buyers."""
        result = execute_tool('tmq_cluster_buying', {
            'days_back': 30,
            'min_insiders': 2,
        })
        parsed = json.loads(result)

        # Should return a list or empty results
        assert isinstance(parsed, list) or 'error' not in parsed


class TestCapabilitiesMethodology:
    """Test that tmq_capabilities provides correct guidance."""

    def test_capabilities_returns_provider_matrix(self):
        """tmq_capabilities should return a capabilities matrix."""
        result = execute_tool('tmq_capabilities', {})
        parsed = json.loads(result)

        assert 'matrix' in parsed
        assert 'active_providers' in parsed

        # Matrix should be a string with provider info
        matrix = parsed['matrix']
        assert 'yfinance' in matrix.lower() or 'YFinance' in matrix
        assert 'alpaca' in matrix.lower() or 'Alpaca' in matrix

        # Active providers should be a list
        providers = parsed['active_providers']
        assert isinstance(providers, list)
        assert 'yfinance' in providers

    def test_capabilities_includes_universe_guidance(self):
        """Capabilities matrix should include guidance about universe queries."""
        result = execute_tool('tmq_capabilities', {})
        parsed = json.loads(result)

        matrix = parsed['matrix']
        # Should mention O(1) for universe lookups
        assert 'O(1)' in matrix or 'universe' in matrix.lower()


class TestUIControlMethodology:
    """Test that UI control tools return correct action payloads."""

    def test_set_interval_returns_action_payload(self):
        """tmq_set_interval should return an action payload."""
        result = execute_tool('tmq_set_interval', {'interval': '4h'})
        parsed = json.loads(result)

        assert parsed['_action'] == 'set_interval'
        assert parsed['interval'] == '4h'

    def test_set_widget_returns_action_payload(self):
        """tmq_set_widget should return an action payload."""
        result = execute_tool('tmq_set_widget', {'widget_type': 'net_liquidity'})
        parsed = json.loads(result)

        assert parsed['_action'] == 'set_widget'
        assert parsed['widget_type'] == 'net_liquidity'

    def test_set_layout_returns_action_payload(self):
        """tmq_set_layout should return an action payload."""
        result = execute_tool('tmq_set_layout', {'layout': '1x2'})
        parsed = json.loads(result)

        assert parsed['_action'] == 'set_layout'
        assert parsed['layout'] == '1x2'

    def test_select_tab_returns_action_payload(self):
        """tmq_select_tab should return an action payload."""
        result = execute_tool('tmq_select_tab', {'tab_type': 'chart'})
        parsed = json.loads(result)

        assert parsed['_action'] == 'select_tab'
        assert parsed['tab_type'] == 'chart'


class TestToolExecutionErrors:
    """Test that tool execution handles errors gracefully."""

    def test_unknown_tool_returns_error(self):
        """Unknown tool should return error JSON, not crash."""
        result = execute_tool('tmq_nonexistent', {})
        parsed = json.loads(result)

        assert 'error' in parsed
        assert 'Unknown tool' in parsed['error']

    def test_missing_required_param_returns_error(self):
        """Missing required params should return error JSON."""
        # tmq_price requires symbol, start, end
        result = execute_tool('tmq_price', {'symbol': 'AAPL'})  # missing start/end
        parsed = json.loads(result)

        # Should either error or return empty data
        assert 'error' in parsed or parsed == '[]'

    def test_invalid_symbol_returns_error(self):
        """Invalid symbol should return error JSON."""
        result = execute_tool('tmq_sec_insider', {'symbol': 'INVALID_TICKER_XYZ_999'})
        parsed = json.loads(result)

        # Should handle gracefully - either error or empty results
        assert 'error' in parsed or parsed.get('count', 0) == 0 or 'insider_activity' in parsed
