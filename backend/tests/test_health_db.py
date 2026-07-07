"""Healthcheck real (Fase 1 / Bloco 1).

/health = liveness (app de pé, sem tocar banco). /ready = readiness: SELECT 1
no banco; indisponível → 503 com corpo genérico, sem stack trace nem string
de conexão.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


def test_health_liveness_ok(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_ready_ok_with_database(client):
    r = client.get("/ready")
    assert r.status_code == 200
    assert r.json() == {"status": "ready"}


def test_ready_returns_503_when_database_unavailable(client):
    from app.deps import get_db
    from app.main import app

    broken_engine = create_engine("sqlite:///Z:/caminho/inexistente/nope.db")
    BrokenSession = sessionmaker(bind=broken_engine)

    def _broken_db():
        db = BrokenSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _broken_db
    try:
        r = client.get("/ready")
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert r.status_code == 503
    assert r.json() == {"status": "unavailable"}


def test_ready_failure_does_not_leak_details(client):
    from app.deps import get_db
    from app.main import app

    broken_engine = create_engine("sqlite:///Z:/caminho/inexistente/nope.db")
    BrokenSession = sessionmaker(bind=broken_engine)

    def _broken_db():
        yield BrokenSession()

    app.dependency_overrides[get_db] = _broken_db
    try:
        r = client.get("/ready")
    finally:
        app.dependency_overrides.pop(get_db, None)

    body = r.text.lower()
    for leak in ("traceback", "sqlite", "operationalerror", "sqlalchemy", "z:/", "z:\\"):
        assert leak not in body, f"resposta vazou detalhe interno: {leak}"
