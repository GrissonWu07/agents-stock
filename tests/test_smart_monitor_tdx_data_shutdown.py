from app import smart_monitor_tdx_data
from app.smart_monitor_tdx_data import SmartMonitorTDXDataFetcher


def test_tdx_failover_skips_remote_hosts_after_shutdown_signal():
    smart_monitor_tdx_data.request_shutdown()
    try:
        fetcher = SmartMonitorTDXDataFetcher(fallback_hosts=[])
        fetcher.hosts = [("测试节点", "127.0.0.1", 7709)]
        operation_calls: list[object] = []

        result = fetcher._call_with_failover(lambda api: operation_calls.append(api))

        assert result is None
        assert operation_calls == []
    finally:
        smart_monitor_tdx_data.reset_shutdown()
