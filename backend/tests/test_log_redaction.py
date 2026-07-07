"""Logging estruturado com redaction (Fase 1 / Bloco 1).

Toda requisição gera uma linha JSON com request_id, método, rota, status e
latência; user_id quando autenticado. NUNCA aparecem: senha, token, raw_content,
headers sensíveis, segredos.
"""
import io
import json
import logging

import pytest

from app.request_logging import JsonFormatter, redact

EMAIL = "analyst@hookshade.local"
PASSWORD = "changeme123"


@pytest.fixture
def log_output(client):
    logger = logging.getLogger("hookshade")
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(JsonFormatter())
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    yield stream
    logger.removeHandler(handler)


def _login(client, password=PASSWORD):
    return client.post("/api/v1/auth/login", json={"email": EMAIL, "password": password})


def _lines(stream) -> list[dict]:
    return [json.loads(line) for line in stream.getvalue().splitlines() if line.strip()]


# ---------- unidade: redact ----------

def test_redact_masks_sensitive_keys_recursively():
    data = {
        "password": "s3nha",
        "Authorization": "Bearer abc",
        "nested": {"access_token": "xyz", "raw_content": "corpo do email"},
        "ok": "mantido",
    }
    out = redact(data)
    assert out["password"] == "[REDACTED]"
    assert out["Authorization"] == "[REDACTED]"
    assert out["nested"]["access_token"] == "[REDACTED]"
    assert out["nested"]["raw_content"] == "[REDACTED]"
    assert out["ok"] == "mantido"


# ---------- requisições geram log estruturado ----------

def test_request_generates_structured_log(client, log_output):
    client.get("/health")
    events = [e for e in _lines(log_output) if e.get("event") == "request"]
    assert len(events) == 1
    ev = events[0]
    assert ev["method"] == "GET"
    assert ev["path"] == "/health"
    assert ev["status"] == 200
    assert "request_id" in ev and ev["request_id"]
    assert "duration_ms" in ev


def test_response_carries_request_id_header(client, log_output):
    r = client.get("/health")
    assert r.headers.get("x-request-id")
    ev = [e for e in _lines(log_output) if e.get("event") == "request"][0]
    assert ev["request_id"] == r.headers["x-request-id"]


def test_authenticated_request_logs_user_id_not_email(client, log_output):
    token = _login(client).json()["access_token"]
    client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    me_events = [e for e in _lines(log_output)
                 if e.get("event") == "request" and e.get("path") == "/api/v1/auth/me"]
    assert me_events and me_events[0].get("user_id") is not None
    assert EMAIL not in log_output.getvalue()


# ---------- nada sensível no log ----------

def test_login_does_not_log_password(client, log_output):
    _login(client, password="SenhaSuperSecreta!2026")
    out = log_output.getvalue()
    assert "SenhaSuperSecreta!2026" not in out
    assert out.strip(), "login deveria gerar log de request"


def test_token_never_appears_in_logs(client, log_output):
    token = _login(client).json()["access_token"]
    client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert token not in log_output.getvalue()


def test_analysis_does_not_log_raw_content(client, log_output):
    token = _login(client).json()["access_token"]
    marker = "CONTEUDO-CONFIDENCIAL-DO-EMAIL-9f8e7d"
    client.post("/api/v1/analyses/text",
                json={"content": f"De: alguem. {marker}", "context": None},
                headers={"Authorization": f"Bearer {token}"})
    out = log_output.getvalue()
    assert marker not in out
    assert any(e.get("path") == "/api/v1/analyses/text" for e in _lines(out and log_output))


def test_validation_error_does_not_leak_body(client, log_output):
    token = _login(client).json()["access_token"]
    marker = "MARCADOR-DE-CORPO-INVALIDO-42"
    r = client.post("/api/v1/analyses/text",
                    json={"content": "   ", "context": marker},
                    headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 422
    assert marker not in log_output.getvalue()
