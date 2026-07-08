"""Gestão básica de usuários por admin (Fase 1 / Bloco 2).

Todas as rotas exigem papel admin. Mutações auditam (user.*). O detail da
auditoria carrega apenas ids/roles — nunca senha, nunca hash. Invariante:
o sistema jamais fica sem ao menos um admin ativo.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.audit import record_audit
from app.deps import get_db, require_role
from app.models import User
from app.schemas import UserAdminOut, UserCreateIn, UserPasswordIn, UserRoleIn, UserStatusIn
from app.security import hash_password

router = APIRouter(prefix="/api/v1/users", tags=["users"])


def _get_user_or_404(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    return user


def _has_other_active_admin(db: Session, excluding: User) -> bool:
    return db.query(User).filter(
        User.role == "admin", User.status == "active", User.id != excluding.id
    ).count() > 0


@router.get("", response_model=list[UserAdminOut])
def list_users(admin: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    return db.query(User).order_by(User.created_at.asc()).all()


@router.post("", response_model=UserAdminOut, status_code=status.HTTP_201_CREATED)
def create_user(body: UserCreateIn, admin: User = Depends(require_role("admin")),
                db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already in use")
    user = User(name=body.name.strip(), email=email, role=body.role,
                password_hash=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    record_audit(db, "user.created", actor_id=admin.id,
                 detail=f"user_id={user.id} role={user.role}")
    return user


@router.get("/{user_id}", response_model=UserAdminOut)
def get_user(user_id: int, admin: User = Depends(require_role("admin")),
             db: Session = Depends(get_db)):
    return _get_user_or_404(db, user_id)


@router.patch("/{user_id}/role", response_model=UserAdminOut)
def change_role(user_id: int, body: UserRoleIn,
                admin: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    user = _get_user_or_404(db, user_id)
    if user.role == body.role:
        return user
    if user.role == "admin" and not _has_other_active_admin(db, user):
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "Cannot remove the last active admin")
    old_role = user.role
    user.role = body.role
    db.commit()
    record_audit(db, "user.role_changed", actor_id=admin.id,
                 detail=f"user_id={user.id} {old_role}->{user.role}")
    return user


@router.patch("/{user_id}/status", response_model=UserAdminOut)
def change_status(user_id: int, body: UserStatusIn,
                  admin: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    user = _get_user_or_404(db, user_id)
    if user.status == body.status:
        return user
    if body.status == "inactive" and user.role == "admin" \
            and not _has_other_active_admin(db, user):
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "Cannot deactivate the last active admin")
    user.status = body.status
    db.commit()
    action = "user.deactivated" if body.status == "inactive" else "user.activated"
    record_audit(db, action, actor_id=admin.id, detail=f"user_id={user.id}")
    return user


@router.patch("/{user_id}/password", response_model=UserAdminOut)
def reset_password(user_id: int, body: UserPasswordIn,
                   admin: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    user = _get_user_or_404(db, user_id)
    user.password_hash = hash_password(body.password)
    # senha nova = credencial nova: limpa estado de lockout
    user.failed_login_attempts = 0
    user.locked_until = None
    db.commit()
    record_audit(db, "user.password_reset", actor_id=admin.id, detail=f"user_id={user.id}")
    return user
