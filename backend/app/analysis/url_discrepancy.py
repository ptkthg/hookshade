"""P0-6 — Discrepância entre a URL exibida (texto do link) e a real (href).

Sinal clássico de phishing: o texto do link aparenta um domínio confiável, mas o
`href` aponta para outro. Puramente offline — nunca resolve nem segue a URL.
"""
import re
from urllib.parse import urlparse

from app.analysis.types import FindingItem, ParsedEmail

_DOMAIN_RE = re.compile(r"\b((?:[a-z0-9-]+\.)+[a-z]{2,})\b", re.IGNORECASE)


def _host(value: str) -> str:
    v = value if "://" in value else f"http://{value}"
    return (urlparse(v).hostname or "").lower().lstrip(".")


def _registrable(host: str) -> str:
    """Domínio registrável aproximado: os dois últimos rótulos (ex.: a.b.paypal.com -> paypal.com)."""
    parts = host.split(".")
    return ".".join(parts[-2:]) if len(parts) >= 2 else host


def _displayed_domain(text: str) -> str:
    """Domínio que o TEXTO do link aparenta apresentar (se houver)."""
    m = _DOMAIN_RE.search(text)
    return _host(m.group(1)) if m else ""


def analyze_url_discrepancy(parsed: ParsedEmail) -> tuple[list[FindingItem], float]:
    findings: list[FindingItem] = []
    penalty = 0.0
    seen: set[tuple[str, str]] = set()

    for href, text in parsed.anchors:
        real = _host(href)
        shown = _displayed_domain(text)
        if not real or not shown:
            continue
        if _registrable(shown) == _registrable(real):
            continue  # texto e destino batem no domínio registrável
        key = (_registrable(shown), _registrable(real))
        if key in seen:
            continue
        seen.add(key)
        penalty += 0.5
        findings.append(FindingItem(
            category="url",
            severity="alto",
            title="URL exibida difere da real",
            description="O texto do link aparenta um domínio, mas o href aponta para outro "
                        "(técnica clássica de mascaramento de link).",
            rule_id="url.display_href_mismatch",
            evidence=f'texto exibe "{shown}" mas aponta para "{real}"',
        ))

    return findings, min(penalty, 1.0)
