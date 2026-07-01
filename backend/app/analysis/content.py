from app.analysis.types import FindingItem, ParsedEmail

_SIGNALS: list[tuple[str, str, list[str]]] = [
    ("urgência", "Urgência / pressão temporal", ["urgent", "urgente", "immediately", "imediatamente", "24 hours", "expire", "expira", "now", "agora"]),
    ("credencial", "Pedido de credencial / senha", ["password", "senha", "verify", "verifique", "credential", "credencial", "reset", "login"]),
    ("ameaça", "Ameaça / consequência", ["suspend", "suspens", "flagged", "blocked", "bloquead", "permanently", "permanente"]),
    ("recompensa", "Recompensa / isca", ["reward", "prize", "prêmio", "premio", "winner", "ganhou", "refund", "reembolso"]),
    ("financeiro", "Cobrança / financeiro", ["invoice fraud", "boleto", "payment", "pagamento", "wire transfer", "transferência"]),
]


def analyze_content(parsed: ParsedEmail) -> tuple[list[FindingItem], float]:
    corpus = f"{parsed.subject}\n{parsed.body_text}\n{parsed.body_html}".lower()
    findings: list[FindingItem] = []
    hits = 0
    for _key, title, kws in _SIGNALS:
        if any(kw in corpus for kw in kws):
            hits += 1
            findings.append(FindingItem(
                category="content",
                severity="médio",
                title=title,
                description="Sinal de engenharia social detectado no assunto/corpo.",
            ))
    subscore = min(hits / 3.0, 1.0)  # 3+ distinct signals => saturates
    return findings, subscore
