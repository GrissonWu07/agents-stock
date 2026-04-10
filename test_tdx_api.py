#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
pytdx 连通性诊断脚本
用于验证 TDX 配置和 pytdx 数据获取是否正常
"""

from console_utils import safe_print as print
import sys
from pprint import pprint

from dotenv import load_dotenv

from config import TDX_CONFIG
from smart_monitor_tdx_data import SmartMonitorTDXDataFetcher


def build_fetcher() -> SmartMonitorTDXDataFetcher:
    return SmartMonitorTDXDataFetcher(
        host=TDX_CONFIG.get("host"),
        port=TDX_CONFIG.get("port", 7709),
        hosts_file=TDX_CONFIG.get("hosts_file"),
        timeout=TDX_CONFIG.get("timeout", 5),
    )


def main() -> int:
    load_dotenv()

    print("=" * 60)
    print("pytdx 配置测试")
    print("=" * 60)
    print(f"\n1. TDX_HOST: {TDX_CONFIG.get('host') or '未配置，使用pytdx内置服务器列表'}")
    print(f"2. TDX_PORT: {TDX_CONFIG.get('port', 7709)}")
    print(f"3. TDX_TIMEOUT: {TDX_CONFIG.get('timeout', 5)}")
    print(f"4. TDX_HOSTS_FILE: {TDX_CONFIG.get('hosts_file')}")
    print(f"5. TDX_FALLBACK_HOSTS: {TDX_CONFIG.get('fallback_hosts', [])}")

    fetcher = build_fetcher()

    print("\n6. 测试实时行情接口...")
    quote = fetcher.get_realtime_quote("000001")
    if not quote:
        print("   x 获取实时行情失败")
        return 1

    print("   ok 获取实时行情成功")
    pprint(quote)

    print("\n7. 测试K线接口...")
    kline_df = fetcher.get_kline_data("000001", kline_type="day", limit=20)
    if kline_df is None or kline_df.empty:
        print("   x 获取K线数据失败")
        return 1

    print(f"   ok 获取K线数据成功，共 {len(kline_df)} 条")
    print(kline_df.tail(3).to_string(index=False))

    print("\n8. 测试技术指标计算...")
    indicators = fetcher.get_technical_indicators("000001")
    if not indicators:
        print("   x 技术指标计算失败")
        return 1

    print("   ok 技术指标计算成功")
    pprint(indicators)

    print("\n" + "=" * 60)
    print("所有 pytdx 测试通过")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
