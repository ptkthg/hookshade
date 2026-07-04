"""PII não deve vazar por saídas narrativas (evidência de regra e summary)."""
from app.analysis.pipeline import run_analysis

# corpo contém um e-mail pessoal e um CPF — não podem aparecer crus nas saídas visíveis
_EML = ("From: Cobranca <a@paypa1.com>\r\nSubject: Ação urgente\r\n"
        "Content-Type: text/plain\r\n\r\n"
        "Confirme o titular vitima.pessoal@gmail.com e o CPF 123.456.789-09 agora\r\n")


def test_rule_regex_evidence_is_redacted():
    rule = {"id": 9, "version": 1, "name": "captura contato", "category": "content",
            "severity": "médio",
            "condition": {"field": "body", "op": "regex", "value": r"[\w.]+@[\w.]+"}}
    result, _ = run_analysis(_EML, rules=[rule])
    fired = next(f for f in result.findings if f.rule_id == "rule:9:v1")
    assert "vitima.pessoal@gmail.com" not in fired.evidence
    assert "[email redigido]" in fired.evidence


def test_summary_does_not_leak_pii():
    result, _ = run_analysis(_EML, rules=[])
    assert "vitima.pessoal@gmail.com" not in result.summary
    assert "123.456.789-09" not in result.summary
