"""Gate fail-closed: produção recusa subir com cookie de sessão inseguro."""
import pytest

from app.config import Settings

STRONG = "x" * 40


def _prod(**over) -> Settings:
    base = dict(
        environment="production",
        secret_key=STRONG,
        encryption_key=STRONG,
        seed_password="uma-senha-boa-aqui",
        cors_origins="https://hookshade.app",
        cookie_secure=True,
        cookie_samesite="lax",
    )
    base.update(over)
    return Settings(**base)


def test_production_accepts_secure_cookie_config():
    _prod().validate_for_production()  # não levanta


def test_production_rejects_insecure_cookie():
    with pytest.raises(RuntimeError, match="COOKIE_SECURE"):
        _prod(cookie_secure=False).validate_for_production()


def test_production_rejects_samesite_none():
    """SameSite=None significa cookie de sessão enviado cross-site. Com o proxy
    same-origin isso não é necessário, então é recusado."""
    with pytest.raises(RuntimeError, match="COOKIE_SAMESITE"):
        _prod(cookie_samesite="none").validate_for_production()


def test_production_rejects_invalid_samesite():
    with pytest.raises(RuntimeError, match="COOKIE_SAMESITE"):
        _prod(cookie_samesite="banana").validate_for_production()


def test_production_rejects_cors_wildcard():
    # CORS wildcard + credenciais é combinação proibida
    with pytest.raises(RuntimeError, match="CORS"):
        _prod(cors_origins="*").validate_for_production()


def test_development_allows_insecure_cookie():
    """Dev roda em http://localhost: Secure=false é o único jeito de funcionar."""
    Settings(environment="development", cookie_secure=False).validate_for_production()


def test_host_prefix_only_when_secure():
    """__Host- só é aceito pelo browser com Secure. Em dev (http) o nome é o simples."""
    assert _prod().session_cookie_name.startswith("__Host-")
    dev = Settings(environment="development", cookie_secure=False)
    assert not dev.session_cookie_name.startswith("__Host-")
    assert dev.session_cookie_name == "hookshade_session"
