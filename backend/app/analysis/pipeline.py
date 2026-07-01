import hashlib

from app.analysis.parser import parse_email
from app.analysis.scoring import score
from app.analysis.types import AnalysisResult


def run_analysis(raw: str) -> tuple[AnalysisResult, str]:
    """Parse + score raw email content. Returns (result, sha256_of_raw)."""
    sha256 = hashlib.sha256(raw.encode("utf-8", errors="replace")).hexdigest()
    parsed = parse_email(raw)
    result = score(parsed)
    return result, sha256
