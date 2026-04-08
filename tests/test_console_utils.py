import builtins

import console_utils


class GbkStdout:
    encoding = "gbk"

    def __init__(self):
        self.buffer = []

    def write(self, text):
        text.encode(self.encoding)
        self.buffer.append(text)
        return len(text)

    def flush(self):
        return None


def test_safe_print_handles_gbk_stdout(monkeypatch):
    fake_stdout = GbkStdout()
    monkeypatch.setattr("sys.stdout", fake_stdout)

    console_utils.safe_print("🚀 主力选股启动")

    assert fake_stdout.buffer


def test_install_safe_print_replaces_builtin_print(monkeypatch):
    fake_stdout = GbkStdout()
    monkeypatch.setattr("sys.stdout", fake_stdout)
    monkeypatch.setattr(builtins, "print", console_utils.ORIGINAL_PRINT)

    console_utils.install_safe_print()
    builtins.print("✅ 编码保护已启用")

    assert builtins.print is console_utils.safe_print
    assert fake_stdout.buffer
