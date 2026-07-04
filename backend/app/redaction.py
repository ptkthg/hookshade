"""Redação mínima de PII para saídas narrativas visíveis (defensivo).

Substitui dados pessoais/sigilosos por placeholders tipados em texto que será
mostrado ao usuário (summary, evidência derivada do corpo, previews, relatórios).
NÃO é aplicado à lista estruturada de IOCs — esses são os indicadores do analista
(já defanged) e precisam permanecer íntegros.

Limitações conhecidas: heurístico por regex; foca em formatos comuns (BR).
Pode haver falsos negativos em formatos exóticos. Nunca é a única barreira —
o raw_content continua cifrado em repouso e sob política de retenção.
"""
import re

_EMAIL = re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b")
_CNPJ = re.compile(r"\b\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2}\b")
_CPF = re.compile(r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b")
_CARD = re.compile(r"\b(?:\d[ -]?){13,16}\b")
_PHONE = re.compile(r"(?:\+?55\s?)?(?:\(?\d{2}\)?[\s.-]?)?9?\d{4}[\s.-]?\d{4}\b")
_CREDENTIAL = re.compile(
    r"(?i)\b(?:senha|password|pwd|token|secret|api[_-]?key|apikey|client_secret)\b\s*[:=]\s*\S+"
)
_BEARER = re.compile(r"(?i)\bbearer\s+[\w.\-]+")
_LONG_TOKEN = re.compile(r"\b[A-Za-z0-9_\-]{20,}\b")


def _mask_long_token(m: re.Match) -> str:
    tok = m.group(0)
    has_alpha = any(c.isalpha() for c in tok)
    has_digit = any(c.isdigit() for c in tok)
    return "[credencial redigida]" if (has_alpha and has_digit) else tok


def redact_pii(text: str | None) -> str:
    """Retorna `text` com PII substituída por placeholders tipados. None/'' -> ''."""
    if not text:
        return ""
    out = text
    # Do mais específico/sigiloso ao mais genérico, para não fatiar padrões maiores.
    out = _CREDENTIAL.sub("[credencial redigida]", out)
    out = _BEARER.sub("[credencial redigida]", out)
    out = _LONG_TOKEN.sub(_mask_long_token, out)
    out = _CNPJ.sub("[cnpj redigido]", out)
    out = _CARD.sub("[cartão redigido]", out)
    out = _CPF.sub("[cpf redigido]", out)
    out = _PHONE.sub("[telefone redigido]", out)
    out = _EMAIL.sub("[email redigido]", out)
    return out
