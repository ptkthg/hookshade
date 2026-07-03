from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.analysis.pipeline import run_analysis
from app.audit import record_audit
from app.crypto import encrypt
from app.deps import get_current_user, get_db
from app.models import IOC, Analysis, Finding, Recommendation, User
from app.schemas import (
    AnalysisDetail, AnalysisSummary, AnalyzeTextRequest,
    FindingOut, IOCOut, RecommendationOut,
)

router = APIRouter(prefix="/api/v1/analyses", tags=["analyses"])
_MAX_BYTES = 5 * 1024 * 1024


def _persist(db: Session, user: User, raw: str, source_type: str, context: str | None) -> Analysis:
    result, sha256 = run_analysis(raw)
    analysis = Analysis(
        submitted_by=user.id, source_type=source_type, status="completed",
        raw_content=encrypt(raw),  # SEC-2: cifra em repouso
        parsed_headers=result.parsed_headers, sha256=sha256,
        risk_score=result.risk_score, severity=result.severity,
        confidence=result.confidence, summary=result.summary, context=context,
    )
    analysis.iocs = [IOC(type=i.type, value_defanged=i.value_defanged, value_hash=i.value_hash)
                     for i in result.iocs]
    analysis.findings = [Finding(category=f.category, severity=f.severity, title=f.title,
                                 description=f.description, weight_contribution=f.weight_contribution,
                                 rule_id=f.rule_id, evidence=f.evidence)
                         for f in result.findings]
    analysis.recommendations = [Recommendation(priority=r.priority, action_type=r.action_type,
                                               description=r.description)
                                for r in result.recommendations]
    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    record_audit(db, "analysis.create", actor_id=user.id, analysis_id=analysis.id,
                 detail=f"severity={analysis.severity}")
    return analysis


def _to_detail(a: Analysis) -> AnalysisDetail:
    return AnalysisDetail(
        id=a.id, source_type=a.source_type, severity=a.severity, risk_score=a.risk_score,
        confidence=a.confidence, summary=a.summary, created_at=a.created_at,
        parsed_headers=a.parsed_headers or {},
        iocs=[IOCOut(type=i.type, value_defanged=i.value_defanged, value_hash=i.value_hash) for i in a.iocs],
        findings=[FindingOut(category=f.category, severity=f.severity, title=f.title,
                             description=f.description, weight_contribution=f.weight_contribution,
                             rule_id=f.rule_id, evidence=f.evidence)
                  for f in a.findings],
        recommendations=[RecommendationOut(priority=r.priority, action_type=r.action_type,
                                          description=r.description)
                         for r in a.recommendations],
    )


@router.post("", response_model=AnalysisDetail)
async def create_analysis(
    file: UploadFile | None = File(default=None),
    content: str | None = Form(default=None),
    context: str | None = Form(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if file is not None:
        data = await file.read()
        if len(data) > _MAX_BYTES:
            raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File too large")
        raw = data.decode("utf-8", errors="replace")
        source_type = "eml"
    elif content:
        raw = content
        source_type = "text"
    else:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Provide 'file' or 'content'")
    analysis = _persist(db, user, raw, source_type, context)
    return _to_detail(analysis)


@router.post("/text", response_model=AnalysisDetail)
def create_analysis_text(
    body: AnalyzeTextRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not body.content.strip():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Empty content")
    return _to_detail(_persist(db, user, body.content, "text", body.context))


@router.get("", response_model=list[AnalysisSummary])
def list_analyses(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(Analysis).order_by(Analysis.created_at.desc()).all()
    return [AnalysisSummary(id=a.id, source_type=a.source_type, severity=a.severity,
                            risk_score=a.risk_score, confidence=a.confidence,
                            summary=a.summary, created_at=a.created_at) for a in rows]


@router.get("/{analysis_id}", response_model=AnalysisDetail)
def get_analysis(analysis_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    a = db.get(Analysis, analysis_id)
    if not a:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    return _to_detail(a)


@router.delete("/{analysis_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_analysis(analysis_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Exclusão sob demanda (P0-11): remove a análise e registra auditoria."""
    a = db.get(Analysis, analysis_id)
    if not a:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    db.delete(a)
    db.commit()
    record_audit(db, "analysis.delete", actor_id=user.id, analysis_id=analysis_id)
