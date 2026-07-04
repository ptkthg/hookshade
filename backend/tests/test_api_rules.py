import pytest

from app.models import User
from app.security import hash_password

_COND = {"field": "subject", "op": "contains", "value": "loteria"}


@pytest.fixture
def analyst_headers(client, db_session):
    db_session.add(User(name="An", email="an@h.local", role="analyst",
                        password_hash=hash_password("changeme123")))
    db_session.commit()
    r = client.post("/api/v1/auth/login", json={"email": "an@h.local", "password": "changeme123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _admin_headers(client):
    r = client.post("/api/v1/auth/login",
                    json={"email": "analyst@hookshade.local", "password": "changeme123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_admin_creates_and_lists_rule(client):
    h = _admin_headers(client)
    body = {"name": "Loteria", "category": "content", "severity": "médio",
            "condition": _COND, "justification": "baseline"}
    r = client.post("/api/v1/rules", json=body, headers=h)
    assert r.status_code == 201, r.text
    rid = r.json()["id"]
    assert r.json()["status"] == "inactive" and r.json()["version"] == 1
    lst = client.get("/api/v1/rules", headers=h)
    assert any(x["id"] == rid for x in lst.json())


def test_analyst_can_read_but_not_create(client, analyst_headers):
    assert client.get("/api/v1/rules", headers=analyst_headers).status_code == 200
    r = client.post("/api/v1/rules", headers=analyst_headers,
                    json={"name": "x", "category": "content", "severity": "médio",
                          "condition": _COND, "justification": "j"})
    assert r.status_code == 403


def test_invalid_condition_is_rejected_422(client):
    h = _admin_headers(client)
    r = client.post("/api/v1/rules", headers=h,
                    json={"name": "x", "category": "content", "severity": "médio",
                          "condition": {"field": "__class__", "op": "contains", "value": "y"},
                          "justification": "j"})
    assert r.status_code == 422


def test_edit_bumps_version(client):
    h = _admin_headers(client)
    rid = client.post("/api/v1/rules", headers=h,
                      json={"name": "L", "category": "content", "severity": "médio",
                            "condition": _COND, "justification": "c"}).json()["id"]
    upd = client.put(f"/api/v1/rules/{rid}", headers=h,
                     json={"severity": "alto", "justification": "subiu"})
    assert upd.status_code == 200 and upd.json()["version"] == 2 and upd.json()["severity"] == "alto"


def test_activate_deactivate_and_history(client):
    h = _admin_headers(client)
    rid = client.post("/api/v1/rules", headers=h,
                      json={"name": "L", "category": "content", "severity": "alto",
                            "condition": _COND, "justification": "c"}).json()["id"]
    assert client.post(f"/api/v1/rules/{rid}/activate", headers=h,
                       json={"justification": "on"}).json()["status"] == "active"
    assert client.post(f"/api/v1/rules/{rid}/deactivate", headers=h,
                       json={"justification": "off"}).json()["status"] == "inactive"
    hist = client.get(f"/api/v1/rules/{rid}/history", headers=h).json()
    assert [x["action"] for x in hist] == ["create", "activate", "deactivate"]


def test_soft_delete_then_404(client):
    h = _admin_headers(client)
    rid = client.post("/api/v1/rules", headers=h,
                      json={"name": "L", "category": "content", "severity": "alto",
                            "condition": _COND, "justification": "c"}).json()["id"]
    assert client.delete(f"/api/v1/rules/{rid}", headers=h).status_code == 200
    assert client.get(f"/api/v1/rules/{rid}", headers=h).status_code == 404


def test_unauthenticated_blocked(client):
    assert client.get("/api/v1/rules").status_code == 401
