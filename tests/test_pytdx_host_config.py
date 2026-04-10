import json
from pathlib import Path

from pytdx_host_config import load_pytdx_hosts
from smart_monitor_tdx_data import SmartMonitorTDXDataFetcher


def _write_hosts_file(path: Path, hosts: list[dict]) -> None:
    path.write_text(json.dumps({"hosts": hosts}, ensure_ascii=False), encoding="utf-8")


def test_load_pytdx_hosts_from_repo_config_file(tmp_path):
    config_file = tmp_path / "pytdx_hosts.json"
    _write_hosts_file(
        config_file,
        [
            {"name": "成都", "host": "218.6.170.47", "port": 7709},
            {"name": "北京", "host": "123.125.108.14", "port": 7709},
        ],
    )

    hosts = load_pytdx_hosts(config_file)

    assert hosts == [
        ("成都", "218.6.170.47", 7709),
        ("北京", "123.125.108.14", 7709),
    ]


def test_fetcher_uses_repo_config_hosts_before_library_defaults(tmp_path):
    config_file = tmp_path / "pytdx_hosts.json"
    _write_hosts_file(
        config_file,
        [
            {"name": "成都", "host": "218.6.170.47", "port": 7709},
            {"name": "北京", "host": "123.125.108.14", "port": 7709},
        ],
    )

    fetcher = SmartMonitorTDXDataFetcher(host=None, fallback_hosts=[], hosts_file=config_file)

    assert fetcher.hosts[:2] == [
        ("成都", "218.6.170.47", 7709),
        ("北京", "123.125.108.14", 7709),
    ]

