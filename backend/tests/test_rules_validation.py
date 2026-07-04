import pytest

from app.rules.validation import RuleValidationError, validate_condition


def test_accepts_valid_leaf_and_boolean_tree():
    cond = {"all": [
        {"field": "from_domain", "op": "endswith", "value": "paypa1.com"},
        {"any": [
            {"field": "subject", "op": "contains", "value": "urgente"},
            {"field": "has_anchor_mismatch", "op": "is_true"},
        ]},
    ]}
    validate_condition(cond)  # não levanta


def test_rejects_unknown_field():
    with pytest.raises(RuleValidationError, match="campo"):
        validate_condition({"field": "__class__", "op": "contains", "value": "x"})


def test_rejects_unknown_operator():
    with pytest.raises(RuleValidationError, match="operador"):
        validate_condition({"field": "subject", "op": "eval", "value": "x"})


def test_rejects_regex_too_long_and_invalid():
    with pytest.raises(RuleValidationError):
        validate_condition({"field": "subject", "op": "regex", "value": "a" * 201})
    with pytest.raises(RuleValidationError, match="regex"):
        validate_condition({"field": "subject", "op": "regex", "value": "("})


def test_value_ops_require_value_boolean_ops_forbid_it():
    with pytest.raises(RuleValidationError):
        validate_condition({"field": "subject", "op": "contains"})          # falta value
    with pytest.raises(RuleValidationError):
        validate_condition({"field": "has_anchor_mismatch", "op": "is_true", "value": "x"})  # value sobrando


def test_rejects_wrong_op_for_field_type():
    with pytest.raises(RuleValidationError, match="operador"):
        validate_condition({"field": "has_anchor_mismatch", "op": "contains", "value": "x"})
    with pytest.raises(RuleValidationError, match="operador"):
        validate_condition({"field": "url_hosts", "op": "startswith", "value": "x"})
