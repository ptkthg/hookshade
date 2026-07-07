# Hookshade

Plataforma web **defensiva** de triagem de phishing para SOC/Blue Team: submeter um `.eml`/texto →
parser → extração de IOCs → autenticação de e-mail (SPF/DKIM/DMARC lidos do header) → detecção de
URL mascarada → **índice de risco explicável** → tela de resultado com evidências. Inclui
**auditoria**, **retenção com cifra em repouso** e um **motor de regras de detecção editável** que o
próprio analista escreve — sem executar código.

> Uso ético, autorizado e corporativo. A ferramenta organiza evidências e calcula um índice
> heurístico **advisory**; **não substitui a decisão do analista**, não executa anexos e não
> resolve/detona URLs online. Toda decisão de risco é rastreável (regra + evidência).

## Stack

- **Backend:** Python · FastAPI · Pydantic v2 · SQLAlchemy 2 · PyJWT · bcrypt · cryptography (Fernet) · pytest
- **Frontend:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS
- **Persistência:** SQLite por padrão (troque `HOOKSHADE_DATABASE_URL` por Postgres em produção)

## Requisitos

- Python 3.11+ (testado em 3.14, 64-bit)
- Node.js 18+ (testado em 24)

## Setup — Backend

```bash
cd backend
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt   # Windows (Git Bash); use .venv/bin/python em Linux/macOS
cp .env.example .env                                       # ajuste os segredos (ver "Variáveis de ambiente")
.venv/Scripts/python -m app.seed                           # cria tabelas + usuário seed (papel admin)
.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
```

API em `http://localhost:8000` · docs interativas em `/docs`.

**Testes:** `.venv/Scripts/python -m pytest` (a suíte precisa do interpretador do venv; o Python global
pode não ter as dependências).

## Setup — Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local        # NEXT_PUBLIC_API_BASE aponta para o backend
npm run dev                             # http://localhost:3000
npm run build                           # build de produção
npm run lint
```

Faça login com as credenciais seed de `backend/.env` (`HOOKSHADE_SEED_EMAIL` / `HOOKSHADE_SEED_PASSWORD`).

## Fluxo principal

1. **Login** → 2. **Nova Análise** (upload `.eml` ou colar texto + contexto) → 3. **Resultado**
   (índice advisory, severidade, evidências por finding, regras editáveis disparadas, IOCs defanged,
   headers, recomendações) → 4. **Histórico** → 5. **Regras** → 6. **Auditoria**.

## Motor de regras de detecção (P1-3)

Regras são **condições declarativas em JSON** avaliadas por um interpretador puro — **nunca há `eval`,
`exec` ou execução de código**. Cada condição opera sobre uma projeção *whitelisted* do e-mail.

- **Papéis (RBAC):** `analyst` (leitura) e `admin` (cria/edita/ativa/desativa/exclui). O usuário seed é `admin`.
- **Ciclo:** a regra nasce **inativa** → o analista a **testa contra uma análise existente** (simulação
  read-only, não persiste score) → **ativa**. Cada mutação gera nova **versão**, exige **justificativa**
  e grava **auditoria** (`rule.create|update|activate|deactivate|delete`) + histórico versionado.
- **Aplicação:** regras ativas **aumentam** (não substituem) os analisadores. Cada disparo vira um
  finding com `rule_id`+evidência; a contribuição total ao índice é **limitada a 40 pontos**. No
  resultado, toda regra disparada mostra versão, evidência e link — nada altera o risco sem rastro.

**DSL — campos permitidos:** `subject`, `from_addr`, `from_domain`, `reply_to`, `return_path`, `body`,
`auth_results` (texto); `url_hosts`, `attachment_exts` (listas); `has_anchor_mismatch` (booleano).
**Operadores:** `equals`, `not_equals`, `contains`, `not_contains`, `startswith`, `endswith`, `regex`,
`in`, `is_true`, `is_false`. **Composição:** `{ "all": [...] }`, `{ "any": [...] }`, `{ "not": {...} }`.

Exemplo:

```json
{ "all": [
  { "field": "from_domain", "op": "endswith", "value": "paypa1.com" },
  { "any": [
    { "field": "subject", "op": "contains", "value": "urgente" },
    { "field": "has_anchor_mismatch", "op": "is_true" }
  ]}
]}
```

## Privacidade e retenção

- **Cifra em repouso:** o `raw_content` é cifrado (Fernet) antes de persistir.
- **Redação de PII:** saídas narrativas (summary, evidência de regra) mascaram e-mails, CPF, CNPJ,
  telefones (BR), cartões e credenciais/tokens. Os IOCs estruturados permanecem defanged e íntegros.
- **Retenção/purga:** um comando remove análises além de `HOOKSHADE_RETENTION_DAYS` (padrão 90),
  auditando cada remoção (`analysis.purge`):

```bash
cd backend
.venv/Scripts/python -m app.tasks.purge              # usa HOOKSHADE_RETENTION_DAYS
.venv/Scripts/python -m app.tasks.purge --days 30    # sobrescreve o prazo
```

Agende diariamente — **cron:** `0 3 * * * cd /caminho/backend && .venv/bin/python -m app.tasks.purge` ·
**Windows (Task Scheduler):** ação `python -m app.tasks.purge`, "iniciar em" = pasta `backend`.

## Variáveis de ambiente (backend, prefixo `HOOKSHADE_`)

Em `HOOKSHADE_ENV=production`, a aplicação **recusa subir** (fail-closed) se os segredos
estiverem fracos/default — ver "Deploy de portfólio".

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `HOOKSHADE_ENV` | `development` | `production` ativa o gate de segurança no startup |
| `HOOKSHADE_SECRET_KEY` | (trocar!) | assina JWT; **obrigatória e ≥ 32 chars** em produção |
| `HOOKSHADE_ENCRYPTION_KEY` | vazio | chave Fernet da cifra em repouso; **obrigatória e ≥ 32 chars** em produção (em dev, deriva do secret_key) |
| `HOOKSHADE_SEED_EMAIL` / `HOOKSHADE_SEED_PASSWORD` | seed | admin inicial; **troque a senha** em produção |
| `HOOKSHADE_CORS_ORIGINS` | `http://localhost:3000` | origens permitidas (CSV); **sem curinga** em produção |
| `HOOKSHADE_DATABASE_URL` | `sqlite:///./hookshade.db` | **use Postgres** em produção |
| `HOOKSHADE_RETENTION_DAYS` | `90` | prazo de retenção do `raw_content` antes da purga |
| `HOOKSHADE_ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | expiração do token de acesso |

Frontend: `NEXT_PUBLIC_API_BASE` (URL do backend). Gere segredos com
`python -c "import secrets; print(secrets.token_urlsafe(48))"`.

## Deploy de portfólio

> **Escopo:** isto é uma **peça de portfólio demonstrável**, não um SaaS multiusuário de
> produção. Ver "Portfólio vs. produção real" e "Limitações conhecidas".

1. **Segredos fortes:** setar `HOOKSHADE_ENV=production`, `HOOKSHADE_SECRET_KEY` e
   `HOOKSHADE_ENCRYPTION_KEY` (≥ 32 chars, aleatórios), trocar `HOOKSHADE_SEED_PASSWORD`.
   Se algum estiver fraco/default, o backend **não sobe** (proposital).
2. **Backend:** host de contêiner/ASGI (Railway, Fly, Render…), `uvicorn app.main:app`.
   Provisionar Postgres e apontar `HOOKSHADE_DATABASE_URL`. Segredos por variável de ambiente
   (nunca commitar `.env`).
3. **CORS restrito:** `HOOKSHADE_CORS_ORIGINS` só com o domínio do frontend.
4. **Frontend:** Vercel (ou equivalente), `NEXT_PUBLIC_API_BASE` = URL pública do backend.
5. **Logs sem dados sensíveis:** auditoria não grava `raw_content`; mantenha o princípio.

## Portfólio vs. produção real

| Já resolvido (portfólio) | Falta para produção multiusuário real |
|--------------------------|----------------------------------------|
| Segredos fortes obrigatórios (gate) | Migrações de schema (Alembic) |
| CORS restrito | Rate limiting / proteção a brute-force |
| Cifra em repouso + redação de PII | Tamper-evidence da auditoria (hash-chain/assinatura) |
| RBAC (admin/analyst) | Refresh tokens / revogação de JWT |
| Auditoria append-only | RBAC granular, monitoração, backups |

## Testes e verificação

```bash
# backend
backend/.venv/Scripts/python -m pytest
# frontend
cd frontend && npx tsc --noEmit && npm run build
```

## Smoke pós-deploy

Após publicar, valide o ambiente ao vivo com `scripts/postdeploy-smoke.cjs` (Playwright).
É parametrizado por variáveis de ambiente — **sem segredo no arquivo**, sem localhost fixo,
sem pressupor usuário `viewer` (o seed de produção é admin). Cria uma análise de teste e uma
regra que fica **inativa** (não polui o score); não apaga dados.

```bash
cd scripts
npm install && npx playwright install chromium   # 1ª vez

# bash/CI:
HOOKSHADE_FRONTEND_URL="https://SEU-FRONT.vercel.app" \
HOOKSHADE_API_URL="https://SEU-API.up.railway.app" \
HOOKSHADE_ADMIN_EMAIL="seu-admin@exemplo.com" \
HOOKSHADE_ADMIN_PASSWORD="sua-senha-forte" \
node postdeploy-smoke.cjs
```

```powershell
# PowerShell (Windows):
$env:HOOKSHADE_FRONTEND_URL="https://SEU-FRONT.vercel.app"
$env:HOOKSHADE_API_URL="https://SEU-API.up.railway.app"
$env:HOOKSHADE_ADMIN_EMAIL="seu-admin@exemplo.com"
$env:HOOKSHADE_ADMIN_PASSWORD="sua-senha-forte"
node postdeploy-smoke.cjs
```

Valida: landing pública, `/preview/*` → 404, login admin, nova análise, histórico escopado,
manchete "veredito + ação", criar/testar/ativar/desativar regra, e ausência de token/segredo/
stacktrace na tela. Sai com código ≠ 0 se algum passo falhar (CI-friendly).
`viewer` e acesso a análise alheia (IDOR) já são cobertos pela suíte de testes do backend.

## Limitações conhecidas

- Schema via `create_all` (sem migrações). Alterou modelo? Recrie o banco de dev ou adote Alembic.
- Redação de PII é heurística (regex, foco em formatos BR) — pode ter falsos negativos; é uma barreira
  a mais, não a única (o `raw_content` segue cifrado e sob retenção).
- Regex de regra tem limites anti-ReDoS (tamanho do padrão e do corpus), mas não sandbox de tempo.
- Autenticação de e-mail é **lida do header** (carimbo do MTA receptor), não revalidada via DNS (P1-1).

## Escopo defensivo (não recompetir / fases futuras)

Somente uso defensivo e autorizado. **Fora de escopo:** detonação/resolução de URLs online,
qualquer recurso ofensivo/evasivo. **Futuro (v1.1+):** revalidação DNS, quishing (QR), export MISP/TheHive,
enriquecimento TI opt-in, IA narrativa com coleira anti-injeção, relatório PDF, dashboard, integrações SIEM.

## Documentação

- Design: `docs/superpowers/specs/2026-07-01-hookshade-vertical-slice-design.md`
- Plano do motor de regras: `docs/superpowers/plans/2026-07-03-hookshade-p1-3-rule-engine.md`
- Backlog e revisão de segurança: `docs/superpowers/backlog/` e `docs/superpowers/security/`
