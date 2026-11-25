from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi.testclient import TestClient

from app.config import Settings, settings
from app.main import app
from app.models import User
from app.security import hash_password
from tests.conftest import arm_csrf, authenticate
from tests.test_portfolio import demo  # noqa: F401


def test_demo_logout_preserves_other_visitor(demo, db_session):
    with TestClient(app) as other:
        arm_csrf(other)
        assert other.post("/api/v1/auth/demo").status_code == 200
        version = db_session.query(User).filter_by(role="demo").one().token_version
        assert demo.post("/api/v1/auth/logout").status_code == 204
        assert settings.session_cookie_name not in demo.cookies
        assert demo.get("/api/v1/auth/me").status_code == 401
        assert other.get("/api/v1/auth/me").status_code == 200
        db_session.expire_all()
        assert db_session.query(User).filter_by(role="demo").one().token_version == version


@pytest.mark.parametrize("endpoint", ["demo", "login"])
def test_demo_expiration(demo, monkeypatch, endpoint):
    monkeypatch.setattr(settings, "demo_session_minutes", 7)
    monkeypatch.setattr(settings, "access_token_expire_minutes", 60)
    if endpoint == "demo":
        response = demo.post("/api/v1/auth/demo")
    else:
        response = authenticate(demo, "demo@hookshade.example", "test-only-demo-password")
    assert response.status_code == 200
    token = demo.cookies.get(settings.session_cookie_name)
    payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
    now = datetime.now(timezone.utc)
    assert 418 <= payload["exp"] - now.timestamp() <= 420
    assert "Max-Age=420" in response.headers["set-cookie"]
    from jwt import api_jwt

    class AfterExpiration(datetime):
        @classmethod
        def now(cls, tz=None):
            return now + timedelta(minutes=7, seconds=1)

    assert demo.get("/api/v1/auth/me").status_code == 200
    monkeypatch.setattr(api_jwt, "datetime", AfterExpiration)
    assert demo.get("/api/v1/auth/me").status_code == 401


def test_demo_failed_login_does_not_change_version(demo, db_session, monkeypatch):
    monkeypatch.setattr(settings, "login_max_attempts", 1)
    user = db_session.query(User).filter_by(role="demo").one()
    version = user.token_version
    assert authenticate(demo, user.email, "test-only-wrong-password").status_code == 401
    db_session.refresh(user)
    assert user.locked_until is not None
    assert user.token_version == version


@pytest.mark.parametrize("role", ["analyst", "admin"])
def test_regular_logout_still_revokes(client, db_session, monkeypatch, role):
    monkeypatch.setattr(settings, "demo_session_minutes", 7)
    monkeypatch.setattr(settings, "access_token_expire_minutes", 60)
    user = User(name="Pessoa fictícia", email="session@example.com", role=role,
                password_hash=hash_password("test-only-password"))
    db_session.add(user)
    db_session.commit()
    assert authenticate(client, user.email, "test-only-password").status_code == 200
    old = client.cookies.get(settings.session_cookie_name)
    payload = jwt.decode(old, settings.secret_key, algorithms=["HS256"])
    assert 3598 <= payload["exp"] - datetime.now(timezone.utc).timestamp() <= 3600
    assert client.post("/api/v1/auth/logout").status_code == 204
    client.cookies.set(settings.session_cookie_name, old)
    assert client.get("/api/v1/auth/me").status_code == 401


@pytest.mark.parametrize("role", ["analyst", "admin"])
@pytest.mark.parametrize("action", ["password", "lockout"])
def test_regular_password_and_lockout_still_revoke(client, db_session, as_user, monkeypatch, role, action):
    user = User(name="Pessoa fictícia", email="revoke@example.com", role=role,
                password_hash=hash_password("test-only-password"))
    db_session.add(user)
    db_session.commit()
    other = as_user(user.email, "test-only-password")
    if action == "password":
        assert authenticate(client).status_code == 200
        assert client.patch(f"/api/v1/users/{user.id}/password",
                            json={"password": "test-only-new-password"}).status_code == 200
    else:
        monkeypatch.setattr(settings, "login_max_attempts", 1)
        assert authenticate(client, user.email, "test-only-wrong-password").status_code == 401
        # Expira só o bloqueio: a versão antiga ainda precisa ser recusada.
        db_session.refresh(user)
        user.locked_until = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=1)
        db_session.commit()
    assert other.get("/api/v1/auth/me").status_code == 401


def test_demo_duration_setting(monkeypatch):
    monkeypatch.delenv("DEMO_SESSION_MINUTES", raising=False)
    assert Settings(_env_file=None).demo_session_minutes == 30
    monkeypatch.setenv("DEMO_SESSION_MINUTES", "9")
    assert Settings(_env_file=None).demo_session_minutes == 9
    monkeypatch.setenv("DEMO_SESSION_MINUTES", "0")
    with pytest.raises(ValueError):
        Settings(_env_file=None)


@pytest.mark.parametrize("environment,enabled,expected", [
    ("development", False, False), ("production", True, False),
    ("development", True, True),
])
def test_e2e_seed_is_opt_in_and_never_production(db_session, monkeypatch, environment, enabled, expected):
    from app.seed import ensure_e2e_user

    monkeypatch.setattr(settings, "environment", environment)
    monkeypatch.setattr(settings, "e2e_seed_enabled", enabled)
    ensure_e2e_user(db_session)
    ensure_e2e_user(db_session)
    users = db_session.query(User).filter_by(email="e2e-analyst@example.com").all()
    assert len(users) == int(expected)
    if expected:
        assert users[0].role == "analyst"
