import app.data_source_manager as dsm


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


def test_data_source_manager_init_handles_gbk_stdout(monkeypatch):
    fake_stdout = GbkStdout()

    monkeypatch.setattr("sys.stdout", fake_stdout)
    monkeypatch.setattr(
        dsm.os,
        "getenv",
        lambda key, default="": "" if key == "TUSHARE_TOKEN" else default,
    )

    manager = dsm.DataSourceManager()

    assert manager.tushare_available is False
    assert fake_stdout.buffer
