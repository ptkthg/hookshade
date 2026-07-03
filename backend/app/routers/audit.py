"""Auditoria read-only (P0-10 / SEC-7).

Apenas GET — nenhuma rota de escrita/edição/remoção, preservando o caráter
append-only da trilha. Não expõe `raw_content` nem qualquer dado sensível.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db
from app.models import AuditLog, User
from app.schemas import AuditEntryOut, AuditPage

router = APIRouter(prefix="/api/v1/audit", tags=["audit"])


@router.get("", response_model=AuditPage)
def list_audit(
    action: str | None = Query(default=None, description="Filtra por ação exata"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(AuditLog)
    if action:
        q = q.filter(AuditLog.action == action)
    total = q.count()
    rows = (q.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
             .offset(offset).limit(limit).all())

    actor_ids = {r.actor_id for r in rows if r.actor_id is not None}
    actors = ({u.id: u.email for u in db.query(User).filter(User.id.in_(actor_ids)).all()}
              if actor_ids else {})

    items = [
        AuditEntryOut(
            id=r.id, action=r.action, actor=actors.get(r.actor_id), actor_id=r.actor_id,
            analysis_id=r.analysis_id, detail=r.detail, created_at=r.created_at,
        )
        for r in rows
    ]
    return AuditPage(items=items, total=total, limit=limit, offset=offset)
