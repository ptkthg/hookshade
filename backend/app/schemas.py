from datetime import datetime

from pydantic import BaseModel


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    name: str
    email: str


class AnalyzeTextRequest(BaseModel):
    content: str
    context: str | None = None


class IOCOut(BaseModel):
    type: str
    value_defanged: str
    value_hash: str


class FindingOut(BaseModel):
    category: str
    severity: str
    title: str
    description: str
    weight_contribution: int
    rule_id: str = ""
    evidence: str = ""


class RecommendationOut(BaseModel):
    priority: str
    action_type: str
    description: str


class AuditEntryOut(BaseModel):
    id: int
    action: str
    actor: str | None = None       # e-mail do ator (resolvido); None em eventos de sistema (purga)
    actor_id: int | None = None
    analysis_id: int | None = None
    detail: str = ""
    created_at: datetime


class AuditPage(BaseModel):
    items: list[AuditEntryOut]
    total: int
    limit: int
    offset: int


class AnalysisSummary(BaseModel):
    id: int
    source_type: str
    severity: str
    risk_score: int
    confidence: str
    summary: str
    created_at: datetime


class AnalysisDetail(AnalysisSummary):
    parsed_headers: dict[str, str]
    iocs: list[IOCOut]
    findings: list[FindingOut]
    recommendations: list[RecommendationOut]
