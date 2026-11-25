"""Catálogo fechado de mensagens fictícias. Nunca recebe conteúdo do visitante."""

SAMPLES = {
    "phishing": """From: Central Fictícia <alerta@contoso.example>
To: analista@example.com
Subject: Urgente: confirme sua senha agora
Message-ID: <demo-phishing@contoso.example>
Authentication-Results: mx.example.com; spf=fail; dkim=fail; dmarc=fail
Content-Type: text/html; charset=utf-8

<p>Sua conta será bloqueada. Confirme sua senha imediatamente.</p>
<a href="http://login.contoso.example/verify">https://example.com</a>
<p>Servidor fictício: 192.0.2.10</p>
""",
    "benign": """From: Equipe Fictícia <equipe@example.com>
To: analista@example.com
Subject: Agenda de treinamento fictício
Message-ID: <demo-benign@example.com>
Authentication-Results: mx.example.com; spf=pass; dkim=pass; dmarc=pass
Content-Type: text/plain; charset=utf-8

O treinamento de triagem será na próxima semana.
Material de exemplo: https://example.com/treinamento
""",
    "invoice": """From: Financeiro Fictício <faturas@contoso.example>
Reply-To: cobranca@outro.example
To: analista@example.com
Subject: Pagamento urgente - fatura fictícia
Message-ID: <demo-invoice@contoso.example>
Authentication-Results: mx.example.com; spf=softfail; dkim=none; dmarc=fail
Content-Type: text/plain; charset=utf-8

Efetue o pagamento imediatamente: http://198.51.100.20/fatura
""",
    "notice": """From: Laboratório Fictício <lab@example.com>
To: analista@example.com
Subject: Janela de manutenção do laboratório
Message-ID: <demo-notice@example.com>
Authentication-Results: mx.example.com; spf=pass; dkim=none; dmarc=pass
Content-Type: text/plain; charset=utf-8

Aviso informativo de manutenção no ambiente de exemplo 203.0.113.5.
Nenhuma ação é necessária.
""",
}
