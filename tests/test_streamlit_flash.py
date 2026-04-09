import streamlit_flash as flash


def test_queue_and_consume_flash_messages_round_trip():
    state = {}

    flash.queue_flash_message(state, "portfolio", "success", "已添加成功")
    flash.queue_flash_message(state, "portfolio", "warning", "请检查输入")

    messages = flash.consume_flash_messages(state, "portfolio")

    assert messages == [
        {"level": "success", "message": "已添加成功"},
        {"level": "warning", "message": "请检查输入"},
    ]
    assert flash.consume_flash_messages(state, "portfolio") == []


def test_render_flash_messages_uses_matching_streamlit_level(monkeypatch):
    rendered = []
    state = {}
    flash.queue_flash_message(state, "monitor", "success", "监测已启动")
    flash.queue_flash_message(state, "monitor", "unknown", "fallback")

    class FakeStreamlit:
        session_state = state

        @staticmethod
        def success(message):
            rendered.append(("success", message))

        @staticmethod
        def info(message):
            rendered.append(("info", message))

    monkeypatch.setattr(flash, "st", FakeStreamlit)

    flash.render_flash_messages("monitor", state=state)

    assert rendered == [
        ("success", "监测已启动"),
        ("info", "fallback"),
    ]
    assert flash.consume_flash_messages(state, "monitor") == []
