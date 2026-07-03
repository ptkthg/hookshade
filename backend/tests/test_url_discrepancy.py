"""P0-6: discrepância entre a URL exibida (texto do link) e a real (href).
P0-4: proveniência de evidência (rule_id + evidence) nos findings."""
from app.analysis.parser import parse_email
from app.analysis.scoring import score
from app.analysis.url_discrepancy import analyze_url_discrepancy

_HTML_MISMATCH = """From: Suporte <suporte@example.com>
Subject: Confirme sua conta
Content-Type: text/html

<html><body>
<p>Acesse <a href="http://evil-login.ru/steal">https://secure.paypal.com/login</a> agora.</p>
</body></html>
"""

_HTML_MATCH = """From: Suporte <suporte@paypal.com>
Subject: Recibo
Content-Type: text/html

<html><body>
<p>Veja em <a href="https://www.paypal.com/receipt">www.paypal.com/receipt</a>.</p>
</body></html>
"""


def test_parser_extracts_anchor_pairs():
    parsed = parse_email(_HTML_MISMATCH)
    assert parsed.anchors, "parser deve extrair pares (href, texto)"
    href, text = parsed.anchors[0]
    assert "evil-login.ru" in href
    assert "secure.paypal.com" in text


def test_url_display_mismatch_is_flagged_with_evidence():
    parsed = parse_email(_HTML_MISMATCH)
    findings, subscore = analyze_url_discrepancy(parsed)
    assert findings, "discrepância exibido≠real deve gerar finding"
    f = findings[0]
    assert f.category == "url"
    assert subscore > 0
    # evidência mostra os dois lados
    assert "paypal.com" in f.evidence
    assert "evil-login.ru" in f.evidence
    assert f.rule_id  # proveniência


def test_matching_anchor_is_not_flagged():
    parsed = parse_email(_HTML_MATCH)
    findings, subscore = analyze_url_discrepancy(parsed)
    assert findings == []
    assert subscore == 0


def test_mismatch_raises_score_and_appears_in_findings():
    parsed = parse_email(_HTML_MISMATCH)
    result = score(parsed)
    titles = " ".join(f.title.lower() for f in result.findings)
    assert "discrep" in titles or "exibida" in titles
    assert result.risk_score > 0


def test_all_findings_carry_provenance():
    parsed = parse_email(_HTML_MISMATCH)
    result = score(parsed)
    assert result.findings
    for f in result.findings:
        assert f.rule_id, f"finding sem rule_id: {f.title}"
