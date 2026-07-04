from app.analysis.types import ParsedEmail
from app.rules.engine import build_context, evaluate_rules


def _parsed(**kw):
    base = dict(headers={}, from_addr="a@paypa1.com", from_domain="paypa1.com",
                from_display="PayPal", reply_to="", return_path="", message_id="",
                message_id_domain="", received=[], subject="Ação urgente na sua conta",
                body_text="clique aqui", body_html="<a href='http://x.ru'>paypal.com</a>",
                urls=["http://x.ru"], attachments=[], auth_results_raw="spf=fail",
                anchors=[("http://x.ru", "paypal.com")])
    base.update(kw)
    return ParsedEmail(**base)


def test_context_projection_is_whitelisted():
    ctx = build_context(_parsed())
    assert ctx["from_domain"] == "paypa1.com"
    assert ctx["has_anchor_mismatch"] is True
    assert "x.ru" in ctx["url_hosts"]
    assert set(ctx) == {"subject", "from_addr", "from_domain", "reply_to", "return_path",
                        "body", "auth_results", "url_hosts", "attachment_exts", "has_anchor_mismatch"}


def test_rule_fires_and_emits_finding_with_provenance():
    rule = {"id": 7, "version": 2, "name": "Lookalike PayPal", "category": "url",
            "severity": "alto",
            "condition": {"all": [
                {"field": "from_domain", "op": "endswith", "value": "paypa1.com"},
                {"field": "subject", "op": "contains", "value": "urgente"},
            ]}}
    findings = evaluate_rules(_parsed(), [rule])
    assert len(findings) == 1
    f = findings[0]
    assert f.rule_id == "rule:7:v2"
    assert f.severity == "alto"
    assert f.category == "url"
    assert "paypa1.com" in f.evidence or "urgente" in f.evidence


def test_rule_does_not_fire_when_condition_false():
    rule = {"id": 1, "version": 1, "name": "x", "category": "content", "severity": "médio",
            "condition": {"field": "subject", "op": "contains", "value": "loteria"}}
    assert evaluate_rules(_parsed(), [rule]) == []


def test_regex_and_list_and_not_operators():
    rules = [
        {"id": 2, "version": 1, "name": "regex ru", "category": "url", "severity": "alto",
         "condition": {"field": "url_hosts", "op": "contains", "value": ".ru"}},
        {"id": 3, "version": 1, "name": "nao spf pass", "category": "auth", "severity": "médio",
         "condition": {"not": {"field": "auth_results", "op": "contains", "value": "spf=pass"}}},
    ]
    fired = {f.rule_id for f in evaluate_rules(_parsed(), rules)}
    assert fired == {"rule:2:v1", "rule:3:v1"}
