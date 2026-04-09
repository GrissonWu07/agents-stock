from main_force_ui import update_main_force_progress_ui


class FakeStatus:
    def __init__(self):
        self.calls = []

    def update(self, **kwargs):
        self.calls.append(kwargs)


class FakeProgressBar:
    def __init__(self):
        self.values = []

    def progress(self, value):
        self.values.append(value)


class FakePlaceholder:
    def __init__(self):
        self.messages = []

    def caption(self, message):
        self.messages.append(message)


def test_update_main_force_progress_ui_updates_all_widgets():
    status = FakeStatus()
    progress_bar = FakeProgressBar()
    placeholder = FakePlaceholder()

    update_main_force_progress_ui(status, progress_bar, placeholder, 45, "正在并行生成三份AI分析报告...")

    assert progress_bar.values == [45]
    assert placeholder.messages == ["当前阶段：正在并行生成三份AI分析报告..."]
    assert status.calls == [{"label": "正在并行生成三份AI分析报告...", "state": "running"}]
