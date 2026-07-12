"""Lockout por conta contra brute-force (Fase 1 / Bloco 1).

Regras: N falhas seguidas bloqueiam a conta temporariamente; sucesso zera o
contador; toda resposta de falha é GENÉRICA e idêntica (anti-enumeração);
lockout gera evento de auditoria; usuário inactive não autentica nem usa token.
"""
from datetime import datetime, timedelta, timezone

import pytest

from app.config import settings
from app.models import AuditLog, User

EMAIL = "analyst@hookshade.local"
PASSWORD = "changeme123"
GENERIC = {"detail": "Invalid credentials"}


def _login(client, password=PASSWORD, email=EMAIL):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def _user(db_session) -> User:
    db_session.expire_all()
    return db_session.query(User).filter(User.email == EMAIL).one()


@pytest.fixture(autouse=True)
def small_limits(monkeypatch):
    monkeypatch.setattr(settings, "login_max_attempts", 3)
    monkeypatch.setattr(settings, "login_lockout_minutes", 15)


def test_failed_attempts_accumulate(client, db_session):
    _login(client, password="errada")
    _login(client, password="errada")
    assert _user(db_session).failed_login_attempts == 2


def test_lockout_after_max_attempts(client, db_session):
    for _ in range(3):
        assert _login(client, password="errada").status_code == 401
    user = _user(db_session)
    assert user.locked_until is not None
    # bloqueada: nem a senha CORRETA autentica
    r = _login(client)
    assert r.status_code == 401
    assert r.json() == GENERIC


def test_locked_response_identical_to_wrong_password(client):
    wrong = _login(client, password="errada")
    for _ in range(2):
        _login(client, password="errada")
    locked = _login(client)  # senha correta, conta bloqueada
    assert locked.status_code == wrong.status_code == 401
    assert locked.json() == wrong.json() == GENERIC


def test_unknown_email_response_identical(client):
    r = _login(client, email="nao-existe@hookshade.local")
    assert r.status_code == 401
    assert r.json() == GENERIC


def test_success_resets_counter(client, db_session):
    _login(client, password="errada")
    _login(client, password="errada")
    r = _login(client)
    assert r.status_code == 200
    user = _user(db_session)
    assert user.failed_login_attempts == 0
    assert user.locked_until is None


def test_lockout_expires(client, db_session):
    for _ in range(3):
        _login(client, password="errada")
    user = _user(db_session)
    user.locked_until = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=1)
    db_session.commit()
    assert _login(client).status_code == 200


def test_lockout_records_audit_event(client, db_session):
    for _ in range(3):
        _login(client, password="errada")
    events = db_session.query(AuditLog).filter(AuditLog.action == "auth.lockout").all()
    assert len(events) == 1
    assert events[0].actor_id == _user(db_session).id


def test_failed_attempt_records_timestamp(client, db_session):
    _login(client, password="errada")
    assert _user(db_session).last_failed_login_at is not None


def test_inactive_user_cannot_login(client, db_session):
    user = _user(db_session)
    user.status = "inactive"
    db_session.commit()
    r = _login(client)
    assert r.status_code == 401
    assert r.json() == GENERIC


def test_inactive_user_token_is_rejected(client, db_session):
    _login(client)
    user = _user(db_session)
    user.status = "inactive"
    db_session.commit()
    r = client.get("/api/v1/auth/me")
    assert r.status_code == 401
