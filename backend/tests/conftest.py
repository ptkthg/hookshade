import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base


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
        yield c
    app.dependency_overrides.clear()
