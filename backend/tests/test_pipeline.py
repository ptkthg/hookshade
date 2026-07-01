from pathlib import Path

from app.analysis.pipeline import run_analysis

FIXTURES = Path(__file__).parent / "fixtures"


def test_run_analysis_returns_result_and_hash():
    raw = (FIXTURES / "phishing.eml").read_text(encoding="utf-8")
    result, sha = run_analysis(raw)
    assert len(sha) == 64
    assert result.risk_score >= 60
