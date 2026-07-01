# Hookshade — Design da Fatia Vertical 1

**Data:** 2026-07-01
**Status:** Aprovado
**Fonte:** `Hookshade_Documentacao_Tecnica_v1.pdf` (documentação técnica oficial v1.0)

## Contexto

Hookshade é uma plataforma web **defensiva** de análise de phishing com apoio de IA, voltada
para SOC/Blue Team. O uso é ético, autorizado e corporativo: a plataforma organiza evidências,
calcula risco e sugere ações defensivas — **não substitui a decisão humana** e não executa
ações ofensivas.

O "MVP" descrito no spec (Prioridades 1–4) é grande demais para um único plano. Este documento
define a **primeira fatia vertical**: uma slice ponta-a-ponta que roda de verdade e prova o valor
central — submeter um e-mail suspeito e receber uma análise com score explicável, IOCs e
recomendações. As demais capacidades entram em fases seguintes.

## Objetivo da fatia

Usuário autenticado submete um `.eml` (ou cola headers/corpo em texto) e recebe uma análise
completa: parsing, extração de IOCs, análise de autenticação, heurísticas de conteúdo, score de
risco explicável, severidade, evidências e recomendações — tudo persistido e pesquisável.

## Estrutura do projeto

- **Local:** `D:\Projetos\hookshade`
- **Repositório:** git próprio, **monorepo** com `backend/` e `frontend/`.

## Stack (slice)

| Camada | Tecnologia | Observação |
|---|---|---|
| Backend | FastAPI + Pydantic + SQLAlchemy + Alembic | Análise **síncrona** (sem fila/workers) |
| Persistência | SQLite | Postgres fica para fase futura |
| Parsing | módulo `email` (stdlib) | Nunca executa anexos |
| Auth | JWT (PyJWT) + passlib/bcrypt | 1 usuário seed, expiração curta |
| Testes | pytest | Fixtures `.eml` benigno + phishing |
| Frontend | Next.js + TypeScript + Tailwind + shadcn/ui | Tema dark navy + azul-violeta ("Conceito 4") |

## Modelo de dados (subconjunto enxuto)

Subconjunto das 12 tabelas do spec, o suficiente para a fatia:

- **users** — `id, name, email, password_hash, status, created_at, last_login_at`
- **analyses** — `id, submitted_by, source_type (eml|text), status, raw_content, parsed_headers (JSON),
  sha256, risk_score, severity, confidence, context, created_at`
- **iocs** — `id, analysis_id, type (domain|url|ip|email|hash), value_defanged, value_hash, source, first_seen`
- **findings** — `id, analysis_id, category (auth|url|content|attachment|structural), severity, title,
  description, weight_contribution`
- **recommendations** — `id, analysis_id, priority, action_type, description`

Tabelas adiadas: `roles`, `email_artifacts` (dedicado), `headers` (dedicado — aqui vai como JSON em
`analyses`), `ti_results`, `attachments` (dedicado — metadados vão como findings/iocs), `reports`,
`audit_logs`.

## Pipeline de análise (síncrono, num único request)

1. Recebe submissão — upload `.eml` **ou** texto colado (headers/corpo) + contexto opcional.
2. Valida tamanho/tipo, calcula `sha256`, armazena o raw.
3. Parseia com `email`: headers (From, Reply-To, Return-Path, Received, Message-ID, encoding),
   corpo `text/plain` e `text/html`, URLs e anexos (**apenas metadados: nome/MIME/tamanho/hash —
   nunca executa nem descompacta com execução**).
4. Extrai e normaliza IOCs (domínios, URLs *defanged*, IPs, remetentes, hashes de anexo), deduplica.
5. **Análise de autenticação** determinística **sem DNS**: lê o header `Authentication-Results`
   (SPF/DKIM/DMARC quando presente) e faz checagem de **alinhamento** entre os domínios de
   From / Return-Path / Reply-To / Message-ID. Verificação criptográfica real de DKIM = fase futura.
6. **Heurísticas de conteúdo:** sinais de urgência, ameaça, recompensa, pedido de credencial,
   cobrança/boleto, reset de senha (regras de palavra-chave/padrão).
7. **Motor de score** determinístico e **auditável** (trilha de qual regra somou quanto). Pesos
   derivados do spec:
   - Autenticação de e-mail — 20%
   - Reputação/estrutura de IOC — 25% (aproximada por **heurísticas estruturais locais**:
     punycode, domínios *lookalike* de marcas conhecidas, encurtadores, display-name vs. domínio
     real, mismatch de alinhamento) — TI externa entra depois somando precisão
   - Conteúdo e engenharia social — 20%
   - Anexos — 15%
   - Sinais estruturais adicionais — peso restante
   Saída: `risk_score` 0–100, `severity` (baixo/médio/alto/crítico), `confidence`, lista de
   `findings` (evidências) e `recommendations`.
8. Persiste `analysis` + `iocs` + `findings` + `recommendations` e retorna o resultado.

> Decisão de projeto: como a fatia não tem TI externa nem IA, o peso de "reputação de IOC" é
> aproximado por heurísticas estruturais locais e auditáveis. O score permanece **explicável**
> (requisito central do spec); TI e IA entram em fases posteriores apenas somando precisão.

## API v1 (subconjunto)

| Método | Endpoint | Descrição |
|---|---|---|
| POST | `/api/v1/auth/login` | Autentica e emite token JWT |
| GET | `/api/v1/auth/me` | Retorna usuário autenticado |
| POST | `/api/v1/analyses` | Cria análise (multipart `.eml` **ou** JSON com texto bruto) |
| GET | `/api/v1/analyses/{id}` | Retorna resultado de uma análise |
| GET | `/api/v1/analyses` | Lista análises (histórico) |

Payload de resultado segue o formato do spec (§9.1): `analysis_id, status, severity, risk_score,
confidence, summary, evidence[], recommendations[]`, mais IOCs e headers parseados.

## Frontend — telas (4)

- **Login** — email + senha.
- **Nova Análise** — upload seguro `.eml` **ou** colar headers/corpo + campo de contexto; validação e preview.
- **Resultado** — score, badge de severidade, timeline, evidências (findings), resultados de
  autenticação, IOCs **defanged**, anexos (metadados), recomendações.
- **Histórico** — lista simples pesquisável por data/severidade/domínio/status.

Diretrizes visuais: tema escuro dark navy / near-black, acento azul-violeta metálico, branco
técnico; badges de severidade com contraste e texto explícito; cards/tabelas/timeline; sem neon
excessivo, caveiras ou escudos genéricos.

## Segurança na fatia

- JWT com expiração curta; senha com hash bcrypt.
- Validação de entrada via Pydantic; CORS restrito.
- Anexos **nunca executados** — só metadados e hash.
- URLs sempre **defanged** na UI; sem incentivo a clique direto.
- Segredos em `.env` (fora do código e do repositório).

RBAC completo, refresh tokens, rate limit, audit logs e SAST/SCA no CI ficam para fase posterior.

## Testes

`pytest` cobrindo parser de e-mail, extração/normalização de IOCs e motor de score, usando
fixtures `.eml` (ao menos um benigno e um de phishing com lookalike + falha de alinhamento).
Frontend: verificação manual da fatia + testes mínimos.

## Fora de escopo (fases futuras — explícito)

Redis/fila/workers assíncronos · Postgres · Docker Compose · threat intelligence externa
(URLhaus, ThreatFox, MalwareBazaar, AlienVault OTX, MISP, PhishTank) · classificação por IA e
camada de prompt seguro · relatórios PDF técnico/executivo · RBAC + audit logs + rate limit ·
correlação de campanhas · Dashboard/Visão Geral analítica · integrações SIEM · plugin Microsoft 365
· playbooks automáticos.

## Critérios de aceite da fatia

- Usuário autenticado submete um `.eml` válido e recebe análise completa com status final.
- Sistema extrai e exibe headers, IOCs (defanged), resultado de autenticação e anexos (metadados).
- Score é explicável: cada finding aponta a evidência e a contribuição de peso.
- Histórico lista análises anteriores e permite abrir o resultado.
- Anexos nunca são executados; segredos não aparecem no repositório.
