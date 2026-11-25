from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models import User
from app.security import decode_session


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    # A sessão vem EXCLUSIVAMENTE do cookie httpOnly. O header Authorization: Bearer
    # foi removido de propósito: enquanto ele existisse, um XSS ainda poderia
    # autenticar-se com um token roubado, e a migração seria só cosmética.
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    payload = decode_session(token)
    if not payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    user = db.query(User).filter(User.email == payload["sub"]).first()
    # inactive não autentica: token emitido antes da desativação deixa de valer
    if not user or user.status != "active" or user.token_version != payload["ver"]:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    if user.role == "demo" and not (settings.demo_enabled and settings.demo_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Demo disabled")
    request.state.user_id = user.id  # correlação no log de request (id, nunca e-mail)
    return user


def require_writer(user: User = Depends(get_current_user)) -> User:
    if user.role == "demo":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Read-only demo")
    return user


def require_role(*roles: str):
    """Dependência: exige usuário autenticado com um dos papéis. 401 sem auth, 403 sem papel."""
    def _dep(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient role")
        return user
    return _dep
