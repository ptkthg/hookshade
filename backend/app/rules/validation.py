"""Validação da DSL declarativa de regras. Sem eval: whitelist estrita de campos/ops."""
import re

MAX_REGEX_LEN = 200

# campo -> tipo lógico ("str" | "list" | "bool")
ALLOWED_FIELDS = {
    "subject": "str", "from_addr": "str", "from_domain": "str", "reply_to": "str",
    "return_path": "str", "body": "str", "auth_results": "str",
    "url_hosts": "list", "attachment_exts": "list", "has_anchor_mismatch": "bool",
}
STR_OPS = {"equals", "not_equals", "contains", "not_contains", "startswith", "endswith", "regex"}
LIST_OPS = {"contains", "not_contains", "in"}
BOOL_OPS = {"is_true", "is_false"}
VALUELESS_OPS = {"is_true", "is_false"}


class RuleValidationError(ValueError):
    """Condição de regra malformada ou fora da whitelist."""


def validate_condition(cond: object, depth: int = 0) -> None:
    if depth > 10:
        raise RuleValidationError("condição aninhada demais (máx. 10 níveis)")
    if not isinstance(cond, dict):
        raise RuleValidationError("cada nó da condição deve ser um objeto")

    boolean_keys = {"all", "any", "not"} & set(cond)
    if boolean_keys:
        if len(cond) != 1:
            raise RuleValidationError("nó booleano deve ter exatamente uma chave (all/any/not)")
        key = boolean_keys.pop()
        if key == "not":
            return validate_condition(cond["not"], depth + 1)
        branches = cond[key]
        if not isinstance(branches, list) or not branches:
            raise RuleValidationError(f"'{key}' exige lista não-vazia de condições")
        for b in branches:
            validate_condition(b, depth + 1)
        return

    field, op = cond.get("field"), cond.get("op")
    if field not in ALLOWED_FIELDS:
        raise RuleValidationError(f"campo não permitido: {field!r}")
    ftype = ALLOWED_FIELDS[field]
    valid_ops = {"str": STR_OPS, "list": LIST_OPS, "bool": BOOL_OPS}[ftype]
    if op not in valid_ops:
        raise RuleValidationError(f"operador {op!r} não permitido para campo {field!r}")

    has_value = "value" in cond
    if op in VALUELESS_OPS:
        if has_value:
            raise RuleValidationError(f"operador {op!r} não aceita 'value'")
    else:
        if not has_value:
            raise RuleValidationError(f"operador {op!r} exige 'value'")
        if op == "regex":
            val = cond["value"]
            if not isinstance(val, str) or len(val) > MAX_REGEX_LEN:
                raise RuleValidationError(f"regex inválida ou > {MAX_REGEX_LEN} chars")
            try:
                re.compile(val)
            except re.error as e:
                raise RuleValidationError(f"regex inválida: {e}") from e
