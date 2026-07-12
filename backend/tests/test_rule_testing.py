"""Passo 4: testar uma regra (rascunho) contra uma análise existente, sem persistir."""
from app.models import Analysis, DetectionRule, User
from app.security import hash_password


def _make_analysis(client, content):
    return client.post("/api/v1/analyses/text", json={"content": content}).json()["id"]


def test_rule_test_fires_and_predicts_impact_without_persisting(client, db_session, login):
    login()
    aid = _make_analysis(client, "você ganhou na loteria, clique já")
    before = db_session.get(Analysis, aid).risk_score

    body = {"analysis_id": aid, "category": "content", "severity": "alto",
            "condition": {"field": "body", "op": "contains", "value": "loteria"}}
    r = client.post("/api/v1/rules/test", json=body)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["fired"] is True
    assert "loteria" in data["evidence"]
    assert data["predicted_score"] >= data["current_score"]

    # não persiste: score da análise intacto e nenhuma regra criada
    db_session.expire_all()
    assert db_session.get(Analysis, aid).risk_score == before
    assert db_session.query(DetectionRule).count() == 0


def test_rule_test_reports_no_fire(client, db_session, login):
    login()
    aid = _make_analysis(client, "mensagem inofensiva")
    body = {"analysis_id": aid, "category": "content", "severity": "alto",
            "condition": {"field": "body", "op": "contains", "value": "loteria"}}
    r = client.post("/api/v1/rules/test", json=body)
    assert r.status_code == 200 and r.json()["fired"] is False
    assert r.json()["predicted_score"] == r.json()["current_score"]


def test_rule_test_invalid_condition_422(client, login):
    login()
    aid = _make_analysis(client, "x")
    r = client.post("/api/v1/rules/test",
                    json={"analysis_id": aid, "category": "content", "severity": "alto",
                          "condition": {"field": "__class__", "op": "contains", "value": "y"}})
    assert r.status_code == 422


def test_rule_test_unknown_analysis_404(client, login):
    login()
    r = client.post("/api/v1/rules/test",
                    json={"analysis_id": 99999, "category": "content", "severity": "alto",
                          "condition": {"field": "body", "op": "contains", "value": "x"}})
    assert r.status_code == 404


def test_rule_test_requires_admin(client, db_session, as_user):
    db_session.add(User(name="An", email="an@h.local", role="analyst",
                        password_hash=hash_password("changeme123")))
    db_session.commit()
    analyst = as_user("an@h.local", "changeme123")
    r = analyst.post("/api/v1/rules/test",
                    json={"analysis_id": 1, "category": "content", "severity": "alto",
                          "condition": {"field": "body", "op": "contains", "value": "x"}})
    assert r.status_code == 403
