from unittest.mock import Mock

import pandas as pd

from low_price_bull_service import LowPriceBullService


def test_get_stock_data_uses_tdx_fetcher_instead_of_rest():
    service = LowPriceBullService()
    service.tdx_fetcher = Mock()
    service.tdx_fetcher.get_kline_data.return_value = pd.DataFrame(
        {
            "日期": pd.date_range("2024-01-01", periods=20, freq="D"),
            "开盘": list(range(1, 21)),
            "收盘": list(range(1, 21)),
            "最高": list(range(1, 21)),
            "最低": list(range(1, 21)),
            "成交量": [1000] * 20,
            "成交额": [10000.0] * 20,
        }
    )

    current_price, ma5, ma20 = service._get_stock_data("002259.SZ")

    service.tdx_fetcher.get_kline_data.assert_called_once_with("002259", kline_type="day", limit=60)
    assert current_price == 20
    assert ma5 == 18
    assert ma20 == 10.5
