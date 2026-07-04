from app.config import settings
from app.database import Base, SessionLocal, engine
from app.models import User
from app.security import hash_password


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
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


if __name__ == "__main__":
    init_db()
    print("DB initialized and seed user ensured.")
