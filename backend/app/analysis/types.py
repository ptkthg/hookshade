from dataclasses import dataclass, field


@dataclass
class AttachmentMeta:
    filename: str
    mime_type: str
    size: int
    sha256: str


@dataclass
class ParsedEmail:
    headers: dict[str, str]
    from_addr: str
    from_domain: str
    from_display: str
    reply_to: str
    return_path: str
    message_id: str
    message_id_domain: str
    received: list[str]
    subject: str
    body_text: str
    body_html: str
    urls: list[str]
    attachments: list[AttachmentMeta]
    auth_results_raw: str


@dataclass
class IOCItem:
    type: str          # domain|url|ip|email|hash
    value: str
    value_defanged: str
    value_hash: str


@dataclass
class FindingItem:
    category: str      # auth|url|content|attachment|structural
    severity: str      # baixo|médio|alto|crítico
    title: str
    description: str
    weight_contribution: int = 0


@dataclass
class RecItem:
    priority: str      # low|medium|high
    action_type: str
    description: str


@dataclass
class AnalysisResult:
    risk_score: int
    severity: str
    confidence: str
    summary: str
    parsed_headers: dict[str, str]
    iocs: list[IOCItem] = field(default_factory=list)
    findings: list[FindingItem] = field(default_factory=list)
    recommendations: list[RecItem] = field(default_factory=list)
