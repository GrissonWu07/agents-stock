from app.gateway.signal_table import build_signal_summary_row


def test_signal_summary_row_exposes_portfolio_buy_tier():
    row = build_signal_summary_row(
        {
            "id": 42,
            "stock_code": "300857",
            "stock_name": "协创数据",
            "action": "BUY",
            "status": "observed",
            "updated_at": "2026-04-05T10:00:00Z",
            "strategy_profile": {
                "portfolio_execution_guard": {
                    "status": "downgraded",
                    "buy_tier_label": "弱买",
                    "buy_strength_score": 0.42,
                    "size_multiplier": 0.25,
                    "portfolio_guard": {
                        "reasons": ["组合近期连续止损，BUY 自动降级"],
                    },
                    "late_rebound_reasons": ["疑似反弹尾段"],
                },
            },
        },
        1,
        time_key="updated_at",
        status_key="status",
    )

    assert "弱买 · 0.4200" in row["cells"]
    assert "x0.2500" in row["cells"]
    assert any("组合近期连续止损" in str(cell) and "疑似反弹尾段" in str(cell) for cell in row["cells"])
