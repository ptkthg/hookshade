"""Proteção CSRF (double-submit com token assinado).

Cookie httpOnly resolve roubo de sessão por XSS, mas ABRE o flanco de CSRF: o
navegador passa a anexar a sessão automaticamente em qualquer requisição, inclusive
as disparadas por um site terceiro. SameSite=Lax mitiga, não basta (não cobre
navegadores antigos nem certos fluxos same-site). Daí o double-submit.
"""
from app.config import settings

MUTATING = ["POST", "PUT", "PATCH", "DELETE"]


def _csrf(client) -> str:
    token = client.get("/api/v1/auth/csrf").json()["csrf_token"]
    client.headers["X-CSRF-Token"] = token
    return token


def _login(client):
    _csrf(client)
    return client.post("/api/v1/auth/login",
                       json={"email": "analyst@hookshade.local", "password": "changeme123"})


def test_csrf_endpoint_sets_cookie_and_returns_token(client):
    r = client.get("/api/v1/auth/csrf")
    assert r.status_code == 200
    token = r.json()["csrf_token"]
    assert len(token) >= 32  # entropia adequada
    assert client.cookies.get(settings.csrf_cookie_name) == token


def test_csrf_cookie_is_readable_by_js(client):
    """O cookie CSRF NÃO é httpOnly de propósito: o front precisa lê-lo. Ele não é
    um segredo de sessão — só serve para provar mesma-origem."""
    r = client.get("/api/v1/auth/csrf")
    raw = [c for c in r.headers.get_list("set-cookie")
           if c.startswith(f"{settings.csrf_cookie_name}=")][0]
    assert "HttpOnly" not in raw
    assert "samesite=lax" in raw.lower()


def test_get_does_not_require_csrf(client):
    _login(client)
    del client.headers["X-CSRF-Token"]
    assert client.get("/api/v1/auth/me").status_code == 200
    assert client.get("/api/v1/analyses").status_code == 200


def test_post_without_csrf_is_403(client):
    _login(client)
    del client.headers["X-CSRF-Token"]
    r = client.post("/api/v1/analyses/text", json={"content": "From: a@b.c\n\noi"})
    assert r.status_code == 403


def test_post_with_invalid_csrf_is_403(client):
    _login(client)
    client.headers["X-CSRF-Token"] = "token-forjado"
    r = client.post("/api/v1/analyses/text", json={"content": "From: a@b.c\n\noi"})
    assert r.status_code == 403


def test_post_with_header_not_matching_cookie_is_403(client):
    """Coração do double-submit: header e cookie precisam bater. Um atacante
    cross-site consegue forçar o cookie a ser enviado, mas não consegue LER seu
    valor para escrevê-lo no header."""
    _login(client)
    other = client.get("/api/v1/auth/csrf").json()["csrf_token"]  # token válido...
    client.cookies.set(settings.csrf_cookie_name, "valor-diferente")  # ...mas cookie outro
    client.headers["X-CSRF-Token"] = other
    r = client.post("/api/v1/analyses/text", json={"content": "From: a@b.c\n\noi"})
    assert r.status_code == 403


def test_post_with_valid_csrf_succeeds(client):
    _login(client)
    r = client.post("/api/v1/analyses/text", json={"content": "From: a@b.c\nSubject: oi\n\ncorpo"})
    assert r.status_code == 200


def test_delete_without_csrf_is_403(client):
    _login(client)
    r = client.post("/api/v1/analyses/text", json={"content": "From: a@b.c\n\noi"})
    aid = r.json()["id"]
    del client.headers["X-CSRF-Token"]
    assert client.delete(f"/api/v1/analyses/{aid}").status_code == 403


def test_login_requires_csrf(client):
    """Login é mutável e precisa de CSRF: sem isso, um site terceiro poderia
    logar a vítima numa conta do atacante (login CSRF)."""
    del client.headers["X-CSRF-Token"]
    r = client.post("/api/v1/auth/login",
                    json={"email": "analyst@hookshade.local", "password": "changeme123"})
    assert r.status_code == 403


def test_logout_requires_csrf(client):
    _login(client)
    del client.headers["X-CSRF-Token"]
    assert client.post("/api/v1/auth/logout").status_code == 403


def test_csrf_failure_does_not_leak_internals(client):
    _login(client)
    client.headers["X-CSRF-Token"] = "forjado"
    r = client.post("/api/v1/analyses/text", json={"content": "x"})
    body = r.json()
    detail = str(body.get("detail", "")).lower()
    assert "cookie" not in detail and "hmac" not in detail and "secret" not in detail
    assert settings.secret_key not in str(body)


def test_forged_signature_is_rejected(client):
    """Token com formato certo mas assinatura inválida não passa."""
    from app.csrf import issue_csrf_token, verify_csrf_token

    good = issue_csrf_token()
    assert verify_csrf_token(good, good) is True
    forged = good.split(".")[0] + ".assinatura-invalida"
    assert verify_csrf_token(forged, forged) is False


def test_csrf_token_never_appears_in_logs(client, caplog):
    import logging

    caplog.set_level(logging.INFO)
    token = _csrf(client)
    _login(client)
    client.post("/api/v1/analyses/text", json={"content": "From: a@b.c\n\noi"})
    assert token not in caplog.text
