import pytest

from app.models import User
from app.security import hash_password

_COND = {"field": "subject", "op": "contains", "value": "loteria"}


@pytest.fixture
def analyst_client(as_user, db_session):
    db_session.add(User(name="An", email="an@h.local", role="analyst",
                        password_hash=hash_password("changeme123")))
    db_session.commit()
    return as_user("an@h.local", "changeme123")


def test_admin_creates_and_lists_rule(client, login):
    login()
    body = {"name": "Loteria", "category": "content", "severity": "médio",
            "condition": _COND, "justification": "baseline"}
    r = client.post("/api/v1/rules", json=body)
    assert r.status_code == 201, r.text
    rid = r.json()["id"]
    assert r.json()["status"] == "inactive" and r.json()["version"] == 1
    lst = client.get("/api/v1/rules")
    assert any(x["id"] == rid for x in lst.json())


def test_analyst_can_read_but_not_create(client, analyst_client):
    assert analyst_client.get("/api/v1/rules").status_code == 200
    r = analyst_client.post("/api/v1/rules",
                    json={"name": "x", "category": "content", "severity": "médio",
                          "condition": _COND, "justification": "j"})
    assert r.status_code == 403


def test_invalid_condition_is_rejected_422(client, login):
    login()
    r = client.post("/api/v1/rules",
                    json={"name": "x", "category": "content", "severity": "médio",
                          "condition": {"field": "__class__", "op": "contains", "value": "y"},
                          "justification": "j"})
    assert r.status_code == 422


def test_edit_bumps_version(client, login):
    login()
    rid = client.post("/api/v1/rules",
                      json={"name": "L", "category": "content", "severity": "médio",
                            "condition": _COND, "justification": "c"}).json()["id"]
    upd = client.put(f"/api/v1/rules/{rid}",
                     json={"severity": "alto", "justification": "subiu"})
    assert upd.status_code == 200 and upd.json()["version"] == 2 and upd.json()["severity"] == "alto"


def test_activate_deactivate_and_history(client, login):
    login()
    rid = client.post("/api/v1/rules",
                      json={"name": "L", "category": "content", "severity": "alto",
                            "condition": _COND, "justification": "c"}).json()["id"]
    assert client.post(f"/api/v1/rules/{rid}/activate",
                       json={"justification": "on"}).json()["status"] == "active"
    assert client.post(f"/api/v1/rules/{rid}/deactivate",
                       json={"justification": "off"}).json()["status"] == "inactive"
    hist = client.get(f"/api/v1/rules/{rid}/history").json()
    assert [x["action"] for x in hist] == ["create", "activate", "deactivate"]


def test_soft_delete_then_404(client, login):
    login()
    rid = client.post("/api/v1/rules",
                      json={"name": "L", "category": "content", "severity": "alto",
                            "condition": _COND, "justification": "c"}).json()["id"]
    assert client.delete(f"/api/v1/rules/{rid}").status_code == 200
    assert client.get(f"/api/v1/rules/{rid}").status_code == 404


def test_unauthenticated_blocked(client):
    assert client.get("/api/v1/rules").status_code == 401
