"""Casos de uso de regras: cada mutação versiona, historia (RuleChange) e audita (AuditLog)."""
from app.audit import record_audit
from app.models import Analysis, DetectionRule, RuleChange
from app.rules.validation import validate_condition

VALID_SEVERITIES = {"baixo", "médio", "alto", "crítico"}
VALID_CATEGORIES = {"auth", "url", "content", "attachment", "structural"}
_MAX_RULES_PENALTY = 40  # espelha app.analysis.scoring; contribuição prevista limitada


def _validate_meta(category: str, severity: str) -> None:
    if category not in VALID_CATEGORIES:
        raise ValueError(f"categoria inválida: {category!r}")
    if severity not in VALID_SEVERITIES:
        raise ValueError(f"severidade inválida: {severity!r}")


def _record(db, rule: DetectionRule, action: str, actor_id: int, justification: str) -> None:
    db.add(RuleChange(rule_id=rule.id, version=rule.version, action=action,
                      condition_snapshot=rule.condition, severity_snapshot=rule.severity,
                      justification=justification, changed_by=actor_id))
    record_audit(db, f"rule.{action}", actor_id=actor_id, detail=f"rule={rule.id} v{rule.version}")


def _get_editable(db, rule_id) -> DetectionRule:
    rule = db.get(DetectionRule, rule_id)
    if rule is None or rule.status == "deleted":
        raise LookupError("regra inexistente")
    return rule


def create_rule(db, actor_id, name, category, severity, condition, description, justification):
    validate_condition(condition)
    _validate_meta(category, severity)
    rule = DetectionRule(name=name, description=description, category=category, severity=severity,
                         condition=condition, status="inactive", version=1,
                         created_by=actor_id, updated_by=actor_id)
    db.add(rule)
    db.commit()
    db.refresh(rule)
    _record(db, rule, "create", actor_id, justification)
    db.commit()
    return rule


def update_rule(db, rule_id, actor_id, *, name=None, description=None, category=None,
                severity=None, condition=None, justification=""):
    rule = _get_editable(db, rule_id)
    if condition is not None:
        validate_condition(condition)
        rule.condition = condition
    if name is not None:
        rule.name = name
    if description is not None:
        rule.description = description
    if category is not None or severity is not None:
        _validate_meta(category or rule.category, severity or rule.severity)
        rule.category = category or rule.category
        rule.severity = severity or rule.severity
    rule.version += 1
    rule.updated_by = actor_id
    db.commit()
    _record(db, rule, "update", actor_id, justification)
    db.commit()
    return rule


def set_status(db, rule_id, actor_id, *, active: bool, justification=""):
    rule = _get_editable(db, rule_id)
    rule.status = "active" if active else "inactive"
    rule.updated_by = actor_id
    db.commit()
    _record(db, rule, "activate" if active else "deactivate", actor_id, justification)
    db.commit()
    return rule


def soft_delete_rule(db, rule_id, actor_id, *, justification=""):
    rule = _get_editable(db, rule_id)
    rule.status = "deleted"
    rule.updated_by = actor_id
    db.commit()
    _record(db, rule, "delete", actor_id, justification)
    db.commit()
    return rule


def get_rule(db, rule_id):
    return db.get(DetectionRule, rule_id)


def list_rules(db, *, status=None, category=None):
    q = db.query(DetectionRule)
    if status:
        q = q.filter(DetectionRule.status == status)
    else:
        q = q.filter(DetectionRule.status != "deleted")
    if category:
        q = q.filter(DetectionRule.category == category)
    return q.order_by(DetectionRule.id).all()


def list_active_rule_dicts(db) -> list[dict]:
    rules = db.query(DetectionRule).filter(DetectionRule.status == "active").all()
    return [{"id": r.id, "version": r.version, "name": r.name, "category": r.category,
             "severity": r.severity, "condition": r.condition} for r in rules]


def rule_history(db, rule_id):
    return (db.query(RuleChange).filter(RuleChange.rule_id == rule_id)
            .order_by(RuleChange.id).all())


def test_rule_against_analysis(db, analysis_id, condition, severity, category) -> dict:
    """Avalia uma regra (rascunho) contra uma análise existente, SEM persistir.

    Decifra o raw da análise, re-parseia e roda o avaliador puro. Retorna se
    dispararia, a evidência (já redigida no engine) e o impacto previsto no score.
    Não grava auditoria: é uma simulação read-only de detection-engineering.
    """
    # imports locais evitam custo/acoplamento no import do módulo
    from app.analysis.parser import parse_email
    from app.analysis.scoring import _severity_from_score
    from app.crypto import decrypt
    from app.rules.engine import _SEVERITY_WEIGHT, evaluate_rules

    validate_condition(condition)
    _validate_meta(category, severity)

    analysis = db.get(Analysis, analysis_id)
    if analysis is None:
        raise LookupError("análise inexistente")

    parsed = parse_email(decrypt(analysis.raw_content))
    synthetic = {"id": 0, "version": 0, "name": "(teste)", "category": category,
                 "severity": severity, "condition": condition}
    findings = evaluate_rules(parsed, [synthetic])

    fired = bool(findings)
    evidence = findings[0].evidence if fired else ""
    current = analysis.risk_score
    delta = min(_SEVERITY_WEIGHT.get(severity, 10), _MAX_RULES_PENALTY) if fired else 0
    predicted = max(0, min(100, current + delta))
    return {
        "fired": fired,
        "evidence": evidence,
        "severity": severity,
        "score_delta": delta,
        "current_score": current,
        "predicted_score": predicted,
        "current_severity": analysis.severity,
        "predicted_severity": _severity_from_score(predicted),
    }
