"""Helpers for loading repo-local pytdx host configuration."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable


DEFAULT_PYTDX_PORT = 7709


def load_pytdx_hosts(config_file: str | Path | None) -> list[tuple[str, str, int]]:
    if not config_file:
        return []

    path = Path(config_file)
    if not path.exists():
        return []

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []

    raw_hosts = _extract_host_items(payload)
    hosts: list[tuple[str, str, int]] = []
    seen: set[tuple[str, int]] = set()

    for item in raw_hosts:
        parsed = _normalize_host_item(item)
        if parsed is None:
            continue
        key = (parsed[1], parsed[2])
        if key in seen:
            continue
        seen.add(key)
        hosts.append(parsed)

    return hosts


def _extract_host_items(payload: object) -> Iterable[object]:
    if isinstance(payload, dict):
        hosts = payload.get("hosts")
        return hosts if isinstance(hosts, list) else []
    if isinstance(payload, list):
        return payload
    return []


def _normalize_host_item(item: object) -> tuple[str, str, int] | None:
    if isinstance(item, dict):
        host = str(item.get("host") or "").strip()
        if not host:
            return None
        name = str(item.get("name") or host).strip()
        port = _normalize_port(item.get("port"))
        return (name, host, port)

    if isinstance(item, str):
        host_info = item.strip()
        if not host_info:
            return None
        if ":" in host_info:
            host, raw_port = host_info.rsplit(":", 1)
            return (host, host, _normalize_port(raw_port))
        return (host_info, host_info, DEFAULT_PYTDX_PORT)

    return None


def _normalize_port(raw_port: object) -> int:
    try:
        return int(raw_port or DEFAULT_PYTDX_PORT)
    except (TypeError, ValueError):
        return DEFAULT_PYTDX_PORT

