from pathlib import Path

from app.analysis.content import analyze_content
from app.analysis.parser import parse_email

FIXTURES = Path(__file__).parent / "fixtures"


def test_benign_low_content_subscore():
    parsed = parse_email((FIXTURES / "benign.eml").read_text(encoding="utf-8"))
    findings, subscore = analyze_content(parsed)
    assert subscore < 0.3


def test_phishing_flags_urgency_and_credentials():
    parsed = parse_email((FIXTURES / "phishing.eml").read_text(encoding="utf-8"))
    findings, subscore = analyze_content(parsed)
    assert subscore >= 0.5
    titles = " ".join(f.title.lower() for f in findings)
    assert "urgência" in titles or "urgencia" in titles
    assert "credencial" in titles or "senha" in titles
