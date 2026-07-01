from pathlib import Path

from app.analysis.auth_analysis import analyze_authentication
from app.analysis.parser import parse_email

FIXTURES = Path(__file__).parent / "fixtures"


def test_benign_passes_auth_low_subscore():
    parsed = parse_email((FIXTURES / "benign.eml").read_text(encoding="utf-8"))
    findings, subscore = analyze_authentication(parsed)
    assert subscore < 0.3
    assert all(f.category == "auth" for f in findings)


def test_phishing_fails_auth_high_subscore():
    parsed = parse_email((FIXTURES / "phishing.eml").read_text(encoding="utf-8"))
    findings, subscore = analyze_authentication(parsed)
    assert subscore >= 0.6
    titles = " ".join(f.title.lower() for f in findings)
    assert "dmarc" in titles or "spf" in titles
    # alignment mismatch between From and Return-Path domains
    assert any("alinhamento" in f.title.lower() or "alignment" in f.title.lower() for f in findings)
