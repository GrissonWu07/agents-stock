"""Small helpers for non-blocking Streamlit flash messages across reruns."""

from __future__ import annotations

from typing import Any, MutableMapping

import streamlit as st


def _flash_key(namespace: str) -> str:
    return f"__flash_messages__:{namespace}"


def queue_flash_message(
    state: MutableMapping[str, Any],
    namespace: str,
    level: str,
    message: str,
) -> None:
    """Queue a flash message that will be rendered after the next rerun."""

    key = _flash_key(namespace)
    messages = list(state.get(key, []))
    messages.append({"level": level, "message": message})
    state[key] = messages


def consume_flash_messages(
    state: MutableMapping[str, Any],
    namespace: str,
) -> list[dict[str, str]]:
    """Pop any queued flash messages for a namespace."""

    key = _flash_key(namespace)
    return list(state.pop(key, []))


def render_flash_messages(namespace: str, state: MutableMapping[str, Any] | None = None) -> None:
    """Render queued flash messages using the matching Streamlit method."""

    flash_state = state or st.session_state
    for item in consume_flash_messages(flash_state, namespace):
        level = item.get("level", "info")
        message = item.get("message", "")
        renderer = getattr(st, level, None)
        if callable(renderer):
            renderer(message)
        else:
            st.info(message)
