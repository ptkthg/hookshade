import hashlib

from app.analysis.parser import parse_email
from app.analysis.scoring import score
from app.analysis.types import AnalysisResult


def run_analysis(raw: str, rules: list[dict] | None = None) -> tuple[AnalysisResult, str]:
    """Parse + score raw email content. Returns (result, sha256_of_raw).

    `rules` são regras de detecção ativas (P1-3), injetadas pelo chamador (router)
    para manter o pipeline puro e testável sem banco.
    """
    sha256 = hashlib.sha256(raw.encode("utf-8", errors="replace")).hexdigest()
    parsed = parse_email(raw)
    result = score(parsed, rules)
    return result, sha256
