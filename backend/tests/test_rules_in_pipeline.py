from app.analysis.pipeline import run_analysis

_EML = ("From: PayPal <a@paypa1.com>\r\nSubject: Ação urgente na conta\r\n"
        "Content-Type: text/plain\r\n\r\nvocê ganhou na loteria, clique já\r\n")


def test_active_rule_adds_finding_and_raises_score():
    rule = {"id": 3, "version": 1, "name": "Golpe de loteria", "category": "content",
            "severity": "alto", "condition": {"field": "body", "op": "contains", "value": "loteria"}}
    base, _ = run_analysis(_EML, rules=[])
    withrule, _ = run_analysis(_EML, rules=[rule])
    ids = [f.rule_id for f in withrule.findings]
    assert "rule:3:v1" in ids
    assert withrule.risk_score >= base.risk_score
    fired = next(f for f in withrule.findings if f.rule_id == "rule:3:v1")
    assert "loteria" in fired.evidence


def test_no_rules_keeps_behavior():
    r, _ = run_analysis(_EML)
    assert all(not f.rule_id.startswith("rule:") for f in r.findings)


def test_rule_contribution_is_capped_at_40():
    # três regras críticas (45 cada) somariam 135; a contribuição é limitada a 40
    rules = [{"id": i, "version": 1, "name": f"r{i}", "category": "content", "severity": "crítico",
              "condition": {"field": "body", "op": "contains", "value": "loteria"}} for i in range(1, 4)]
    base, _ = run_analysis(_EML, rules=[])
    withrules, _ = run_analysis(_EML, rules=rules)
    assert withrules.risk_score - base.risk_score <= 40
