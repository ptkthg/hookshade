# Hookshade — Backlog priorizado (revisão security-first)

**Data:** 2026-07-01
**Origem:** revisão crítica de produto (Especialista em Cibersegurança / Arquiteto Security-first).
**Tese:** encolher o escopo para *"triagem de phishing explicável e privada, com regras que o
analista escreve"*. Entregar isso impecavelmente > cobrir amplo e raso.

Legenda de prioridade: **P0** = MVP (caminho crítico) · **P1** = v1.1 (logo após validar o MVP) ·
**P2** = futuro (pós product-market-fit / só desenha o hook agora).

---

## P0 — MVP (o corte afiado)

| ID | Item | Valor | Notas |
|----|------|-------|-------|
| P0-1 | Ingestão `.eml` + colar + e-mail encaminhado como anexo | Alto | Já parcialmente feito (.eml + texto) |
| P0-2 | Parsing robusto (headers, text/html, URLs, anexos: hash/MIME/tamanho) | Alto | Existe; endurecer (ver SEC) |
| P0-3 | Extração de IOC + defang + dedup + classificação | Alto | Existe |
| P0-4 | **Findings com proveniência** (`rule_id` + `evidence` + severidade) | Alto | ✅ backend + **surfacado na tela de Resultado** |
| P0-5 | **Rebaixar o "score"**: banda + evidência como manchete; nº como índice heurístico advisory | Alto | ✅ backend + UI ("índice advisory, não veredito") |
| P0-6 | **Discrepância URL exibida vs. real** (texto do link ≠ href) | Alto | ✅ `url_discrepancy.py` + destaque "URL mascarada" na UI |
| P0-7 | Autenticação honesta: separar "lido do header" de "revalidado via DNS" | Alto | ✅ rótulo ajustado; revalidação DNS = P1-1 |
| P0-8 | Tela de resultado orientada a teclado + **copiar IOCs/evidências** | Alto | ✅ `CopyButton`/`IOCList`/`EvidenceBlock`: copiar por item, "copiar todos", copiar evidência |
| P0-9 | Link de relatório compartilhável (read-only) | Médio | ◻ Frontend + rota pública tokenizada |
| P0-10 | **Log de auditoria das análises** (quem, quando, o quê) | Alto | ✅ `audit_logs` + `record_audit` (create/delete/purge) + **`GET /api/v1/audit` read-only paginado + tela `/auditoria`** |
| P0-11 | Retenção/exclusão configurável + cifra do `raw_content` em repouso | Alto | ✅ Fernet + `purge_expired` + `DELETE`; ◻ agendar purga, redação PII |

## P1 — v1.1 (depois de validar o MVP)

| ID | Item | Notas |
|----|------|-------|
| P1-1 | Revalidação viva do domínio (existência de SPF / política DMARC via DNS) | Sem seguir URLs; só DNS |
| P1-2 | Detecção de **quishing** (QR em anexos/imagens → decodifica URL) | Diferenciador atual |
| P1-3 | **Motor de regras editável** (YAML/DSL) + "testar regra contra este e-mail" | Tira heurística do código; detection-engineering |
| P1-4 | "Já visto antes" (link p/ análises do mesmo domínio/hash/assunto) | Correlação leve, sem engine de campanha |
| P1-5 | Export de IOC (CSV/STIX/defanged) + push MISP/TheHive | Fluxo real de SOC |
| P1-6 | Enriquecimento TI **opt-in, BYO-key, desligável** (URLhaus/MalwareBazaar) | Privacidade como configuração |
| P1-7 | Reply-chain / thread-hijacking + `Reply-To`≠`From` reforçado | Extensão dos analisadores atuais |
| P1-8 | RBAC básico + rate limit | Segurança operacional |

## P2 — Futuro (só desenhar o hook agora)

| ID | Item | Por que adiar |
|----|------|---------------|
| P2-1 | IA narrativa (resumir *findings estruturados* em nota) com coleira anti-injeção | Risco; só após guarda-corpos (ver SEC) |
| P2-2 | Conector de caixa `phishing@` (IMAP read-only) para ingestão em lote | Alto valor, alta superfície |
| P2-3 | Relatório executivo PDF | Genérico; baixo valor L1 no início |
| P2-4 | Dashboard analítico | Vaidade métrica antes de volume |
| P2-5 | Correlação de campanhas | Overlap com MISP/TheHive |
| P2-6 | Integração SIEM / SOAR / plugin M365 | Grande superfície; pós-PMF |

## Removido do escopo (não recompetir)

- **Gestão de caso / resposta a incidentes** → é TheHive/XSOAR. Integrar, não reconstruir.
- **Detonação/resolução de URLs online** → risco (SSRF, tip-off, legal). Só heurística offline.

## Sequência de execução sugerida

1. P0-4 + P0-5 + P0-6 + P0-7 (núcleo de análise: evidência, score honesto, discrepância de URL) ← **agora**
2. P0-10 + P0-11 (auditoria + privacidade)
3. P0-8 + P0-9 (UX de resultado + compartilhamento)
4. P1-3 (motor de regras) — destrava P1-2/P1-7 como regras
