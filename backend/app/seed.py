from app.config import settings
from app.database import Base, SessionLocal, engine
from app.models import User
from app.security import hash_password


def ensure_schema() -> None:
    """Cria o schema via create_all — CONVENIÊNCIA DE DEV/TESTE apenas.

    Em produção o schema é gerido exclusivamente por Alembic
    (`alembic upgrade head`, executado antes do start — ver Procfile/README).
    """
    Base.metadata.create_all(bind=engine)


def ensure_seed_user(session_factory=SessionLocal) -> None:
    db = session_factory()
    try:
        existing = db.query(User).filter(User.email == settings.seed_email).first()
        if not existing:
            db.add(User(
                name="Analyst",
                email=settings.seed_email,
                password_hash=hash_password(settings.seed_password),
                role="admin",
            ))
            db.commit()
    finally:
        db.close()


def init_db() -> None:
    if not settings.is_production:
        ensure_schema()
    ensure_seed_user()


if __name__ == "__main__":
    init_db()
    print("DB initialized and seed user ensured.")
