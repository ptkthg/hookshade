"""Avaliador puro de regras declarativas. Não executa código: caminha a árvore
sobre um contexto whitelisted projetado do ParsedEmail."""
import re
from urllib.parse import urlparse

from app.analysis.types import FindingItem, ParsedEmail

_MAX_CORPUS = 20_000
_SEVERITY_WEIGHT = {"baixo": 5, "médio": 15, "alto": 30, "crítico": 45}


def _host(url: str) -> str:
    try:
        return (urlparse(url).hostname or "").lower()
    except ValueError:
        return ""


def _hosts(urls: list[str]) -> list[str]:
    return [h for h in (_host(u) for u in urls) if h]


def _exts(attachments) -> list[str]:
    exts = []
    for a in attachments:
        name = getattr(a, "filename", "") or ""
        if "." in name:
            exts.append("." + name.rsplit(".", 1)[1].lower())
    return exts


def build_context(parsed: ParsedEmail) -> dict:
    anchor_mismatch = any(
        _host(href) and _host(href) not in (text or "").lower()
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
            return bool(m), (f'{field}=~/{value}/ → "{m.group(0)}"' if m else "")
    return False, ""


def _eval(cond: dict, ctx: dict) -> tuple[bool, list[str]]:
    if "all" in cond:
        ev: list[str] = []
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
        return (not ok), (["condição negada satisfeita"] if not ok else [])
    ok, e = _eval_leaf(cond["field"], cond["op"], cond.get("value"), ctx)
    return ok, ([e] if ok and e else [])


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
