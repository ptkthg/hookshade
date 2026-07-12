import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401 — registra todas as tabelas no metadata antes do create_all
from app.database import Base
from app.ratelimit import limiter


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    # estado do limiter é global ao processo; zera para manter testes independentes
    limiter.reset()
    yield
    limiter.reset()


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db_session):
    from fastapi.testclient import TestClient

    from app.deps import get_db
    from app.main import app
    from app.models import User
    from app.security import hash_password

    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    db_session.add(User(name="Analyst", email="analyst@hookshade.local", role="admin",
                        password_hash=hash_password("changeme123")))
    db_session.commit()
    with TestClient(app) as c:
        arm_csrf(c)
        yield c
    app.dependency_overrides.clear()


ADMIN = ("analyst@hookshade.local", "changeme123")


def arm_csrf(c):
    """Pega o token CSRF e o arma no header do client.

    É o que o navegador faz ao carregar a app antes do primeiro POST. Sem isso,
    TODO método mutável leva 403 — inclusive o próprio login, que é protegido de
    propósito (login CSRF permitiria logar a vítima na conta do atacante).
    """
    token = c.get("/api/v1/auth/csrf").json()["csrf_token"]
    c.headers["X-CSRF-Token"] = token
    return token


def authenticate(c, email: str = ADMIN[0], password: str = ADMIN[1]):
    """Autentica um client por COOKIE (não há mais header Bearer).

    O cookie de sessão fica no jar do client e é reenviado sozinho nas requisições
    seguintes, como num navegador.
    """
    arm_csrf(c)
    return c.post("/api/v1/auth/login", json={"email": email, "password": password})


@pytest.fixture
def login(client):
    """Autentica o client compartilhado, no lugar."""
    def _do(email: str = ADMIN[0], password: str = ADMIN[1]):
        r = authenticate(client, email, password)
        assert r.status_code == 200, r.text
        return r
    return _do


@pytest.fixture
def as_user():
    """Client PRÓPRIO para uma identidade.

    Necessário porque o cookie é por client: um único client não consegue mais
    segurar duas sessões ao mesmo tempo, como os headers Bearer permitiam. Testes de
    ownership/RBAC que comparam dois usuários precisam de um client para cada.
    """
    from fastapi.testclient import TestClient

    from app.main import app

    made = []

    def _make(email: str = ADMIN[0], password: str = ADMIN[1]):
        c = TestClient(app)
        r = authenticate(c, email, password)
        assert r.status_code == 200, r.text
        made.append(c)
        return c

    yield _make
    for c in made:
        c.close()
