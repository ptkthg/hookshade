from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import User
from app.security import decode_token

_bearer = HTTPBearer(auto_error=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    request: Request,
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    email = decode_token(creds.credentials)
    if not email:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    user = db.query(User).filter(User.email == email).first()
    # inactive não autentica: token emitido antes da desativação deixa de valer
    if not user or user.status != "active":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    request.state.user_id = user.id  # correlação no log de request (id, nunca e-mail)
    return user


def require_role(*roles: str):
    """Dependência: exige usuário autenticado com um dos papéis. 401 sem auth, 403 sem papel."""
    def _dep(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient role")
        return user
    return _dep
