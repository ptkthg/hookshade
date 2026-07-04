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


# ---- Regras de detecção editáveis (P1-3) ----

class RuleIn(BaseModel):
    name: str
    description: str = ""
    category: str
    severity: str
    condition: dict
    justification: str = ""


class RuleUpdateIn(BaseModel):
    name: str | None = None
    description: str | None = None
    category: str | None = None
    severity: str | None = None
    condition: dict | None = None
    justification: str = ""


class StatusChangeIn(BaseModel):
    justification: str = ""


class RuleOut(BaseModel):
    id: int
    name: str
    description: str
    category: str
    severity: str
    condition: dict
    status: str
    version: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RuleChangeOut(BaseModel):
    id: int
    version: int
    action: str
    severity_snapshot: str
    justification: str
    changed_by: int | None
    changed_at: datetime

    model_config = {"from_attributes": True}
