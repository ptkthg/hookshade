from pathlib import Path

from app.analysis.parser import parse_email
from app.analysis.scoring import score

FIXTURES = Path(__file__).parent / "fixtures"


def test_benign_low_risk():
    parsed = parse_email((FIXTURES / "benign.eml").read_text(encoding="utf-8"))
    result = score(parsed)
    assert result.risk_score < 30
    assert result.severity in ("baixo", "médio")


def test_phishing_high_risk_with_explainable_findings():
    parsed = parse_email((FIXTURES / "phishing.eml").read_text(encoding="utf-8"))
    result = score(parsed)
    assert result.risk_score >= 60
    assert result.severity in ("alto", "crítico")
    # explainability: weight contributions sum to roughly the risk score
    total = sum(f.weight_contribution for f in result.findings)
    assert abs(total - result.risk_score) <= 5
    assert result.recommendations
    assert result.summary


def test_lookalike_and_shortener_structural_findings():
    parsed = parse_email((FIXTURES / "phishing.eml").read_text(encoding="utf-8"))
    result = score(parsed)
    titles = " ".join(f.title.lower() for f in result.findings)
    assert "lookalike" in titles or "similar" in titles or "encurtador" in titles or "punycode" in titles
