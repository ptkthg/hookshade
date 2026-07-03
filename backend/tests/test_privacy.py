"""P0-11 (cifra + retenção) e P0-10 (auditoria) — privacidade mínima do MVP."""
from datetime import datetime, timedelta, timezone

from app.crypto import decrypt, encrypt
from app.models import Analysis, AuditLog
from app.retention import purge_expired


def _token(client):
    r = client.post("/api/v1/auth/login",
                    json={"email": "analyst@hookshade.local", "password": "changeme123"})
    return r.json()["access_token"]


# ---- Cifra ----

def test_encrypt_roundtrip_and_not_plaintext():
    secret = "conteúdo sensível do e-mail: senha=hunter2"
    token = encrypt(secret)
    assert token != secret
    assert "hunter2" not in token
    assert decrypt(token) == secret


def test_raw_content_stored_encrypted(client, db_session):
    headers = {"Authorization": f"Bearer {_token(client)}"}
    needle = "NEEDLE-SENSIVEL-42 corpo do phishing"
    r = client.post("/api/v1/analyses/text", json={"content": needle}, headers=headers)
    assert r.status_code == 200
    row = db_session.query(Analysis).order_by(Analysis.id.desc()).first()
    assert needle not in row.raw_content            # não fica em texto puro
    assert decrypt(row.raw_content) == needle       # mas é recuperável


# ---- Auditoria ----

def test_create_writes_audit_log(client, db_session):
    headers = {"Authorization": f"Bearer {_token(client)}"}
    r = client.post("/api/v1/analyses/text", json={"content": "oi"}, headers=headers)
    aid = r.json()["id"]
    logs = db_session.query(AuditLog).filter(AuditLog.action == "analysis.create").all()
    assert any(l.analysis_id == aid and l.actor_id is not None for l in logs)


# ---- Exclusão sob demanda ----

def test_delete_analysis_and_audit(client, db_session):
    headers = {"Authorization": f"Bearer {_token(client)}"}
    aid = client.post("/api/v1/analyses/text", json={"content": "oi"}, headers=headers).json()["id"]
    d = client.delete(f"/api/v1/analyses/{aid}", headers=headers)
    assert d.status_code == 204
    assert client.get(f"/api/v1/analyses/{aid}", headers=headers).status_code == 404
    assert db_session.query(AuditLog).filter(AuditLog.action == "analysis.delete",
                                             AuditLog.analysis_id == aid).count() == 1


def test_delete_requires_auth(client):
    assert client.delete("/api/v1/analyses/1").status_code == 401


# ---- Retenção ----

def test_purge_expired_removes_old_analyses(client, db_session):
    headers = {"Authorization": f"Bearer {_token(client)}"}
    aid = client.post("/api/v1/analyses/text", json={"content": "antigo"}, headers=headers).json()["id"]
    row = db_session.get(Analysis, aid)
    row.created_at = datetime.now(timezone.utc) - timedelta(days=120)
    db_session.commit()

    removed = purge_expired(db_session, older_than_days=90)
    assert removed == 1
    assert db_session.get(Analysis, aid) is None
    assert db_session.query(AuditLog).filter(AuditLog.action == "analysis.purge").count() >= 1
