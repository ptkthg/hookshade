"""Retenção do raw_content (P0-11): purga análises além do prazo, com auditoria."""
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.audit import record_audit
from app.models import Analysis


def purge_expired(db: Session, older_than_days: int) -> int:
    """Remove análises criadas há mais de `older_than_days` dias. Retorna quantas."""
    # cutoff naive-UTC para casar com o armazenamento do SQLite
    cutoff = (datetime.now(timezone.utc) - timedelta(days=older_than_days)).replace(tzinfo=None)
    rows = db.query(Analysis).filter(Analysis.created_at < cutoff).all()
    removed = 0
    for a in rows:
        aid = a.id
        db.delete(a)  # cascade remove iocs/findings/recommendations
        removed += 1
        record_audit(db, "analysis.purge", analysis_id=aid, detail=f"retention {older_than_days}d")
    return removed
