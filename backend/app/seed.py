from app.config import settings
from app.database import Base, SessionLocal, engine
from app.models import Analysis, DetectionRule, User
from app.security import hash_password, verify_password


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
    with SessionLocal() as db:
        ensure_demo(db)
        ensure_e2e_user(db)


def ensure_e2e_user(db) -> None:
    """Conta fictícia e pública de teste, opt-in local e nunca criada em produção."""
    if settings.is_production or not settings.e2e_seed_enabled:
        return
    if not db.query(User).filter(User.email == "e2e-analyst@example.com").first():
        db.add(User(name="Analista E2E fictício", email="e2e-analyst@example.com", role="analyst",
                    password_hash=hash_password("e2e-only-analyst-placeholder")))
        db.commit()


def ensure_demo(db) -> None:
    """Opt-in por DEMO_ENABLED; idempotente, sem sobrescrever regras editadas.

    O visitante entra pelo botão, sem senha. Sem DEMO_PASSWORD, a conta recebe uma senha
    aleatória descartada na hora (ninguém a conhece; o login por senha fica inutilizável).
    """
    if not settings.demo_enabled:
        return
    import secrets
    from app.routers.analyses import _persist
    from app.samples import SAMPLES
    from app.rules import service

    user = db.query(User).filter(User.email == "demo@hookshade.example").first()
    if user is None:
        user = User(name="Demonstração fictícia", email="demo@hookshade.example", role="demo",
                    password_hash=hash_password(settings.demo_password or secrets.token_urlsafe(32)))
        db.add(user)
        db.commit()
    elif user.role != "demo":
        raise ValueError("Demo email already assigned to another role")
    elif settings.demo_password and not verify_password(settings.demo_password, user.password_hash):
        user.password_hash = hash_password(settings.demo_password)
        user.token_version += 1
        db.commit()

    if not db.query(DetectionRule).filter(DetectionRule.name == "Exemplo fictício: urgência").first():
        rule = service.create_rule(db, user.id, "Exemplo fictício: urgência", "content", "médio",
                                   {"field": "subject", "op": "contains", "value": "urgente"},
                                   "Regra demonstrativa sobre mensagens fictícias.", "Seed do portfólio")
        service.set_status(db, rule.id, user.id, active=True, justification="Seed do portfólio")
    for sample_id, raw in SAMPLES.items():
        marker = f"portfolio-sample:{sample_id}"
        if not db.query(Analysis).filter(Analysis.submitted_by == user.id, Analysis.context == marker).first():
            _persist(db, user, raw, "eml", marker)


if __name__ == "__main__":
    init_db()
    print("DB initialized and seed user ensured.")
