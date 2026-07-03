"""Trilha de auditoria append-only (P0-10 / SEC-7)."""
from sqlalchemy.orm import Session

from app.models import AuditLog


def record_audit(db: Session, action: str, *, actor_id: int | None = None,
                 analysis_id: int | None = None, detail: str = "") -> None:
    db.add(AuditLog(action=action, actor_id=actor_id, analysis_id=analysis_id, detail=detail))
    db.commit()
