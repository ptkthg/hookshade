"""Autorização por dono em análises (IDOR/BOLA).

Regra: analyst/viewer só acessam as próprias análises; admin (SOC lead) tem
privilégio global explícito. Não-dono não-admin recebe 404 idêntico ao de
análise inexistente — sem vazar existência nem metadados.

Cada usuário tem seu próprio client: com a sessão em cookie, um client carrega uma
sessão só. Antes, dois dicts de header Bearer conviviam no mesmo client.
"""
from app.models import Analysis, User
from app.security import hash_password

_PW = "pw12345678"


def _mk_user(db, email, role="analyst"):
    u = User(name=email, email=email, role=role, password_hash=hash_password(_PW))
    db.add(u)
    db.commit()
    return u


def _submit(c, content="mensagem qualquer"):
    return c.post("/api/v1/analyses/text", json={"content": content}).json()["id"]


def test_owner_can_read_own(client, db_session, as_user):
    _mk_user(db_session, "alice@h.local")
    alice = as_user("alice@h.local", _PW)
    aid = _submit(alice)
    r = alice.get(f"/api/v1/analyses/{aid}")
    assert r.status_code == 200 and r.json()["id"] == aid


def test_non_owner_cannot_read(client, db_session, as_user):
    _mk_user(db_session, "alice@h.local")
    _mk_user(db_session, "bob@h.local")
    alice, bob = as_user("alice@h.local", _PW), as_user("bob@h.local", _PW)
    aid = _submit(alice)
    r = bob.get(f"/api/v1/analyses/{aid}")
    assert r.status_code == 404
    assert "severity" not in r.json() and "findings" not in r.json()


def test_non_owner_cannot_delete(client, db_session, as_user):
    _mk_user(db_session, "alice@h.local")
    _mk_user(db_session, "bob@h.local")
    alice, bob = as_user("alice@h.local", _PW), as_user("bob@h.local", _PW)
    aid = _submit(alice)
    assert bob.delete(f"/api/v1/analyses/{aid}").status_code == 404
    # continua existindo para o dono
    assert alice.get(f"/api/v1/analyses/{aid}").status_code == 200
    assert db_session.get(Analysis, aid) is not None


def test_admin_can_read_and_delete_any(client, db_session, as_user):
    _mk_user(db_session, "alice@h.local")
    alice = as_user("alice@h.local", _PW)
    aid = _submit(alice)
    admin = as_user()
    assert admin.get(f"/api/v1/analyses/{aid}").status_code == 200
    assert admin.delete(f"/api/v1/analyses/{aid}").status_code == 204


def test_forbidden_indistinguishable_from_missing(client, db_session, as_user):
    _mk_user(db_session, "alice@h.local")
    _mk_user(db_session, "bob@h.local")
    alice, bob = as_user("alice@h.local", _PW), as_user("bob@h.local", _PW)
    aid = _submit(alice)
    forbidden = bob.get(f"/api/v1/analyses/{aid}")
    missing = bob.get("/api/v1/analyses/999999")
    assert forbidden.status_code == missing.status_code == 404
    assert forbidden.json() == missing.json()  # sem oráculo de existência


def test_list_scoped_to_owner_for_non_admin(client, db_session, as_user):
    _mk_user(db_session, "alice@h.local")
    _mk_user(db_session, "bob@h.local")
    alice, bob = as_user("alice@h.local", _PW), as_user("bob@h.local", _PW)
    a1 = _submit(alice)
    b1 = _submit(bob)
    ids = [x["id"] for x in alice.get("/api/v1/analyses").json()]
    assert a1 in ids and b1 not in ids


def test_list_admin_sees_all(client, db_session, as_user):
    _mk_user(db_session, "alice@h.local")
    alice = as_user("alice@h.local", _PW)
    a1 = _submit(alice)
    admin = as_user()
    ids = [x["id"] for x in admin.get("/api/v1/analyses").json()]
    assert a1 in ids
