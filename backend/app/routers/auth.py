from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.audit import record_audit
from app.config import settings
from app.deps import get_current_user, get_db
from app.models import User
from app.schemas import LoginRequest, TokenResponse, UserOut
from app.security import create_access_token, verify_password

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

# Anti-enumeração: TODA falha de login (email inexistente, senha errada, conta
# bloqueada, conta inativa) responde exatamente isto — mesmo status, mesmo corpo.
_GENERIC_401 = HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")


def _utcnow_naive() -> datetime:
    # colunas DateTime são naive-UTC (mesma convenção de retention.py)
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _register_failure(db: Session, user: User) -> None:
    now = _utcnow_naive()
    user.failed_login_attempts += 1
    user.last_failed_login_at = now
    if user.failed_login_attempts >= settings.login_max_attempts:
        user.locked_until = now + timedelta(minutes=settings.login_lockout_minutes)
        user.failed_login_attempts = 0
        record_audit(db, "auth.lockout", actor_id=user.id,
                     detail=f"lockout {settings.login_lockout_minutes}min "
                            f"após {settings.login_max_attempts} falhas")
    db.commit()


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or user.status != "active":
        raise _GENERIC_401
    if user.locked_until is not None and user.locked_until > _utcnow_naive():
        raise _GENERIC_401
    if not verify_password(body.password, user.password_hash):
        _register_failure(db, user)
        raise _GENERIC_401
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    return TokenResponse(access_token=create_access_token(user.email))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return UserOut(id=user.id, name=user.name, email=user.email, role=user.role)
