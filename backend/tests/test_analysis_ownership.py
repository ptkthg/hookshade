"""Autorização por dono em análises (IDOR/BOLA).

Regra: analyst/viewer só acessam as próprias análises; admin (SOC lead) tem
privilégio global explícito. Não-dono não-admin recebe 404 idêntico ao de
análise inexistente — sem vazar existência nem metadados.
"""
from app.models import Analysis, User
from app.security import hash_password

_PW = "pw12345678"


def _mk_user(db, email, role="analyst"):
    u = User(name=email, email=email, role=role, password_hash=hash_password(_PW))
    db.add(u)
    db.commit()
    return u


def _login(client, email, pw=_PW):
    r = client.post("/api/v1/auth/login", json={"email": email, "password": pw})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _submit(client, headers, content="mensagem qualquer"):
    return client.post("/api/v1/analyses/text", json={"content": content}, headers=headers).json()["id"]


def test_owner_can_read_own(client, db_session):
    _mk_user(db_session, "alice@h.local")
    h = _login(client, "alice@h.local")
    aid = _submit(client, h)
    r = client.get(f"/api/v1/analyses/{aid}", headers=h)
    assert r.status_code == 200 and r.json()["id"] == aid


def test_non_owner_cannot_read(client, db_session):
    _mk_user(db_session, "alice@h.local")
    _mk_user(db_session, "bob@h.local")
    ha, hb = _login(client, "alice@h.local"), _login(client, "bob@h.local")
    aid = _submit(client, ha)
    r = client.get(f"/api/v1/analyses/{aid}", headers=hb)
    assert r.status_code == 404
    assert "severity" not in r.json() and "findings" not in r.json()


def test_non_owner_cannot_delete(client, db_session):
    _mk_user(db_session, "alice@h.local")
    _mk_user(db_session, "bob@h.local")
    ha, hb = _login(client, "alice@h.local"), _login(client, "bob@h.local")
    aid = _submit(client, ha)
    assert client.delete(f"/api/v1/analyses/{aid}", headers=hb).status_code == 404
    # continua existindo para o dono
    assert client.get(f"/api/v1/analyses/{aid}", headers=ha).status_code == 200
    assert db_session.get(Analysis, aid) is not None


def test_admin_can_read_and_delete_any(client, db_session):
    _mk_user(db_session, "alice@h.local")
    ha = _login(client, "alice@h.local")
    aid = _submit(client, ha)
    hadmin = _login(client, "analyst@hookshade.local", "changeme123")
    assert client.get(f"/api/v1/analyses/{aid}", headers=hadmin).status_code == 200
    assert client.delete(f"/api/v1/analyses/{aid}", headers=hadmin).status_code == 204


def test_forbidden_indistinguishable_from_missing(client, db_session):
    _mk_user(db_session, "alice@h.local")
    _mk_user(db_session, "bob@h.local")
    ha, hb = _login(client, "alice@h.local"), _login(client, "bob@h.local")
    aid = _submit(client, ha)
    forbidden = client.get(f"/api/v1/analyses/{aid}", headers=hb)
    missing = client.get("/api/v1/analyses/999999", headers=hb)
    assert forbidden.status_code == missing.status_code == 404
    assert forbidden.json() == missing.json()  # sem oráculo de existência


def test_list_scoped_to_owner_for_non_admin(client, db_session):
    _mk_user(db_session, "alice@h.local")
    _mk_user(db_session, "bob@h.local")
    ha, hb = _login(client, "alice@h.local"), _login(client, "bob@h.local")
    a1 = _submit(client, ha)
    b1 = _submit(client, hb)
    ids = [x["id"] for x in client.get("/api/v1/analyses", headers=ha).json()]
    assert a1 in ids and b1 not in ids


def test_list_admin_sees_all(client, db_session):
    _mk_user(db_session, "alice@h.local")
    ha = _login(client, "alice@h.local")
    a1 = _submit(client, ha)
    hadmin = _login(client, "analyst@hookshade.local", "changeme123")
    ids = [x["id"] for x in client.get("/api/v1/analyses", headers=hadmin).json()]
    assert a1 in ids
