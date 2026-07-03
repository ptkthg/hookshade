# P1-3 — Motor de Regras de Detecção Editável — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que um analista autorizado crie, edite, ative/desative, versione e exclua (lógico) regras declarativas de detecção de phishing, que o pipeline aplica de forma explicável e auditável — sem nunca executar código arbitrário.

**Architecture:** Regras são **condições declarativas em JSON** (árvore booleana `all`/`any`/`not` sobre um conjunto fechado de campos e operadores). Um **avaliador puro** projeta o `ParsedEmail` num dicionário-contexto whitelisted e caminha a árvore — não há `eval`, `exec`, nem acesso a atributos arbitrários. Regras vivem no banco (`DetectionRule`) com histórico versionado (`RuleChange`). O pipeline carrega as regras **ativas**, injeta no `score()`, e cada disparo vira um `FindingItem(rule_id, evidence)` que já flui pela explicabilidade existente. Mutações exigem RBAC (`role="admin"`), auditoria (`AuditLog`) e justificativa.

**Tech Stack:** FastAPI · SQLAlchemy 2 · Pydantic v2 · pytest. Rodar testes SEMPRE por `backend/.venv/Scripts/python.exe -m pytest`.

---

## Decisões travadas (segurança por padrão)

- **DSL declarativa, sem execução.** Condição = JSON. Nós booleanos: `{"all":[...]}`, `{"any":[...]}`, `{"not": cond}`. Nó folha: `{"field": F, "op": O, "value": V}`.
  - **Campos permitidos (whitelist):** `subject`, `from_addr`, `from_domain`, `reply_to`, `return_path`, `body`, `auth_results`, `url_hosts` (lista), `attachment_exts` (lista), `has_anchor_mismatch` (bool).
  - **Operadores permitidos:** `equals`, `not_equals`, `contains`, `not_contains`, `startswith`, `endswith`, `in`, `regex`, `is_true`, `is_false`. Qualquer campo/op fora da whitelist → rejeição com erro claro (nunca "melhor esforço").
  - **Guardas anti-ReDoS:** `regex` compila com padrão ≤ 200 chars e avalia sobre corpus truncado a 20 000 chars. Padrão inválido → erro de validação (não estoura em runtime).
- **RBAC:** `User.role ∈ {"analyst","admin"}` (default `analyst`). Leitura de regras: qualquer autenticado. Mutação (criar/editar/ativar/desativar/excluir): só `admin`. Seed vira `admin`.
- **Versionamento + rastro:** cada mutação incrementa `DetectionRule.version`, grava `RuleChange` (snapshot da condição+severidade+justificativa+autor) e um `AuditLog` (`rule.create|update|activate|deactivate|delete`). Nenhuma regra altera severidade de uma análise sem deixar `rule_id`+`evidence` no finding.
- **Escopo (YAGNI):** regras **aumentam** (não substituem) os analisadores existentes. Sem UI nesta fatia (só backend + testes). Sem import/export de regras, sem simulação/backtesting — ficam para fase futura.

---

## File Structure

- Create `backend/app/rules/__init__.py` — pacote do motor.
- Create `backend/app/rules/validation.py` — `validate_condition(cond)` + constantes `ALLOWED_FIELDS`/`ALLOWED_OPS`; `RuleValidationError`.
- Create `backend/app/rules/engine.py` — `build_context(parsed)` e `evaluate_rules(parsed, rules) -> list[FindingItem]`; avaliador puro `_eval(cond, ctx)`.
- Create `backend/app/rules/service.py` — casos de uso: `create_rule/update_rule/set_status/soft_delete_rule/list_rules/get_rule/rule_history`, cada um gravando `RuleChange` + `AuditLog`.
- Create `backend/app/routers/rules.py` — endpoints REST protegidos por RBAC.
- Modify `backend/app/models.py` — `User.role`; novos modelos `DetectionRule`, `RuleChange`.
- Modify `backend/app/deps.py` — `require_role(*roles)` (factory de dependência).
- Modify `backend/app/schemas.py` — `RuleIn`, `RuleUpdateIn`, `StatusChangeIn`, `RuleOut`, `RuleChangeOut`.
- Modify `backend/app/seed.py` — seed com `role="admin"`.
- Modify `backend/app/main.py` — registrar `rules.router`.
- Modify `backend/app/analysis/scoring.py` — `score(parsed, rules=None)` funde findings do motor com contribuição limitada e auditável.
- Modify `backend/app/analysis/pipeline.py` — `run_analysis(raw, rules=None)` repassa regras.
- Modify `backend/app/routers/analyses.py` — `_persist` carrega regras ativas e injeta no pipeline.
- Test `backend/tests/test_rules_validation.py`, `test_rules_engine.py`, `test_api_rules.py`, `test_rules_in_pipeline.py`.

---

## Task 1: RBAC — papel do usuário e dependência de autorização

**Files:**
- Modify: `backend/app/models.py` (User)
- Modify: `backend/app/deps.py`
- Modify: `backend/app/seed.py`
- Test: `backend/tests/test_rbac.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_rbac.py
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.deps import get_current_user, require_role
from app.models import User
from app.security import hash_password


def _mint(db, email, role):
    db.add(User(name=role, email=email, role=role, password_hash=hash_password("x")))
    db.commit()


def test_require_role_allows_and_blocks(db_session):
    _mint(db_session, "adm@h.local", "admin")
    _mint(db_session, "an@h.local", "analyst")

    app = FastAPI()

    @app.get("/admin-only")
    def only(_: User = Depends(require_role("admin"))):
        return {"ok": True}

    from app.deps import get_db
    app.dependency_overrides[get_db] = lambda: iter([db_session])

    def as_user(email):
        from app.security import create_access_token
        return {"Authorization": f"Bearer {create_access_token(email)}"}

    c = TestClient(app)
    assert c.get("/admin-only", headers=as_user("adm@h.local")).status_code == 200
    assert c.get("/admin-only", headers=as_user("an@h.local")).status_code == 403
    assert c.get("/admin-only").status_code == 401
```

- [ ] **Step 2: Run test to verify it fails**

Run: `backend/.venv/Scripts/python.exe -m pytest backend/tests/test_rbac.py -v`
Expected: FAIL — `ImportError: cannot import name 'require_role'` (e `User` sem `role`).

- [ ] **Step 3: Add `role` to User**

```python
# backend/app/models.py — dentro de class User, após status:
    role: Mapped[str] = mapped_column(String(20), default="analyst")  # analyst | admin
```

- [ ] **Step 4: Add `require_role` factory**

```python
# backend/app/deps.py — acrescentar ao final:
def require_role(*roles: str):
    """Dependência: exige usuário autenticado com um dos papéis. 401 sem auth, 403 sem papel."""
    def _dep(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient role")
        return user
    return _dep
```

- [ ] **Step 5: Seed as admin**

```python
# backend/app/seed.py — no User(...) do seed, acrescentar:
                role="admin",
```

- [ ] **Step 6: Run test to verify it passes**

Run: `backend/.venv/Scripts/python.exe -m pytest backend/tests/test_rbac.py -v`
Expected: PASS (3 asserts).

- [ ] **Step 7: Verify no regression + commit**

```bash
backend/.venv/Scripts/python.exe -m pytest backend/tests/test_api_analyses.py backend/tests/test_privacy.py -q
git add backend/app/models.py backend/app/deps.py backend/app/seed.py backend/tests/test_rbac.py
git commit -m "feat(rbac): User.role + require_role dependency"
```

---

## Task 2: Validação da DSL (condição segura)

**Files:**
- Create: `backend/app/rules/__init__.py` (vazio)
- Create: `backend/app/rules/validation.py`
- Test: `backend/tests/test_rules_validation.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_rules_validation.py
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `backend/.venv/Scripts/python.exe -m pytest backend/tests/test_rules_validation.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.rules'`.

- [ ] **Step 3: Implement validator**

```python
# backend/app/rules/validation.py
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `backend/.venv/Scripts/python.exe -m pytest backend/tests/test_rules_validation.py -v`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/app/rules/__init__.py backend/app/rules/validation.py backend/tests/test_rules_validation.py
git commit -m "feat(rules): validador da DSL declarativa (whitelist, anti-ReDoS)"
```

---

## Task 3: Avaliador puro (engine)

**Files:**
- Create: `backend/app/rules/engine.py`
- Test: `backend/tests/test_rules_engine.py`

Cada regra passada ao motor é um dict: `{"id": int, "version": int, "name": str, "category": str, "severity": str, "condition": {...}}`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_rules_engine.py
from app.analysis.types import AttachmentMeta, ParsedEmail
from app.rules.engine import build_context, evaluate_rules


def _parsed(**kw):
    base = dict(headers={}, from_addr="a@paypa1.com", from_domain="paypa1.com",
                from_display="PayPal", reply_to="", return_path="", message_id="",
                message_id_domain="", received=[], subject="Ação urgente na sua conta",
                body_text="clique aqui", body_html="<a href='http://x.ru'>paypal.com</a>",
                urls=["http://x.ru"], attachments=[], auth_results="spf=fail",
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `backend/.venv/Scripts/python.exe -m pytest backend/tests/test_rules_engine.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.rules.engine'`.

- [ ] **Step 3: Implement engine**

```python
# backend/app/rules/engine.py
"""Avaliador puro de regras declarativas. Não executa código: caminha a árvore
sobre um contexto whitelisted projetado do ParsedEmail."""
import re
from urllib.parse import urlparse

from app.analysis.types import FindingItem, ParsedEmail

_MAX_CORPUS = 20_000
_SEVERITY_WEIGHT = {"baixo": 5, "médio": 15, "alto": 30, "crítico": 45}


def _hosts(urls: list[str]) -> list[str]:
    out = []
    for u in urls:
        try:
            h = urlparse(u).hostname
        except ValueError:
            h = None
        if h:
            out.append(h.lower())
    return out


def _exts(attachments) -> list[str]:
    exts = []
    for a in attachments:
        name = getattr(a, "filename", "") or ""
        if "." in name:
            exts.append("." + name.rsplit(".", 1)[1].lower())
    return exts


def build_context(parsed: ParsedEmail) -> dict:
    anchor_mismatch = any(
        (urlparse(href).hostname or "").lower() not in (text or "").lower()
        and (urlparse(href).hostname or "") != ""
        for href, text in parsed.anchors
    )
    body = f"{parsed.body_text}\n{parsed.body_html}"[:_MAX_CORPUS]
    return {
        "subject": parsed.subject or "",
        "from_addr": parsed.from_addr or "",
        "from_domain": parsed.from_domain or "",
        "reply_to": parsed.reply_to or "",
        "return_path": parsed.return_path or "",
        "body": body,
        "auth_results": parsed.auth_results_raw or "",
        "url_hosts": _hosts(parsed.urls),
        "attachment_exts": _exts(parsed.attachments),
        "has_anchor_mismatch": bool(anchor_mismatch),
    }


def _eval_leaf(field: str, op: str, value, ctx: dict) -> tuple[bool, str]:
    """Retorna (disparou?, evidência)."""
    actual = ctx[field]
    if op == "is_true":
        return bool(actual) is True, f"{field}=true"
    if op == "is_false":
        return bool(actual) is False, f"{field}=false"
    if isinstance(actual, list):
        low = [str(x).lower() for x in actual]
        v = str(value).lower()
        if op == "contains":
            return any(v in x for x in low), f"{field}~{value}"
        if op == "not_contains":
            return all(v not in x for x in low), f"{field}!~{value}"
        if op == "in":
            return v in low, f"{value} in {field}"
    else:
        a, v = str(actual).lower(), str(value).lower()
        if op == "equals":
            return a == v, f"{field}={value}"
        if op == "not_equals":
            return a != v, f"{field}!={value}"
        if op == "contains":
            return v in a, f'{field} contém "{value}"'
        if op == "not_contains":
            return v not in a, f'{field} sem "{value}"'
        if op == "startswith":
            return a.startswith(v), f"{field}^={value}"
        if op == "endswith":
            return a.endswith(v), f"{field}$={value}"
        if op == "regex":
            m = re.search(value, str(actual)[:_MAX_CORPUS], re.IGNORECASE)
            return bool(m), f'{field}=~/{value}/ → "{m.group(0)}"' if m else ""
    return False, ""


def _eval(cond: dict, ctx: dict) -> tuple[bool, list[str]]:
    if "all" in cond:
        ev = []
        for b in cond["all"]:
            ok, e = _eval(b, ctx)
            if not ok:
                return False, []
            ev += e
        return True, ev
    if "any" in cond:
        for b in cond["any"]:
            ok, e = _eval(b, ctx)
            if ok:
                return True, e
        return False, []
    if "not" in cond:
        ok, _ = _eval(cond["not"], ctx)
        return (not ok), ([f"NOT({_short(cond['not'])})"] if not ok else [])
    ok, e = _eval_leaf(cond["field"], cond["op"], cond.get("value"), ctx)
    return ok, ([e] if ok and e else [])


def _short(cond: dict) -> str:
    return cond.get("field", "expr") if "field" in cond else "expr"


def evaluate_rules(parsed: ParsedEmail, rules: list[dict]) -> list[FindingItem]:
    ctx = build_context(parsed)
    findings: list[FindingItem] = []
    for r in rules:
        fired, evidence = _eval(r["condition"], ctx)
        if fired:
            findings.append(FindingItem(
                category=r.get("category", "content"),
                severity=r["severity"],
                title=r["name"],
                description=f"Regra editável '{r['name']}' disparou.",
                weight_contribution=_SEVERITY_WEIGHT.get(r["severity"], 10),
                rule_id=f"rule:{r['id']}:v{r['version']}",
                evidence="; ".join(evidence)[:500],
            ))
    return findings
```

- [ ] **Step 4: Run test to verify it passes**

Run: `backend/.venv/Scripts/python.exe -m pytest backend/tests/test_rules_engine.py -v`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/app/rules/engine.py backend/tests/test_rules_engine.py
git commit -m "feat(rules): avaliador puro com contexto whitelisted e proveniência"
```

---

## Task 4: Modelos + serviço (versionamento, histórico, auditoria)

**Files:**
- Modify: `backend/app/models.py` (DetectionRule, RuleChange)
- Create: `backend/app/rules/service.py`
- Test: `backend/tests/test_rules_service.py`

- [ ] **Step 1: Add models**

```python
# backend/app/models.py — ao final
class DetectionRule(Base):
    __tablename__ = "detection_rules"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(20))   # auth|url|content|attachment|structural
    severity: Mapped[str] = mapped_column(String(10))   # baixo|médio|alto|crítico
    condition: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(10), default="inactive", index=True)  # active|inactive|deleted
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    updated_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)


class RuleChange(Base):
    """Histórico append-only por regra (versão + snapshot + justificativa)."""
    __tablename__ = "rule_changes"
    id: Mapped[int] = mapped_column(primary_key=True)
    rule_id: Mapped[int] = mapped_column(ForeignKey("detection_rules.id"), index=True)
    version: Mapped[int] = mapped_column(Integer)
    action: Mapped[str] = mapped_column(String(20))  # create|update|activate|deactivate|delete
    condition_snapshot: Mapped[dict] = mapped_column(JSON)
    severity_snapshot: Mapped[str] = mapped_column(String(10))
    justification: Mapped[str] = mapped_column(Text, default="")
    changed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    changed_at: Mapped[datetime] = mapped_column(DateTime, default=_now, index=True)
```

- [ ] **Step 2: Write the failing test**

```python
# backend/tests/test_rules_service.py
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import AuditLog, DetectionRule, RuleChange, User
from app.rules.service import (create_rule, list_active_rule_dicts, rule_history,
                               set_status, soft_delete_rule, update_rule)
from app.rules.validation import RuleValidationError
from app.security import hash_password


@pytest.fixture
def db():
    eng = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(eng)
    s = sessionmaker(bind=eng)()
    s.add(User(name="Adm", email="a@h.local", role="admin", password_hash=hash_password("x")))
    s.commit()
    yield s
    s.close()


_COND = {"field": "subject", "op": "contains", "value": "loteria"}


def test_create_starts_inactive_v1_with_history_and_audit(db):
    r = create_rule(db, actor_id=1, name="Loteria", category="content", severity="médio",
                    condition=_COND, description="", justification="baseline")
    assert r.version == 1 and r.status == "inactive"
    assert db.query(RuleChange).filter_by(rule_id=r.id, action="create").count() == 1
    assert db.query(AuditLog).filter_by(action="rule.create").count() == 1


def test_create_rejects_invalid_condition(db):
    with pytest.raises(RuleValidationError):
        create_rule(db, actor_id=1, name="x", category="content", severity="médio",
                    condition={"field": "nope", "op": "contains", "value": "y"},
                    description="", justification="j")


def test_update_bumps_version_and_snapshots(db):
    r = create_rule(db, actor_id=1, name="L", category="content", severity="médio",
                    condition=_COND, description="", justification="c")
    upd = update_rule(db, r.id, actor_id=1, severity="alto",
                      condition={"field": "subject", "op": "contains", "value": "prêmio"},
                      justification="subiu severidade")
    assert upd.version == 2 and upd.severity == "alto"
    hist = rule_history(db, r.id)
    assert [h.action for h in hist] == ["create", "update"]
    assert hist[-1].justification == "subiu severidade"


def test_activate_lists_in_active_dicts(db):
    r = create_rule(db, actor_id=1, name="L", category="content", severity="alto",
                    condition=_COND, description="", justification="c")
    assert list_active_rule_dicts(db) == []
    set_status(db, r.id, actor_id=1, active=True, justification="ligar")
    dicts = list_active_rule_dicts(db)
    assert len(dicts) == 1 and dicts[0]["id"] == r.id and dicts[0]["version"] == r.version


def test_soft_delete_hides_and_audits(db):
    r = create_rule(db, actor_id=1, name="L", category="content", severity="alto",
                    condition=_COND, description="", justification="c")
    set_status(db, r.id, actor_id=1, active=True, justification="on")
    soft_delete_rule(db, r.id, actor_id=1, justification="obsoleta")
    assert db.get(DetectionRule, r.id).status == "deleted"
    assert list_active_rule_dicts(db) == []
    assert db.query(AuditLog).filter_by(action="rule.delete").count() == 1
```

- [ ] **Step 3: Run test to verify it fails**

Run: `backend/.venv/Scripts/python.exe -m pytest backend/tests/test_rules_service.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.rules.service'`.

- [ ] **Step 4: Implement service**

```python
# backend/app/rules/service.py
"""Casos de uso de regras: cada mutação versiona, historia (RuleChange) e audita (AuditLog)."""
from sqlalchemy.orm import Session

from app.audit import record_audit
from app.models import DetectionRule, RuleChange
from app.rules.validation import validate_condition

VALID_SEVERITIES = {"baixo", "médio", "alto", "crítico"}
VALID_CATEGORIES = {"auth", "url", "content", "attachment", "structural"}


def _validate_meta(category: str, severity: str) -> None:
    if category not in VALID_CATEGORIES:
        raise ValueError(f"categoria inválida: {category!r}")
    if severity not in VALID_SEVERITIES:
        raise ValueError(f"severidade inválida: {severity!r}")


def _record(db: Session, rule: DetectionRule, action: str, actor_id: int, justification: str) -> None:
    db.add(RuleChange(rule_id=rule.id, version=rule.version, action=action,
                      condition_snapshot=rule.condition, severity_snapshot=rule.severity,
                      justification=justification, changed_by=actor_id))
    record_audit(db, f"rule.{action}", actor_id=actor_id, detail=f"rule={rule.id} v{rule.version}")


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


def _get_editable(db, rule_id) -> DetectionRule:
    rule = db.get(DetectionRule, rule_id)
    if rule is None or rule.status == "deleted":
        raise LookupError("regra inexistente")
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `backend/.venv/Scripts/python.exe -m pytest backend/tests/test_rules_service.py -v`
Expected: PASS (5 testes).

- [ ] **Step 6: Commit**

```bash
git add backend/app/models.py backend/app/rules/service.py backend/tests/test_rules_service.py
git commit -m "feat(rules): modelos DetectionRule/RuleChange + serviço versionado e auditado"
```

---

## Task 5: Endpoints REST protegidos por RBAC

**Files:**
- Modify: `backend/app/schemas.py`
- Create: `backend/app/routers/rules.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_api_rules.py`

- [ ] **Step 1: Add schemas**

```python
# backend/app/schemas.py — acrescentar (datetime já importado)
class RuleIn(BaseModel):
    name: str
    description: str = ""
    category: str
    severity: str
    condition: dict
    justification: str = ""


class RuleUpdateIn(BaseModel):
    name: str | None = None
    description: str | None = None
    category: str | None = None
    severity: str | None = None
    condition: dict | None = None
    justification: str = ""


class StatusChangeIn(BaseModel):
    justification: str = ""


class RuleOut(BaseModel):
    id: int
    name: str
    description: str
    category: str
    severity: str
    condition: dict
    status: str
    version: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RuleChangeOut(BaseModel):
    id: int
    version: int
    action: str
    severity_snapshot: str
    justification: str
    changed_by: int | None
    changed_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Step 2: Write the failing test**

```python
# backend/tests/test_api_rules.py
import pytest

from app.models import User
from app.security import hash_password

_COND = {"field": "subject", "op": "contains", "value": "loteria"}


@pytest.fixture
def analyst_headers(client, db_session):
    db_session.add(User(name="An", email="an@h.local", role="analyst",
                        password_hash=hash_password("changeme123")))
    db_session.commit()
    r = client.post("/api/v1/auth/login", json={"email": "an@h.local", "password": "changeme123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _admin_headers(client):
    r = client.post("/api/v1/auth/login",
                    json={"email": "analyst@hookshade.local", "password": "changeme123"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_admin_creates_and_lists_rule(client):
    h = _admin_headers(client)
    body = {"name": "Loteria", "category": "content", "severity": "médio",
            "condition": _COND, "justification": "baseline"}
    r = client.post("/api/v1/rules", json=body, headers=h)
    assert r.status_code == 201, r.text
    rid = r.json()["id"]
    assert r.json()["status"] == "inactive" and r.json()["version"] == 1
    lst = client.get("/api/v1/rules", headers=h)
    assert any(x["id"] == rid for x in lst.json())


def test_analyst_can_read_but_not_create(client, analyst_headers):
    assert client.get("/api/v1/rules", headers=analyst_headers).status_code == 200
    r = client.post("/api/v1/rules", headers=analyst_headers,
                    json={"name": "x", "category": "content", "severity": "médio",
                          "condition": _COND, "justification": "j"})
    assert r.status_code == 403


def test_invalid_condition_is_rejected_422(client):
    h = _admin_headers(client)
    r = client.post("/api/v1/rules", headers=h,
                    json={"name": "x", "category": "content", "severity": "médio",
                          "condition": {"field": "__class__", "op": "contains", "value": "y"},
                          "justification": "j"})
    assert r.status_code == 422


def test_activate_deactivate_and_history(client):
    h = _admin_headers(client)
    rid = client.post("/api/v1/rules", headers=h,
                      json={"name": "L", "category": "content", "severity": "alto",
                            "condition": _COND, "justification": "c"}).json()["id"]
    assert client.post(f"/api/v1/rules/{rid}/activate", headers=h,
                       json={"justification": "on"}).json()["status"] == "active"
    assert client.post(f"/api/v1/rules/{rid}/deactivate", headers=h,
                       json={"justification": "off"}).json()["status"] == "inactive"
    hist = client.get(f"/api/v1/rules/{rid}/history", headers=h).json()
    assert [x["action"] for x in hist] == ["create", "activate", "deactivate"]


def test_unauthenticated_blocked(client):
    assert client.get("/api/v1/rules").status_code == 401
```

- [ ] **Step 3: Run test to verify it fails**

Run: `backend/.venv/Scripts/python.exe -m pytest backend/tests/test_api_rules.py -v`
Expected: FAIL — 404 (rota inexistente) / ImportError do router.

- [ ] **Step 4: Implement router**

```python
# backend/app/routers/rules.py
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db, require_role
from app.models import User
from app.rules import service
from app.rules.validation import RuleValidationError
from app.schemas import RuleChangeOut, RuleIn, RuleOut, RuleUpdateIn, StatusChangeIn

router = APIRouter(prefix="/api/v1/rules", tags=["rules"])


def _handle(fn):
    try:
        return fn()
    except RuleValidationError as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e)) from e
    except ValueError as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e)) from e
    except LookupError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e)) from e


@router.get("", response_model=list[RuleOut])
def list_rules(status_f: str | None = Query(None, alias="status"),
               category: str | None = None,
               _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.list_rules(db, status=status_f, category=category)


@router.get("/{rule_id}", response_model=RuleOut)
def get_rule(rule_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    r = service.get_rule(db, rule_id)
    if r is None or r.status == "deleted":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    return r


@router.get("/{rule_id}/history", response_model=list[RuleChangeOut])
def history(rule_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.rule_history(db, rule_id)


@router.post("", response_model=RuleOut, status_code=status.HTTP_201_CREATED)
def create(body: RuleIn, user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    return _handle(lambda: service.create_rule(
        db, actor_id=user.id, name=body.name, category=body.category, severity=body.severity,
        condition=body.condition, description=body.description, justification=body.justification))


@router.put("/{rule_id}", response_model=RuleOut)
def update(rule_id: int, body: RuleUpdateIn,
           user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    return _handle(lambda: service.update_rule(
        db, rule_id, actor_id=user.id, name=body.name, description=body.description,
        category=body.category, severity=body.severity, condition=body.condition,
        justification=body.justification))


@router.post("/{rule_id}/activate", response_model=RuleOut)
def activate(rule_id: int, body: StatusChangeIn,
             user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    return _handle(lambda: service.set_status(db, rule_id, actor_id=user.id, active=True,
                                              justification=body.justification))


@router.post("/{rule_id}/deactivate", response_model=RuleOut)
def deactivate(rule_id: int, body: StatusChangeIn,
               user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    return _handle(lambda: service.set_status(db, rule_id, actor_id=user.id, active=False,
                                              justification=body.justification))


@router.delete("/{rule_id}", response_model=RuleOut)
def delete(rule_id: int, body: StatusChangeIn,
           user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    return _handle(lambda: service.soft_delete_rule(db, rule_id, actor_id=user.id,
                                                   justification=body.justification))
```

```python
# backend/app/main.py — atualizar import e registro
from app.routers import analyses, audit, auth, rules
...
app.include_router(rules.router)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `backend/.venv/Scripts/python.exe -m pytest backend/tests/test_api_rules.py -v`
Expected: PASS (5 testes).

- [ ] **Step 6: Commit**

```bash
git add backend/app/schemas.py backend/app/routers/rules.py backend/app/main.py backend/tests/test_api_rules.py
git commit -m "feat(rules): endpoints REST CRUD+status+history protegidos por RBAC"
```

---

## Task 6: Integração no pipeline (aplicar regras na análise, com rastro no score)

**Files:**
- Modify: `backend/app/analysis/scoring.py`
- Modify: `backend/app/analysis/pipeline.py`
- Modify: `backend/app/routers/analyses.py`
- Test: `backend/tests/test_rules_in_pipeline.py`

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_rules_in_pipeline.py
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `backend/.venv/Scripts/python.exe -m pytest backend/tests/test_rules_in_pipeline.py -v`
Expected: FAIL — `run_analysis()` não aceita `rules`.

- [ ] **Step 3: Thread rules through pipeline & scoring**

Ler `backend/app/analysis/scoring.py` inteiro primeiro. Alterar a assinatura e fundir os findings do motor com contribuição limitada e auditável:

```python
# scoring.py — topo
from app.rules.engine import evaluate_rules
```

```python
# scoring.py — score(parsed) vira score(parsed, rules=None):
def score(parsed: ParsedEmail, rules: list[dict] | None = None) -> AnalysisResult:
    # ... corpo existente que monta `findings` e calcula `risk` ...
    # ANTES de montar o AnalysisResult final, aplicar regras editáveis:
    rule_findings = evaluate_rules(parsed, rules or [])
    if rule_findings:
        findings = findings + rule_findings
        rules_penalty = min(sum(f.weight_contribution for f in rule_findings), 40)
        risk = min(risk + rules_penalty, 100)
        severity = _severity_from_score(risk)  # reusar a função existente de faixa
    # ... resto (summary, recommendations) usando `findings`, `risk`, `severity` ...
```

> Nota de execução: ajustar aos nomes reais das variáveis/funções em `scoring.py` (ex.: a função que converte score→severidade). A contribuição é limitada a 40 pontos e cada regra deixa `rule_id`+`evidence` — o índice nunca muda sem rastro.

```python
# pipeline.py
def run_analysis(raw: str, rules: list[dict] | None = None) -> tuple[AnalysisResult, str]:
    sha256 = hashlib.sha256(raw.encode("utf-8", errors="replace")).hexdigest()
    parsed = parse_email(raw)
    result = score(parsed, rules)
    return result, sha256
```

```python
# routers/analyses.py — em _persist, antes de run_analysis:
from app.rules.service import list_active_rule_dicts
...
def _persist(db, user, raw, source_type, context=None):
    result, sha256 = run_analysis(raw, rules=list_active_rule_dicts(db))
    ...
```

- [ ] **Step 4: Run test to verify it passes**

Run: `backend/.venv/Scripts/python.exe -m pytest backend/tests/test_rules_in_pipeline.py -v`
Expected: PASS (2 testes).

- [ ] **Step 5: Full suite green + commit**

```bash
backend/.venv/Scripts/python.exe -m pytest -q
git add backend/app/analysis/scoring.py backend/app/analysis/pipeline.py backend/app/routers/analyses.py backend/tests/test_rules_in_pipeline.py
git commit -m "feat(rules): pipeline aplica regras ativas com contribuição auditável ao score"
```

---

## Self-Review (feita)

- **Cobertura do spec:** criar/editar/ativar/desativar/excluir (Tasks 4-5), RBAC (Task 1, 5), validação forte (Task 2, 5→422), sem RCE/eval (Task 2-3, whitelist), versionamento+histórico+justificativa (Task 4), auditoria de todas as mutações (Task 4), explicabilidade (rule_id+evidence, Task 3+6), motor aplicado na análise + quais dispararam + efeito no score (Task 6). Critérios de aceite mapeados nos testes de Tasks 5-6.
- **Consistência de tipos:** `list_active_rule_dicts` (Task 4) produz o dict que `evaluate_rules` (Task 3) consome; `rule_id` = `"rule:{id}:v{version}"` idêntico em engine e testes; `require_role` (Task 1) usado em Task 5.
- **Pendências conhecidas (fora desta fatia):** UI de gestão de regras; guarda de import/export; simulação de regra antes de ativar; ReDoS tem mitigação (limites) mas não sandbox de tempo — registrar em security review.
