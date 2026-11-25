import asyncio
import logging

import pytest
from starlette.requests import Request

from app.config import Settings, settings
from app.models import Analysis, AuditLog, Finding, IOC, Recommendation, User
from app.routers.analyses import _read_capped
from tests.test_portfolio import demo  # noqa: F401 — reutiliza o login demo existente

URL = "/api/v1/analyses/preview"
RAW = "From: ficticio@example.com\nSubject: PREVIEW-MARCADOR-FICTICIO\n\nhttps://contoso.example/login 192.0.2.12"


def test_demo_preview_is_ephemeral(demo, db_session, caplog):
    tables = [Analysis, IOC, Finding, Recommendation, AuditLog]
    before = [db_session.query(t).count() for t in tables]
    with caplog.at_level(logging.INFO):
        response = demo.post(URL, json={"content": RAW})
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == 0 and data["source_type"] == "preview"
    assert data["created_at"]
    assert data["iocs"]
    assert all(set(ioc) == {"type", "value_defanged", "value_hash"} for ioc in data["iocs"])
    assert [db_session.query(t).count() for t in tables] == before
    assert "PREVIEW-MARCADOR-FICTICIO" not in caplog.text
    events = [r for r in caplog.records if r.message == "analysis.preview"]
    assert len(events) == 1
    assert events[0].ctx == {
        "user_id": db_session.query(User).filter_by(role="demo").one().id,
        "role": "demo", "bytes": len(RAW.encode()),
        "severity": data["severity"], "risk_score": data["risk_score"],
    }


def test_preview_content_length_rejected_before_read(demo, monkeypatch):
    original = Request.stream

    async def guarded(self):
        if self.url.path == URL:
            pytest.fail("O corpo não deve ser lido")
        async for chunk in original(self):
            yield chunk

    monkeypatch.setattr(Request, "stream", guarded)
    response = demo.post(URL, content=b"{}", headers={"Content-Length": str(2 * settings.preview_max_bytes + 1025)})
    assert response.status_code == 413
    assert response.json()["detail"] == "Conteúdo acima de 64 KB"


def test_read_capped_stops_at_cap():
    """Corpo chunked (sem Content-Length): a leitura para no teto, sem consumir o resto.

    O TestClient entrega o corpo numa mensagem só, então o teste usa a função de leitura direto.
    """
    pulled = 0

    async def chunks():
        nonlocal pulled
        for _ in range(1000):  # ~1 MB
            pulled += 1
            yield b"a" * 1024

    assert asyncio.run(_read_capped(chunks(), 3 * 1024)) is None
    assert pulled == 4  # 4 KB > 3 KB: parou no quarto pedaço

    async def small():
        yield b'{"content": '
        yield b'"ok"}'

    assert asyncio.run(_read_capped(small(), 3 * 1024)) == b'{"content": "ok"}'


def test_preview_chunked_body_over_cap_is_413(demo, monkeypatch):
    monkeypatch.setattr(settings, "preview_max_bytes", 1024)

    def chunks():
        yield b'{"content": "'
        for _ in range(100):
            yield b"a" * 1024
        yield b'"}'

    response = demo.post(URL, content=chunks())
    assert response.status_code == 413


def test_preview_max_size_with_many_newlines_is_accepted(demo):
    """O escape do JSON (\\n) não pode derrubar um e-mail que cabe no limite."""
    line = "linha ficticia\n"  # 15 bytes, vira 16 no JSON
    raw = "From: ficticio@example.com\n\n" + line * ((settings.preview_max_bytes - 28) // len(line))
    assert len(raw.encode()) <= settings.preview_max_bytes
    assert demo.post(URL, json={"content": raw}).status_code == 200


def test_preview_real_multibyte_limit(demo, monkeypatch):
    monkeypatch.setattr(settings, "preview_max_bytes", 1024)
    response = demo.post(URL, json={"content": "á" * 513}, headers={"Content-Length": "1"})
    assert response.status_code == 413
    assert response.json()["detail"] == "Conteúdo acima de 1 KB"
    assert demo.post(URL, json={"content": "á" * 512}, headers={"Content-Length": "1"}).status_code == 200


@pytest.mark.parametrize("body", [{"content": ""}, {"content": "  \n"}, {"content": RAW, "context": "fictício"}, {"content": {"private": RAW}}, {}])
def test_invalid_preview_is_generic(demo, body):
    response = demo.post(URL, json=body)
    assert response.status_code == 422
    assert "PREVIEW-MARCADOR-FICTICIO" not in response.text


def test_malformed_json_is_generic(demo, caplog):
    response = demo.post(URL, content='{"content":"PREVIEW-MARCADOR-FICTICIO', headers={"Content-Type": "application/json"})
    assert response.status_code == 422
    assert "PREVIEW-MARCADOR-FICTICIO" not in response.text + caplog.text


def test_pipeline_error_is_generic(demo, monkeypatch, caplog):
    def fail(*args, **kwargs):
        raise ValueError(RAW)
    monkeypatch.setattr("app.routers.analyses.run_analysis", fail)
    response = demo.post(URL, json={"content": RAW})
    assert response.status_code == 500
    assert response.json() == {"detail": "Falha na análise"}
    assert "PREVIEW-MARCADOR-FICTICIO" not in response.text + caplog.text


def test_preview_requires_session(client):
    assert client.post(URL, json={"content": RAW}).status_code == 401


def test_preview_requires_csrf(demo):
    demo.headers.pop("X-CSRF-Token")
    assert demo.post(URL, json={"content": RAW}).status_code == 403


def test_demo_upload_still_forbidden(demo):
    assert demo.post("/api/v1/analyses", files={"file": ("ficticio.eml", RAW, "message/rfc822")}).status_code == 403


def test_preview_limits_do_not_consume_sample_quota(demo, monkeypatch):
    monkeypatch.setattr(settings, "preview_rate_per_minute", 1)
    assert demo.post(URL, json={"content": RAW}).status_code == 200
    assert demo.post(URL, json={"content": RAW}).status_code == 429
    assert demo.post("/api/v1/analyses/samples/phishing").status_code == 200


def test_preview_minute_limit(demo):
    for _ in range(5):
        assert demo.post(URL, json={"content": RAW}).status_code == 200
    assert demo.post(URL, json={"content": RAW}).status_code == 429


@pytest.mark.parametrize("setting,rotate_ip", [("preview_rate_per_hour", False), ("preview_global_per_hour", True)])
def test_preview_hour_limits(demo, monkeypatch, setting, rotate_ip):
    monkeypatch.setattr(settings, setting, 2)
    for i, expected in enumerate([200, 200, 429]):
        headers = {"X-Forwarded-For": f"192.0.2.{i + 1}"} if rotate_ip else {}
        assert demo.post(URL, json={"content": RAW}, headers=headers).status_code == expected


@pytest.mark.parametrize("role", ["admin", "analyst", "viewer"])
def test_preview_all_roles_limited(client, login, db_session, monkeypatch, role):
    user = db_session.query(User).filter_by(role="admin").one()
    user.role = role
    db_session.commit()
    login()
    monkeypatch.setattr(settings, "preview_global_per_hour", 1)
    assert client.post(URL, json={"content": RAW}).status_code == 200
    assert client.post(URL, json={"content": RAW}).status_code == 429


@pytest.mark.parametrize("key", ["PREVIEW_MAX_BYTES", "PREVIEW_RATE_PER_MINUTE", "PREVIEW_RATE_PER_HOUR", "PREVIEW_GLOBAL_PER_HOUR"])
def test_preview_settings_positive_alias(key):
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        Settings(_env_file=None, **{key: 0})
    assert getattr(Settings(_env_file=None, **{key: 7}), key.lower()) == 7
