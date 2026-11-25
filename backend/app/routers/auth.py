from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.audit import record_audit
from app.config import settings
from app.cookies import clear_csrf_cookie, clear_session_cookie, set_csrf_cookie, set_session_cookie
from app.csrf import issue_csrf_token
from app.deps import get_current_user, get_db
from app.models import User
from app.ratelimit import rate_limit_demo, rate_limit_login
from app.schemas import CsrfResponse, LoginRequest, UserOut
from app.security import create_access_token, decode_session, verify_password

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
        if user.role != "demo":
            user.token_version += 1
        user.failed_login_attempts = 0
        record_audit(db, "auth.lockout", actor_id=user.id,
                     detail=f"lockout {settings.login_lockout_minutes}min "
                            f"após {settings.login_max_attempts} falhas")
    db.commit()


@router.get("/csrf", response_model=CsrfResponse)
def csrf(response: Response):
    """Emite o par CSRF (cookie + corpo). O front guarda o valor em memória e o
    ecoa em X-CSRF-Token nas operações mutáveis. Não exige sessão: o login também
    é protegido por CSRF, então o token precisa existir antes de autenticar."""
    token = issue_csrf_token()
    set_csrf_cookie(response, token)
    return CsrfResponse(csrf_token=token)


@router.post("/login", response_model=UserOut, dependencies=[Depends(rate_limit_login)])
def login(body: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or user.status != "active" or (user.role == "demo" and not settings.demo_enabled):
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
    # O JWT vai SÓ no cookie httpOnly. Devolver o token no corpo anularia a migração:
    # bastaria um XSS ler a resposta do login para roubar a sessão.
    minutes = settings.demo_session_minutes if user.role == "demo" else settings.access_token_expire_minutes
    set_session_cookie(response, create_access_token(user.email, user.token_version, minutes=minutes),
                       minutes=minutes)
    return UserOut(id=user.id, name=user.name, email=user.email, role=user.role)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response, request: Request, db: Session = Depends(get_db)):
    """Idempotente: apaga a sessão e responde 204 mesmo sem sessão ativa.

    O cookie CSRF é deliberadamente MANTIDO. Ele não é segredo de sessão (só prova
    mesma-origem) e apagá-lo tornaria o próprio logout não-idempotente: a segunda
    chamada não teria como provar origem e levaria 403. Mantê-lo também deixa a
    tela de login funcional logo após sair.

    Revoga todas as sessões da conta pela versão persistida do token, exceto demo:
    a conta compartilhada só tem o cookie local removido.
    """
    payload = decode_session(request.cookies.get(settings.session_cookie_name, ""))
    if payload:
        db.query(User).filter(User.email == payload["sub"], User.token_version == payload["ver"],
                              User.role != "demo").update(
            {User.token_version: User.token_version + 1}, synchronize_session="fetch")
        db.commit()
    clear_session_cookie(response)


@router.get("/config")
def auth_config():
    return {"demo_enabled": bool(settings.demo_enabled)}


@router.post("/demo", response_model=UserOut, dependencies=[Depends(rate_limit_demo)])
def demo_login(response: Response, db: Session = Depends(get_db)):
    if not settings.demo_enabled:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Demo disabled")
    user = db.query(User).filter(User.email == "demo@hookshade.example", User.role == "demo").first()
    if not user or user.status != "active" or (user.locked_until and user.locked_until > _utcnow_naive()):
        raise _GENERIC_401
    set_session_cookie(response, create_access_token(user.email, user.token_version,
                       minutes=settings.demo_session_minutes), minutes=settings.demo_session_minutes)
    return UserOut(id=user.id, name=user.name, email=user.email, role=user.role)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return UserOut(id=user.id, name=user.name, email=user.email, role=user.role)
