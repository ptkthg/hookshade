"""Alembic é o mecanismo oficial de schema (Fase 1 / Bloco 1).

Garante que `alembic upgrade head` num banco VAZIO produz exatamente o schema
dos modelos atuais — sem depender de create_all — e que o seed funciona sobre
um banco migrado.
"""
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker

from app.database import Base

BACKEND_DIR = Path(__file__).resolve().parents[1]


def _upgrade_head(db_url: str) -> None:
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    cfg.set_main_option("sqlalchemy.url", db_url)
    command.upgrade(cfg, "head")


@pytest.fixture
def migrated_engine(tmp_path):
    url = f"sqlite:///{tmp_path / 'migrated.db'}"
    _upgrade_head(url)
    engine = create_engine(url, connect_args={"check_same_thread": False})
    yield engine
    engine.dispose()


def test_upgrade_head_creates_all_model_tables(migrated_engine):
    expected = set(Base.metadata.tables)
    actual = set(inspect(migrated_engine).get_table_names())
    assert expected <= actual, f"faltando: {expected - actual}"
    # nada além dos modelos + controle do alembic
    assert actual - expected == {"alembic_version"}


def test_migrated_schema_columns_match_models(migrated_engine):
    insp = inspect(migrated_engine)
    for table_name, table in Base.metadata.tables.items():
        expected_cols = {c.name for c in table.columns}
        actual_cols = {c["name"] for c in insp.get_columns(table_name)}
        assert expected_cols == actual_cols, (
            f"{table_name}: modelo={expected_cols ^ actual_cols} divergente"
        )


def test_seed_user_works_on_migrated_db(migrated_engine):
    from app.models import User
    from app.seed import ensure_seed_user

    factory = sessionmaker(bind=migrated_engine, autoflush=False, autocommit=False)
    ensure_seed_user(session_factory=factory)
    db = factory()
    try:
        user = db.query(User).filter(User.email == "analyst@hookshade.local").first()
        assert user is not None
        assert user.role == "admin"
    finally:
        db.close()
