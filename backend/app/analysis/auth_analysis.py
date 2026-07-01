import re

from app.analysis.types import FindingItem, ParsedEmail


def _verdict(raw: str, mechanism: str) -> str:
    m = re.search(rf"{mechanism}\s*=\s*(\w+)", raw, re.IGNORECASE)
    return m.group(1).lower() if m else "none"


def analyze_authentication(parsed: ParsedEmail) -> tuple[list[FindingItem], float]:
    findings: list[FindingItem] = []
    raw = parsed.auth_results_raw
    penalty = 0.0

    for mech, weight, crit in (("spf", 0.25, "médio"), ("dkim", 0.25, "médio"), ("dmarc", 0.35, "alto")):
        v = _verdict(raw, mech)
        if v in ("fail", "none", "softfail", "permerror", "temperror"):
            penalty += weight
            findings.append(FindingItem(
                category="auth",
                severity=crit if v == "fail" else "médio",
                title=f"{mech.upper()} {v}",
                description=f"Resultado de {mech.upper()} = {v} no header Authentication-Results.",
            ))

    # Domain alignment: From vs Return-Path vs Reply-To
    fd = parsed.from_domain
    for label, other in (("Return-Path", parsed.return_path), ("Reply-To", parsed.reply_to)):
        od = other.split("@", 1)[1] if "@" in other else ""
        if fd and od and od != fd:
            penalty += 0.2
            findings.append(FindingItem(
                category="auth",
                severity="alto",
                title=f"Desalinhamento de domínio ({label})",
                description=f"Domínio do From ({fd}) difere de {label} ({od}).",
            ))

    if parsed.message_id_domain and fd and parsed.message_id_domain != fd:
        penalty += 0.1
        findings.append(FindingItem(
            category="auth",
            severity="médio",
            title="Message-ID de domínio distinto",
            description=f"Message-ID usa domínio {parsed.message_id_domain}, diferente do From ({fd}).",
        ))

    return findings, min(penalty, 1.0)
