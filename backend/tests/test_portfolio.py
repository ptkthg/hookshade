import pytest

from app.config import settings
from app.models import Analysis, AuditLog, DetectionRule, Finding, IOC, Recommendation, User
from app.security import hash_password
from tests.conftest import authenticate


@pytest.fixture
def demo(client, db_session, monkeypatch):
    monkeypatch.setattr(settings, "demo_enabled", True)
    monkeypatch.setattr(settings, "demo_password", "test-only-demo-password")
    from app.seed import ensure_demo
    ensure_demo(db_session)
    assert client.post("/api/v1/auth/demo").status_code == 200
    return client


@pytest.mark.parametrize("method,path,body", [
    ("POST", "/analyses", {}), ("POST", "/analyses/text", {"content": "test"}),
    ("DELETE", "/analyses/1", None), ("POST", "/rules", {}),
    ("PUT", "/rules/1", {}), ("DELETE", "/rules/1", {}),
    ("POST", "/rules/1/activate", {}), ("POST", "/rules/1/deactivate", {}),
    ("POST", "/rules/test", {}), ("POST", "/users", {}),
    ("PATCH", "/users/1/role", {"role": "admin"}),
    ("PATCH", "/users/1/status", {"status": "inactive"}),
    ("PATCH", "/users/1/password", {"password": "test-only-password"}),
    ("GET", "/users", None), ("GET", "/audit", None),
])
def test_demo_forbidden_matrix(demo, method, path, body):
    assert demo.request(method, "/api/v1" + path, json=body).status_code == 403


def test_demo_disabled(client, monkeypatch):
    monkeypatch.setattr(settings, "demo_enabled", False)
    assert client.get("/api/v1/auth/config").json() == {"demo_enabled": False}
    assert client.post("/api/v1/auth/demo").status_code == 403


def test_demo_requires_password_even_when_enabled(client, monkeypatch):
    monkeypatch.setattr(settings, "demo_enabled", True)
    monkeypatch.setattr(settings, "demo_password", "")
    assert client.get("/api/v1/auth/config").json() == {"demo_enabled": False}
    assert client.post("/api/v1/auth/demo").status_code == 403


def test_switching_demo_off_revokes_access(demo, monkeypatch):
    monkeypatch.setattr(settings, "demo_enabled", False)
    assert demo.get("/api/v1/auth/me").status_code == 401


def test_demo_seed_and_samples_do_not_persist(demo, db_session):
    from app.seed import ensure_demo
    tables = [User, Analysis, IOC, Finding, Recommendation, AuditLog, DetectionRule]
    counts = [db_session.query(t).count() for t in tables]
    ensure_demo(db_session)
    assert [db_session.query(t).count() for t in tables] == counts
    rows = demo.get("/api/v1/analyses").json()
    assert len(rows) == 4
    assert len({r["risk_score"] for r in rows}) > 1
    for row in rows:
        assert demo.get(f'/api/v1/analyses/{row["id"]}').status_code == 200
    response = demo.post("/api/v1/analyses/samples/phishing")
    assert response.status_code == 200
    assert response.json()["iocs"]
    assert [db_session.query(t).count() for t in tables] == counts
    assert demo.post("/api/v1/analyses/samples/unknown").status_code == 404


def test_demo_rate_limit_and_csrf(demo):
    for _ in range(2):
        assert demo.post("/api/v1/auth/demo").status_code == 200
    assert demo.post("/api/v1/auth/demo").status_code == 429
    demo.headers.pop("X-CSRF-Token")
    assert demo.post("/api/v1/auth/demo").status_code == 403


def test_logout_revokes_token(client, login):
    login()
    cookie = client.cookies.get(settings.session_cookie_name)
    assert client.post("/api/v1/auth/logout").status_code == 204
    client.cookies.set(settings.session_cookie_name, cookie)
    assert client.get("/api/v1/auth/me").status_code == 401
    assert client.post("/api/v1/auth/logout").status_code == 204


def test_password_reset_revokes_token(client, login):
    login()
    assert client.patch("/api/v1/users/1/password", json={"password": "test-only-new-password"}).status_code == 200
    assert client.get("/api/v1/auth/me").status_code == 401


def test_lockout_revokes_token(client, login, monkeypatch):
    login()
    monkeypatch.setattr(settings, "login_max_attempts", 1)
    assert authenticate(client, password="wrong").status_code == 401
    assert client.get("/api/v1/auth/me").status_code == 401


def test_demo_cannot_read_other_users_analysis(demo, db_session):
    other = User(name="Fictício", email="other@example.com", password_hash=hash_password("test-only-password"))
    db_session.add(other)
    db_session.flush()
    from app.routers.analyses import _persist
    row = _persist(db_session, other, "Subject: Fictício\n\nhello", "text", None)
    assert demo.get(f"/api/v1/analyses/{row.id}").status_code == 404


@pytest.mark.parametrize("role", ["admin", "analyst", "viewer"])
def test_all_roles_can_run_samples_without_writes(client, db_session, role):
    user = User(name="Pessoa fictícia", email="sample@example.com", role=role,
                password_hash=hash_password("test-only-password"))
    db_session.add(user)
    db_session.commit()
    authenticate(client, user.email, "test-only-password")
    tables = [Analysis, AuditLog, IOC, Finding, Recommendation, DetectionRule]
    before = [db_session.query(t).count() for t in tables]
    for sample_id in ("phishing", "benign", "invoice", "notice"):
        assert client.post(f"/api/v1/analyses/samples/{sample_id}").status_code == 200
    assert [db_session.query(t).count() for t in tables] == before


def test_deactivation_revokes_token_after_reactivation(client, db_session, login, as_user):
    user = User(name="Pessoa fictícia", email="blocked@example.com", role="analyst",
                password_hash=hash_password("test-only-password"))
    db_session.add(user)
    db_session.commit()
    other = as_user(user.email, "test-only-password")
    login()
    assert client.patch(f"/api/v1/users/{user.id}/status", json={"status": "inactive"}).status_code == 200
    assert client.patch(f"/api/v1/users/{user.id}/status", json={"status": "active"}).status_code == 200
    assert other.get("/api/v1/auth/me").status_code == 401


@pytest.mark.parametrize("role", ["analyst", "viewer"])
def test_only_admin_can_read_global_audit(client, db_session, role):
    user = User(name="Pessoa fictícia", email="audit@example.com", role=role,
                password_hash=hash_password("test-only-password"))
    db_session.add(user)
    db_session.commit()
    authenticate(client, user.email, "test-only-password")
    assert client.get("/api/v1/audit").status_code == 403
