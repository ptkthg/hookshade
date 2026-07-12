"""Gestão básica de usuários por admin (Fase 1 / Bloco 2).

Somente admin gerencia usuários; toda mutação audita (user.*); nenhuma
resposta expõe password_hash; o sistema nunca fica sem admin ativo.
"""
import pytest

from tests.conftest import authenticate

from app.models import AuditLog, User
from app.security import hash_password

ADMIN_EMAIL = "analyst@hookshade.local"
ADMIN_PASSWORD = "changeme123"
BASE = "/api/v1/users"


# Cada papel tem seu próprio client: a sessão agora é cookie, e um client carrega
# uma sessão só (antes, vários dicts de header Bearer conviviam no mesmo client).
@pytest.fixture
def admin_client(as_user):
    return as_user(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture
def analyst_client(as_user, db_session):
    db_session.add(User(name="Ana", email="ana@hookshade.local", role="analyst",
                        password_hash=hash_password("senha-da-ana-123")))
    db_session.commit()
    return as_user("ana@hookshade.local", "senha-da-ana-123")


@pytest.fixture
def viewer_client(as_user, db_session):
    db_session.add(User(name="Vito", email="vito@hookshade.local", role="viewer",
                        password_hash=hash_password("senha-do-vito-123")))
    db_session.commit()
    return as_user("vito@hookshade.local", "senha-do-vito-123")


def _audit_actions(db_session) -> list[str]:
    return [a.action for a in db_session.query(AuditLog).all()]


# ---------- criação ----------

def test_admin_creates_user(client, admin_client, db_session):
    r = admin_client.post(BASE, json={
        "name": "Novo Analista", "email": "novo@hookshade.local",
        "password": "senha-inicial-forte", "role": "analyst",
    })
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["email"] == "novo@hookshade.local"
    assert body["role"] == "analyst"
    assert body["status"] == "active"
    assert "password" not in body and "password_hash" not in body
    assert "user.created" in _audit_actions(db_session)


def test_created_user_can_login(client, admin_client):
    admin_client.post(BASE, json={
        "name": "Novo", "email": "novo@hookshade.local",
        "password": "senha-inicial-forte", "role": "analyst",
    })
    assert authenticate(client, "novo@hookshade.local", "senha-inicial-forte").status_code == 200


def test_create_rejects_duplicate_email(client, admin_client):
    payload = {"name": "X", "email": "dup@hookshade.local",
               "password": "senha-inicial-forte", "role": "analyst"}
    assert admin_client.post(BASE, json=payload).status_code == 201
    assert admin_client.post(BASE, json=payload).status_code == 409


def test_create_rejects_invalid_role(client, admin_client):
    r = admin_client.post(BASE, json={
        "name": "X", "email": "x@hookshade.local",
        "password": "senha-inicial-forte", "role": "superuser",
    })
    assert r.status_code == 422


def test_create_rejects_short_password(client, admin_client):
    r = admin_client.post(BASE, json={
        "name": "X", "email": "x@hookshade.local", "password": "curta", "role": "analyst",
    })
    assert r.status_code == 422


# ---------- listagem e detalhe ----------

def test_admin_lists_users_without_hash(client, admin_client):
    r = admin_client.get(BASE)
    assert r.status_code == 200
    users = r.json()
    assert any(u["email"] == ADMIN_EMAIL for u in users)
    for u in users:
        assert "password_hash" not in u
        assert {"id", "name", "email", "role", "status"} <= set(u)


def test_admin_gets_user_detail(client, admin_client, db_session):
    uid = db_session.query(User).filter(User.email == ADMIN_EMAIL).one().id
    r = admin_client.get(f"{BASE}/{uid}")
    assert r.status_code == 200
    assert r.json()["email"] == ADMIN_EMAIL
    assert "password_hash" not in r.json()


# ---------- role ----------

def test_admin_changes_role(client, admin_client, db_session, analyst_client):
    uid = db_session.query(User).filter(User.email == "ana@hookshade.local").one().id
    r = admin_client.patch(f"{BASE}/{uid}/role", json={"role": "admin"})
    assert r.status_code == 200
    assert r.json()["role"] == "admin"
    assert "user.role_changed" in _audit_actions(db_session)


def test_cannot_demote_last_active_admin(client, admin_client, db_session):
    uid = db_session.query(User).filter(User.email == ADMIN_EMAIL).one().id
    r = admin_client.patch(f"{BASE}/{uid}/role", json={"role": "analyst"})
    assert r.status_code == 409


# ---------- ativação / desativação ----------

def test_admin_deactivates_and_reactivates_user(client, admin_client, db_session, analyst_client):
    uid = db_session.query(User).filter(User.email == "ana@hookshade.local").one().id
    r = admin_client.patch(f"{BASE}/{uid}/status", json={"status": "inactive"})
    assert r.status_code == 200 and r.json()["status"] == "inactive"
    assert "user.deactivated" in _audit_actions(db_session)
    r = admin_client.patch(f"{BASE}/{uid}/status", json={"status": "active"})
    assert r.status_code == 200 and r.json()["status"] == "active"
    assert "user.activated" in _audit_actions(db_session)


def test_deactivated_user_cannot_login(client, admin_client, db_session, analyst_client):
    uid = db_session.query(User).filter(User.email == "ana@hookshade.local").one().id
    admin_client.patch(f"{BASE}/{uid}/status", json={"status": "inactive"})
    r = client.post("/api/v1/auth/login",
                    json={"email": "ana@hookshade.local", "password": "senha-da-ana-123"})
    assert r.status_code == 401
    assert r.json() == {"detail": "Invalid credentials"}


def test_deactivated_user_old_token_rejected(client, admin_client, db_session, analyst_client):
    uid = db_session.query(User).filter(User.email == "ana@hookshade.local").one().id
    admin_client.patch(f"{BASE}/{uid}/status", json={"status": "inactive"})
    r = client.get("/api/v1/auth/me")
    assert r.status_code == 401


def test_cannot_deactivate_last_active_admin(client, admin_client, db_session):
    uid = db_session.query(User).filter(User.email == ADMIN_EMAIL).one().id
    r = admin_client.patch(f"{BASE}/{uid}/status", json={"status": "inactive"})
    assert r.status_code == 409


def test_can_deactivate_admin_when_another_active_admin_exists(client, admin_client, db_session):
    db_session.add(User(name="Admin2", email="admin2@hookshade.local", role="admin",
                        password_hash=hash_password("senha-do-admin2-x")))
    db_session.commit()
    uid = db_session.query(User).filter(User.email == ADMIN_EMAIL).one().id
    r = admin_client.patch(f"{BASE}/{uid}/status", json={"status": "inactive"})
    assert r.status_code == 200


# ---------- reset de senha ----------

def test_admin_resets_password_and_clears_lockout(client, admin_client, db_session, analyst_client):
    user = db_session.query(User).filter(User.email == "ana@hookshade.local").one()
    user.failed_login_attempts = 5
    db_session.commit()
    r = admin_client.patch(f"{BASE}/{user.id}/password",
                     json={"password": "nova-senha-temporaria"})
    assert r.status_code == 200
    assert "user.password_reset" in _audit_actions(db_session)
    db_session.expire_all()
    assert user.failed_login_attempts == 0 and user.locked_until is None
    assert authenticate(client, "ana@hookshade.local", "nova-senha-temporaria").status_code == 200


def test_password_reset_not_in_audit_detail(client, admin_client, db_session, analyst_client):
    uid = db_session.query(User).filter(User.email == "ana@hookshade.local").one().id
    admin_client.patch(f"{BASE}/{uid}/password",
                 json={"password": "nova-senha-temporaria"})
    entries = db_session.query(AuditLog).filter(AuditLog.action == "user.password_reset").all()
    assert entries and all("nova-senha-temporaria" not in e.detail for e in entries)


# ---------- RBAC ----------

def test_analyst_cannot_manage_users(client, analyst_client):
    assert analyst_client.get(BASE).status_code == 403
    r = analyst_client.post(BASE, json={
        "name": "X", "email": "x@hookshade.local",
        "password": "senha-inicial-forte", "role": "analyst",
    })
    assert r.status_code == 403  # 403 (autenticado, sem papel), não 401


def test_viewer_cannot_list_users(client, viewer_client):
    assert viewer_client.get(BASE).status_code == 403


def test_unauthenticated_gets_401(client):
    assert client.get(BASE).status_code == 401


def test_user_not_found_returns_404(client, admin_client):
    assert admin_client.get(f"{BASE}/9999").status_code == 404
