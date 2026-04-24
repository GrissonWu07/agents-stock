from app import akshare_client


def test_stock_individual_info_em_uses_single_attempt_by_default(monkeypatch):
    calls: list[int] = []

    def stock_individual_info_em():
        calls.append(1)
        raise ConnectionError("remote closed")

    monkeypatch.setattr(akshare_client, "AKSHARE_MAX_RETRIES", 3)
    monkeypatch.setattr(akshare_client, "AKSHARE_BASIC_INFO_MAX_RETRIES", 1, raising=False)
    monkeypatch.setattr(akshare_client, "AKSHARE_BASE_BACKOFF_SECONDS", 0.0)
    monkeypatch.setattr(akshare_client, "AKSHARE_MAX_BACKOFF_SECONDS", 0.0)
    monkeypatch.setattr(akshare_client, "AKSHARE_MIN_INTERVAL_SECONDS", 0.0)
    monkeypatch.setattr(akshare_client.random, "uniform", lambda start, end: 0.0)

    try:
        akshare_client._call_with_retries(stock_individual_info_em)
    except ConnectionError:
        pass

    assert len(calls) == 1
