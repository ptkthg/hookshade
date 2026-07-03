"""P0-10 (auditoria read-only) — GET /api/v1/audit."""
from datetime import datetime, timedelta, timezone

from app.models import Analysis
from app.retention import purge_expired


def _token(client):
    r = client.post("/api/v1/auth/login",
                    json={"email": "analyst@hookshade.local", "password": "changeme123"})
    return r.json()["access_token"]


def _headers(client):
    return {"Authorization": f"Bearer {_token(client)}"}


def test_audit_requires_auth(client):
    assert client.get("/api/v1/audit").status_code == 401


def test_audit_is_read_only(client):
    # sem rotas de escrita → método não permitido
    assert client.post("/api/v1/audit").status_code == 405
    assert client.put("/api/v1/audit").status_code == 405
    assert client.delete("/api/v1/audit").status_code == 405


def test_create_event_appears_with_context(client):
    h = _headers(client)
    aid = client.post("/api/v1/analyses/text", json={"content": "oi"}, headers=h).json()["id"]
    page = client.get("/api/v1/audit", headers=h).json()
    ev = next(e for e in page["items"] if e["action"] == "analysis.create" and e["analysis_id"] == aid)
    assert ev["actor"] == "analyst@hookshade.local"
    assert ev["created_at"]
    assert page["total"] >= 1


def test_delete_and_purge_events_appear(client, db_session):
    h = _headers(client)
    a1 = client.post("/api/v1/analyses/text", json={"content": "x"}, headers=h).json()["id"]
    client.delete(f"/api/v1/analyses/{a1}", headers=h)

    a2 = client.post("/api/v1/analyses/text", json={"content": "y"}, headers=h).json()["id"]
    db_session.get(Analysis, a2).created_at = datetime.now(timezone.utc) - timedelta(days=200)
    db_session.commit()
    purge_expired(db_session, older_than_days=90)

    actions = {e["action"] for e in client.get("/api/v1/audit", headers=h).json()["items"]}
    assert {"analysis.create", "analysis.delete", "analysis.purge"} <= actions


def test_audit_ordered_newest_first_and_paginated(client):
    h = _headers(client)
    client.post("/api/v1/analyses/text", json={"content": "primeiro"}, headers=h)
    client.post("/api/v1/analyses/text", json={"content": "segundo"}, headers=h)
    page = client.get("/api/v1/audit?limit=1", headers=h).json()
    assert len(page["items"]) == 1
    assert page["limit"] == 1
    assert page["total"] >= 2
    # ordenação desc: o id do log mais recente é o maior
    first_id = page["items"][0]["id"]
    all_ids = [e["id"] for e in client.get("/api/v1/audit?limit=200", headers=h).json()["items"]]
    assert first_id == max(all_ids)


def test_audit_filter_by_action(client):
    h = _headers(client)
    client.post("/api/v1/analyses/text", json={"content": "z"}, headers=h)
    page = client.get("/api/v1/audit?action=analysis.create", headers=h).json()
    assert page["items"]
    assert all(e["action"] == "analysis.create" for e in page["items"])
