"""Headers de segurança da API.

A API só devolve JSON — nunca HTML. Por isso a política mais restritiva possível é a
correta aqui: ela não carrega script, estilo, fonte nem imagem nenhuma.

Os headers precisam sair em TODA resposta, inclusive nas de erro. Um 401 ou um 403 sem
`nosniff` ou sem `frame-ancestors` é uma resposta desprotegida como qualquer outra.
"""
from app.config import settings


def test_nosniff_present(client):
    r = client.get("/health")
    assert r.headers["x-content-type-options"] == "nosniff"


def test_frame_options_deny(client):
    r = client.get("/health")
    assert r.headers["x-frame-options"] == "DENY"


def test_referrer_policy(client):
    r = client.get("/health")
    assert r.headers["referrer-policy"] == "no-referrer"


def test_permissions_policy_disables_sensors(client):
    r = client.get("/health")
    pp = r.headers["permissions-policy"]
    for feature in ("camera=()", "microphone=()", "geolocation=()"):
        assert feature in pp


def test_csp_locks_everything_down(client):
    """A API não serve HTML: default-src 'none' é literalmente verdade."""
    csp = client.get("/health").headers["content-security-policy"]
    assert "default-src 'none'" in csp
    assert "frame-ancestors 'none'" in csp


def test_hsts_absent_in_development(client):
    """HSTS em dev travaria o localhost no navegador (força https em http://localhost)
    e o browser guarda isso por meses. Fora de produção, não emitimos."""
    assert "strict-transport-security" not in client.get("/health").headers


def test_hsts_present_in_production(client, monkeypatch):
    monkeypatch.setattr(settings, "hsts_enabled", True)
    hsts = client.get("/health").headers["strict-transport-security"]
    assert "max-age=" in hsts
    max_age = int(hsts.split("max-age=")[1].split(";")[0])
    assert max_age >= 31536000  # >= 1 ano
    assert "includeSubDomains" in hsts


def test_headers_present_on_error_responses(client):
    """401 e 404 também são respostas. Não podem sair sem proteção."""
    unauthorized = client.get("/api/v1/analyses")          # sem sessão
    not_found = client.get("/rota-que-nao-existe")
    assert unauthorized.status_code == 401
    assert not_found.status_code == 404
    for r in (unauthorized, not_found):
        assert r.headers["x-content-type-options"] == "nosniff"
        assert r.headers["x-frame-options"] == "DENY"
        assert "content-security-policy" in r.headers


def test_headers_present_on_csrf_rejection(client, login):
    """O 403 do CSRF é a resposta que um atacante mais vê. Não pode ser a mais nua."""
    login()
    del client.headers["X-CSRF-Token"]
    r = client.post("/api/v1/analyses/text", json={"content": "x"})
    assert r.status_code == 403
    assert r.headers["x-content-type-options"] == "nosniff"


def test_headers_present_on_readiness(client):
    r = client.get("/ready")
    assert r.headers["x-content-type-options"] == "nosniff"


def test_no_server_banner_leak(client):
    """Não anunciar versão de servidor: é reconhecimento de graça para o atacante."""
    server = client.get("/health").headers.get("server", "")
    assert "uvicorn" not in server.lower()
