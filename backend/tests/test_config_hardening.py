"""Gate de configuração de produção (fail-closed)."""
import pytest

from app.config import Settings


def _settings(**kw) -> Settings:
    base = dict(environment="production",
                secret_key="x" * 40, encryption_key="y" * 40,
                seed_password="trocada-forte-123", cors_origins="https://app.exemplo.com")
    base.update(kw)
    return Settings(**base)


def test_development_is_noop():
    # defaults (environment=development) nunca bloqueiam
    Settings().validate_for_production()  # não levanta


def test_production_ok_with_strong_config():
    _settings().validate_for_production()  # não levanta


def test_production_rejects_default_secret():
    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        _settings(secret_key="change-me-in-production-use-a-32byte-plus-secret").validate_for_production()


def test_production_rejects_missing_encryption_key():
    with pytest.raises(RuntimeError, match="ENCRYPTION_KEY"):
        _settings(encryption_key="").validate_for_production()


def test_production_rejects_default_seed_password():
    with pytest.raises(RuntimeError, match="SEED_PASSWORD"):
        _settings(seed_password="changeme123").validate_for_production()


def test_production_rejects_wildcard_cors():
    with pytest.raises(RuntimeError, match="CORS"):
        _settings(cors_origins="*").validate_for_production()
