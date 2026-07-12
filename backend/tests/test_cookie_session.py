"""Sessão em cookie httpOnly (substitui o JWT em localStorage + header Bearer).

O JWT continua sendo o conteúdo da sessão, mas passa a trafegar exclusivamente
por cookie httpOnly: o JavaScript do navegador nunca o enxerga.
"""


from app.config import settings


def _csrf(client) -> str:
    token = client.get("/api/v1/auth/csrf").json()["csrf_token"]
    client.headers["X-CSRF-Token"] = token
    return token


def _login(client, email="analyst@hookshade.local", password="changeme123"):
    _csrf(client)
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def _session_cookie(response):
    for raw in response.headers.get_list("set-cookie"):
        if raw.startswith(f"{settings.session_cookie_name}="):
            return raw
    return None


def test_login_sets_session_cookie(client):
    r = _login(client)
    assert r.status_code == 200
    assert _session_cookie(r) is not None


def test_session_cookie_is_httponly(client):
    raw = _session_cookie(_login(client))
    assert "HttpOnly" in raw


def test_session_cookie_has_path_root(client):
    raw = _session_cookie(_login(client))
    assert "Path=/" in raw


def test_session_cookie_has_samesite(client):
    raw = _session_cookie(_login(client))
    # o valor do atributo é case-insensitive por RFC 6265bis; o Starlette emite minúsculo
    assert "samesite=lax" in raw.lower()


def test_session_cookie_has_no_domain_attribute(client):
    # sem Domain: o cookie não vaza para subdomínios
    raw = _session_cookie(_login(client))
    assert "Domain=" not in raw


def test_login_does_not_return_jwt_in_body(client):
    body = _login(client).json()
    assert "access_token" not in body
    assert "token" not in body
    # devolve só identidade segura
    assert body["email"] == "analyst@hookshade.local"
    assert body["role"] == "admin"


def test_me_works_with_cookie_only(client):
    _login(client)
    r = client.get("/api/v1/auth/me")
    assert r.status_code == 200
    assert r.json()["email"] == "analyst@hookshade.local"


def test_me_without_cookie_is_401(client):
    r = client.get("/api/v1/auth/me")
    assert r.status_code == 401


def test_bearer_header_is_not_accepted(client):
    """O Bearer foi removido: um JWT válido no header não autentica mais."""
    from app.security import create_access_token

    token = create_access_token("analyst@hookshade.local")
    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


def test_tampered_cookie_is_rejected(client):
    _login(client)
    client.cookies.set(settings.session_cookie_name, "not-a-jwt")
    r = client.get("/api/v1/auth/me")
    assert r.status_code == 401


def test_inactive_user_cannot_login(client, db_session):
    from app.models import User
    from app.security import hash_password

    db_session.add(User(name="Off", email="off@hookshade.local", role="analyst",
                        status="inactive", password_hash=hash_password("changeme123")))
    db_session.commit()
    r = _login(client, "off@hookshade.local")
    assert r.status_code == 401
    assert _session_cookie(r) is None


def test_deactivated_after_login_loses_access(client, db_session):
    """Cookie emitido antes da desativação deixa de valer (checagem é por request)."""
    from app.models import User

    _login(client)
    user = db_session.query(User).filter(User.email == "analyst@hookshade.local").first()
    user.status = "inactive"
    db_session.commit()
    assert client.get("/api/v1/auth/me").status_code == 401


def test_lockout_still_works_with_cookie_login(client, monkeypatch):
    # rate limit alto para isolar o lockout: senão o 429 dispara antes e o teste
    # provaria a defesa errada
    monkeypatch.setattr(settings, "rate_limit_login_per_minute", 1000)
    for _ in range(settings.login_max_attempts):
        assert _login(client, password="senha-errada").status_code == 401
    # senha certa agora também falha: conta bloqueada
    r = _login(client)
    assert r.status_code == 401
    assert _session_cookie(r) is None


def test_rate_limit_still_applies_to_login(client, monkeypatch):
    monkeypatch.setattr(settings, "rate_limit_login_per_minute", 3)
    codes = [_login(client, password="x").status_code for _ in range(5)]
    assert 429 in codes


def test_logout_clears_session_cookie(client):
    _login(client)
    assert client.get("/api/v1/auth/me").status_code == 200
    r = client.post("/api/v1/auth/logout")
    assert r.status_code == 204
    assert client.get("/api/v1/auth/me").status_code == 401


def test_logout_is_idempotent(client):
    _csrf(client)
    assert client.post("/api/v1/auth/logout").status_code == 204
    assert client.post("/api/v1/auth/logout").status_code == 204


def test_logout_expires_the_cookie(client):
    _login(client)
    r = client.post("/api/v1/auth/logout")
    raw = _session_cookie(r)
    assert raw is not None
    # o cookie de limpeza precisa dos mesmos atributos, senão o browser não o substitui
    assert "HttpOnly" in raw and "Path=/" in raw
    assert 'Max-Age=0' in raw or "Expires=Thu, 01 Jan 1970" in raw


def test_cookie_is_secure_and_host_prefixed_when_secure_enabled(client, monkeypatch):
    """Quem governa os atributos do cookie é cookie_secure (true em produção).

    Precisa falar https: um cookie Secure é descartado pelo cliente sobre http,
    exatamente como num browser real. O fixture `client` já preparou o override do
    banco e semeou o admin; aqui só trocamos a origem para https.
    (O gate que EXIGE cookie_secure em produção é coberto em test_cookie_config.py.)
    """
    from fastapi.testclient import TestClient

    from app.main import app

    monkeypatch.setattr(settings, "cookie_secure", True)

    with TestClient(app, base_url="https://testserver") as secure_client:
        raw = _session_cookie(_login(secure_client))

    assert raw is not None
    assert "Secure" in raw
    # __Host- exige Secure + Path=/ + sem Domain — as três coisas juntas
    assert raw.startswith("__Host-hookshade_session=")
    assert "Path=/" in raw
    assert "Domain=" not in raw
