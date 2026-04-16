from __future__ import annotations

import io
import sys

import pytest

import app.fund_flow_akshare as fund_flow_akshare
import app.market_sentiment_data as market_sentiment_data
import app.news_announcement_data as news_announcement_data
import app.qstock_news_data as qstock_news_data
import app.quarterly_report_data as quarterly_report_data


@pytest.mark.parametrize(
    ("module", "module_name"),
    [
        (fund_flow_akshare, "fund_flow_akshare"),
        (market_sentiment_data, "market_sentiment_data"),
        (news_announcement_data, "news_announcement_data"),
        (qstock_news_data, "qstock_news_data"),
        (quarterly_report_data, "quarterly_report_data"),
    ],
)
def test_stdout_encoding_setup_does_not_replace_stdout(monkeypatch, module, module_name):
    fake_stdout = io.TextIOWrapper(io.BytesIO(), encoding="utf-8")

    monkeypatch.setattr(sys, "platform", "win32")
    monkeypatch.setattr(sys, "stdout", fake_stdout)

    module._setup_stdout_encoding()

    assert sys.stdout is fake_stdout, f"{module_name} should not replace sys.stdout"
