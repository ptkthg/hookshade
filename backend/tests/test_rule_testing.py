"""Passo 4: testar uma regra (rascunho) contra uma análise existente, sem persistir."""
from app.models import Analysis, DetectionRule, User
from app.security import hash_password


def _admin(client):
    r = client.post("/api/v1/auth/login",
                    json={"email": "analyst@hookshade.local", "password": "changeme123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _make_analysis(client, headers, content):
    return client.post("/api/v1/analyses/text", json={"content": content}, headers=headers).json()["id"]


def test_rule_test_fires_and_predicts_impact_without_persisting(client, db_session):
    h = _admin(client)
    aid = _make_analysis(client, h, "você ganhou na loteria, clique já")
    before = db_session.get(Analysis, aid).risk_score

    body = {"analysis_id": aid, "category": "content", "severity": "alto",
            "condition": {"field": "body", "op": "contains", "value": "loteria"}}
    r = client.post("/api/v1/rules/test", json=body, headers=h)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["fired"] is True
    assert "loteria" in data["evidence"]
    assert data["predicted_score"] >= data["current_score"]

    # não persiste: score da análise intacto e nenhuma regra criada
    db_session.expire_all()
    assert db_session.get(Analysis, aid).risk_score == before
    assert db_session.query(DetectionRule).count() == 0


def test_rule_test_reports_no_fire(client, db_session):
    h = _admin(client)
    aid = _make_analysis(client, h, "mensagem inofensiva")
    body = {"analysis_id": aid, "category": "content", "severity": "alto",
            "condition": {"field": "body", "op": "contains", "value": "loteria"}}
    r = client.post("/api/v1/rules/test", json=body, headers=h)
    assert r.status_code == 200 and r.json()["fired"] is False
    assert r.json()["predicted_score"] == r.json()["current_score"]


def test_rule_test_invalid_condition_422(client):
    h = _admin(client)
    aid = _make_analysis(client, h, "x")
    r = client.post("/api/v1/rules/test", headers=h,
                    json={"analysis_id": aid, "category": "content", "severity": "alto",
                          "condition": {"field": "__class__", "op": "contains", "value": "y"}})
    assert r.status_code == 422


def test_rule_test_unknown_analysis_404(client):
    h = _admin(client)
    r = client.post("/api/v1/rules/test", headers=h,
                    json={"analysis_id": 99999, "category": "content", "severity": "alto",
                          "condition": {"field": "body", "op": "contains", "value": "x"}})
    assert r.status_code == 404


def test_rule_test_requires_admin(client, db_session):
    db_session.add(User(name="An", email="an@h.local", role="analyst",
                        password_hash=hash_password("changeme123")))
    db_session.commit()
    tok = client.post("/api/v1/auth/login",
                      json={"email": "an@h.local", "password": "changeme123"}).json()["access_token"]
    r = client.post("/api/v1/rules/test", headers={"Authorization": f"Bearer {tok}"},
                    json={"analysis_id": 1, "category": "content", "severity": "alto",
                          "condition": {"field": "body", "op": "contains", "value": "x"}})
    assert r.status_code == 403
