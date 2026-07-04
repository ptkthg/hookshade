from urllib.parse import urlparse

from app.analysis.auth_analysis import analyze_authentication
from app.analysis.content import analyze_content
from app.analysis.iocs import extract_iocs
from app.analysis.types import AnalysisResult, FindingItem, ParsedEmail, RecItem
from app.analysis.url_discrepancy import analyze_url_discrepancy
from app.redaction import redact_pii
from app.rules.engine import evaluate_rules

_MAX_RULES_PENALTY = 40  # P1-3: contribuição total das regras editáveis é limitada e auditável

_WEIGHTS = {"auth": 20, "structural": 25, "content": 20, "attachment": 15}
_SHORTENERS = {"bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly"}
_BRANDS = {"microsoft", "office365", "office", "paypal", "apple", "google", "amazon",
           "netflix", "banco", "itau", "bradesco", "nubank"}


def _structural(parsed: ParsedEmail) -> tuple[list[FindingItem], float, float]:
    """Returns (findings, url_structural_subscore, attachment_subscore)."""
    findings: list[FindingItem] = []
    penalty = 0.0
    att_penalty = 0.0

    hosts = {urlparse(u).hostname or "" for u in parsed.urls}
    for host in filter(None, hosts):
        if host in _SHORTENERS:
            penalty += 0.4
            findings.append(FindingItem("url", "médio", f"Encurtador de URL ({host})",
                                        f"URL usa encurtador {host}, ocultando o destino real.",
                                        rule_id="url.shortener", evidence=host))
        if "xn--" in host:
            penalty += 0.5
            findings.append(FindingItem("url", "alto", f"Domínio punycode ({host})",
                                        "Domínio internacionalizado (punycode) pode imitar marca legítima.",
                                        rule_id="url.punycode", evidence=host))

    # lookalike: brand token appears in from-domain but domain isn't the plain brand
    fd = parsed.from_domain
    for brand in _BRANDS:
        if brand in fd.replace("0", "o").replace("1", "l") and not fd.startswith(f"{brand}."):
            penalty += 0.5
            findings.append(FindingItem("url", "alto", f"Domínio lookalike de marca ({fd})",
                                        f"Domínio do remetente lembra a marca '{brand}' mas não é o domínio oficial.",
                                        rule_id="url.brand_lookalike", evidence=f"{fd} ~ {brand}"))
            break

    # P0-6: discrepância entre URL exibida (texto) e real (href)
    disc_findings, disc_penalty = analyze_url_discrepancy(parsed)
    findings.extend(disc_findings)
    penalty += disc_penalty

    if parsed.attachments:
        risky = {".exe", ".scr", ".js", ".vbs", ".zip", ".rar", ".docm", ".xlsm", ".html", ".htm"}
        for att in parsed.attachments:
            ext = "." + att.filename.rsplit(".", 1)[-1].lower() if "." in att.filename else ""
            if ext in risky:
                att_penalty += 0.5
                findings.append(FindingItem("attachment", "alto", f"Anexo de extensão arriscada ({att.filename})",
                                            f"Anexo {att.filename} ({att.mime_type}) tem extensão de risco. "
                                            "Nunca executado; apenas hash/metadados.",
                                            rule_id="attachment.risky_extension", evidence=f"{att.filename} ({att.mime_type})"))

    return findings, min(penalty, 1.0), min(att_penalty, 1.0)


def _severity_from_score(s: int) -> str:
    if s >= 75:
        return "crítico"
    if s >= 50:
        return "alto"
    if s >= 20:
        return "médio"
    return "baixo"


def _confidence(parsed: ParsedEmail) -> str:
    has_auth = bool(parsed.auth_results_raw.strip())
    has_headers = bool(parsed.from_domain)
    if has_auth and has_headers:
        return "high"
    if has_headers:
        return "medium"
    return "low"


def score(parsed: ParsedEmail, rules: list[dict] | None = None) -> AnalysisResult:
    auth_findings, auth_sub = analyze_authentication(parsed)
    struct_findings, struct_sub, att_sub = _structural(parsed)
    content_findings, content_sub = analyze_content(parsed)

    struct_only = [f for f in struct_findings if f.category != "attachment"]
    att_findings = [f for f in struct_findings if f.category == "attachment"]

    parts = {
        "auth": auth_sub * _WEIGHTS["auth"],
        "structural": struct_sub * _WEIGHTS["structural"],
        "content": content_sub * _WEIGHTS["content"],
        "attachment": att_sub * _WEIGHTS["attachment"],
    }
    risk = max(0, min(100, round(sum(parts.values()))))

    # distribute weight_contribution across findings per category, proportional
    by_cat = {
        "auth": (auth_findings, parts["auth"]),
        "structural": (struct_only, parts["structural"]),
        "content": (content_findings, parts["content"]),
        "attachment": (att_findings, parts["attachment"]),
    }
    for flist, pts in by_cat.values():
        if flist:
            per = round(pts / len(flist))
            for f in flist:
                f.weight_contribution = per

    all_findings = auth_findings + struct_only + content_findings + att_findings

    # P1-3: regras editáveis AUMENTAM (não substituem) a análise. Cada disparo vira um
    # finding com rule_id+evidence; a soma dos pesos entra no índice, limitada a _MAX_RULES_PENALTY.
    rule_findings = evaluate_rules(parsed, rules or [])
    if rule_findings:
        all_findings = all_findings + rule_findings
        rules_penalty = min(sum(f.weight_contribution for f in rule_findings), _MAX_RULES_PENALTY)
        risk = max(0, min(100, risk + rules_penalty))

    severity = _severity_from_score(risk)
    iocs = extract_iocs(parsed)
    recs = _recommendations(severity, auth_findings, struct_only)
    summary = _summary(parsed, severity, risk, all_findings)

    return AnalysisResult(
        risk_score=risk,
        severity=severity,
        confidence=_confidence(parsed),
        summary=summary,
        parsed_headers=parsed.headers,
        iocs=iocs,
        findings=all_findings,
        recommendations=recs,
    )


def _summary(parsed: ParsedEmail, severity: str, risk: int, findings: list[FindingItem]) -> str:
    # Manchete = severidade + evidência; o número é apenas um índice heurístico advisory (SEC-4).
    top = "; ".join(f.title for f in findings[:3]) or "sem sinais relevantes"
    remetente = parsed.from_domain or "remetente desconhecido"
    text = (f"E-mail de {remetente} — severidade {severity}. "
            f"Principais evidências: {top}. "
            f"(Índice heurístico advisory: {risk}/100 — não é veredito definitivo.)")
    return redact_pii(text)  # summary é saída visível; nunca vazar PII


def _recommendations(severity: str, auth_findings: list[FindingItem],
                     struct_findings: list[FindingItem]) -> list[RecItem]:
    recs: list[RecItem] = []
    if severity in ("alto", "crítico"):
        recs.append(RecItem("high", "block_domain", "Bloquear domínio remetente no gateway de e-mail."))
        recs.append(RecItem("high", "threat_hunt", "Caça retroativa por assunto, remetente e URLs relacionadas."))
    if auth_findings:
        recs.append(RecItem("medium", "review_auth",
                            "Revisar políticas SPF/DKIM/DMARC e autenticações recentes do usuário alvo."))
    if struct_findings:
        recs.append(RecItem("medium", "block_urls", "Bloquear/inspecionar URLs suspeitas em ambiente isolado."))
    if not recs:
        recs.append(RecItem("low", "monitor", "Nenhuma ação urgente; manter monitoramento padrão."))
    return recs
