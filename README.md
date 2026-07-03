# Hookshade — Vertical Slice

Plataforma web **defensiva** de análise de phishing (triagem de e-mails suspeitos para SOC/Blue Team).
Esta é a primeira fatia vertical: submeter um `.eml`/texto → parser → extração de IOCs →
validação SPF/DKIM/DMARC (baseada em headers) → score de risco explicável → tela de resultado.

> Uso ético, autorizado e corporativo. A ferramenta organiza evidências e calcula risco; **não
> substitui a decisão do analista** e não executa anexos.

## Requisitos

- Python 3.11+ (testado em 3.14, 64-bit)
- Node.js 18+ (testado em 24)

## Backend

```bash
cd backend
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt   # Windows (Git Bash)
# .venv/bin/python em Linux/macOS
cp .env.example .env
.venv/Scripts/python -m app.seed                          # cria tabelas + usuário seed
.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
```

API em `http://localhost:8000` (docs em `/docs`). Testes: `.venv/Scripts/python -m pytest`.

## Retenção (purga do `raw_content`)

Análises guardam o conteúdo bruto do e-mail cifrado em repouso. Para não retê-lo além do
necessário, um comando de management remove análises mais antigas que `HOOKSHADE_RETENTION_DAYS`
(padrão 90) e registra cada remoção na auditoria (`analysis.purge`):

```bash
cd backend
.venv/Scripts/python -m app.tasks.purge              # usa HOOKSHADE_RETENTION_DAYS
.venv/Scripts/python -m app.tasks.purge --days 30    # sobrescreve o prazo
```

Agende para rodar diariamente:

- **Linux/macOS (cron):** `0 3 * * * cd /caminho/backend && .venv/bin/python -m app.tasks.purge`
- **Windows (Task Scheduler):** ação `python -m app.tasks.purge`, "iniciar em" = pasta `backend`.

## Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

App em `http://localhost:3000`. Faça login com as credenciais seed definidas em `backend/.env`
(`HOOKSHADE_SEED_EMAIL` / `HOOKSHADE_SEED_PASSWORD`).

## Fluxo

1. Login → 2. Nova Análise (upload `.eml` ou colar texto + contexto) → 3. Resultado
(score, severidade, evidências, IOCs defanged, headers, recomendações) → 4. Histórico.

## Documentação

- Design: `docs/superpowers/specs/2026-07-01-hookshade-vertical-slice-design.md`
- Plano de implementação: `docs/superpowers/plans/2026-07-01-hookshade-vertical-slice.md`

## Fora do escopo desta fatia (fases futuras)

Fila/workers assíncronos, Postgres, Docker, threat intelligence externa, classificação por IA,
relatórios PDF, RBAC/audit logs/rate-limit, correlação de campanhas, dashboard analítico,
integrações SIEM e plugin Microsoft 365.
