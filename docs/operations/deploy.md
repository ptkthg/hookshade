# Deploy — Vercel + Render + Neon

> **AMBIENTE NO AR desde 2026-07-12.**
>
> | | URL |
> |---|---|
> | Frontend (público) | **https://hookshade.vercel.app** |
> | API | https://hookshade-api.onrender.com |
> | Banco | Neon (Postgres, free) |
>
> Smoke pós-deploy: **37/37 PASS**. Segurança verificada em produção: cookie `__Host-` +
> `Secure` + `HttpOnly`, CSP com nonce sem `unsafe-inline`/`unsafe-eval`, CSRF barrando
> POST forjado (403), RBAC, anti-IDOR (404), upload `.eml` pelo proxy, e o navegador nunca
> falando direto com a API.

Arquitetura escolhida depois que o Railway passou a exigir cartão para criar serviços.
Este caminho é **gratuito de verdade**: nenhuma das três plataformas pede cartão para o
que usamos aqui.

```
Internet
   ↓  HTTPS
Vercel  —  Next.js (público)
   ↓  HTTPS (proxy same-origin, server-side)
Render  —  FastAPI
   ↓  TLS
Neon    —  PostgreSQL
```

| Camada | Plataforma | Plano | Observação |
|---|---|---|---|
| Frontend | Vercel | Hobby (grátis) | único serviço com domínio público |
| Backend | Render | Free web service | **dorme após 15 min**; 1º acesso leva ~50s |
| Banco | Neon | Free | não expira; inclui `?sslmode=require` |

---

## Diferença importante em relação ao plano original (Railway)

No Railway, o backend ficaria **só na rede privada**. Aqui ele é **público**: a Vercel não
tem rede privada com o Render, então o proxy do Next chama a API pela internet.

Isso **não quebra** o modelo de segurança:

- o navegador continua falando **só** com a Vercel (`/api/*`);
- o cookie de sessão continua sendo `__Host-` na origem do frontend;
- autenticação, CSRF, RBAC, anti-IDOR e rate limit valem em **toda** requisição, venha ela
  de onde vier.

Mas é uma **superfície a mais**: alguém pode bater direto na API, sem passar pelo frontend.
CORS restrito ao domínio da Vercel impede que um site terceiro o faça **pelo navegador**,
mas não impede um cliente HTTP direto (curl). A API foi desenhada para ser exposta — toda
rota exige sessão —, então o risco é aceito nesta fase e registrado como tal.

**Consequências operacionais:**
- **Cron do Render é pago.** O agendamento da purga (Fase 3) sairá por **GitHub Actions**.
- **Cold start.** O free tier dorme; o smoke deve tolerar o primeiro acesso lento.

---

## 1. Segredos (gerados por você, na sua máquina)

```bash
python -c "import secrets; print('SECRET_KEY     =', secrets.token_urlsafe(48))"
python -c "import secrets; print('ENCRYPTION_KEY =', secrets.token_urlsafe(48))"
python -c "import secrets; print('SEED_PASSWORD  =', secrets.token_urlsafe(18))"
```

| Segredo | Para que serve |
|---|---|
| `SECRET_KEY` | assina o JWT da sessão e o token CSRF. Trocá-la derruba todas as sessões |
| `ENCRYPTION_KEY` | cifra o `raw_content` dos e-mails em repouso |
| `SEED_PASSWORD` | senha do primeiro admin, criado no boot |

> **A `ENCRYPTION_KEY` precisa ser preservada por toda a vida do banco.** Sem ela, todo
> e-mail cifrado vira lixo irrecuperável. Não há versionamento nem re-cifra de chave
> hoje (Fase 6). Guarde num gerenciador de senhas antes de continuar.

Guarde os três. Nenhum deles entra no Git, em log ou em conversa.

---

## 2. Neon — PostgreSQL

1. https://neon.com → entrar com GitHub.
2. Criar projeto `hookshade`, região mais próxima.
3. Copiar a **connection string** (formato `postgresql://...?sslmode=require`).

Ela é o valor de `HOOKSHADE_DATABASE_URL`. É **segredo**.

## 3. Render — backend

1. https://render.com → entrar com GitHub → autorizar **só** o repo `hookshade`.
2. `New` → `Web Service` → repositório `hookshade`.
3. Configuração (ou use o `render.yaml` na raiz, via `New → Blueprint`):

| Campo | Valor |
|---|---|
| Root Directory | `backend` |
| Runtime | Python 3 |
| Build Command | `pip install -r requirements.txt` |
| Start Command | ver `render.yaml` (roda `alembic upgrade head` antes do uvicorn) |
| Health Check Path | `/health` |
| Plan | Free |

4. Variáveis:

| Variável | Secreta | Valor |
|---|---|---|
| `PYTHON_VERSION` | não | `3.12` |
| `HOOKSHADE_ENV` | não | `production` |
| `HOOKSHADE_COOKIE_SECURE` | não | `true` |
| `HOOKSHADE_COOKIE_SAMESITE` | não | `lax` |
| `HOOKSHADE_HSTS_ENABLED` | não | `true` |
| `HOOKSHADE_SECRET_KEY` | **sim** | passo 1 |
| `HOOKSHADE_ENCRYPTION_KEY` | **sim** | passo 1 |
| `HOOKSHADE_SEED_PASSWORD` | **sim** | passo 1 |
| `HOOKSHADE_SEED_EMAIL` | não | seu e-mail de admin |
| `HOOKSHADE_DATABASE_URL` | **sim** | Neon (passo 2) |
| `HOOKSHADE_CORS_ORIGINS` | não | URL da Vercel — **só depois do passo 4** |

`HOOKSHADE_CORS_ORIGINS` só é conhecida depois que a Vercel existir. Suba o backend sem ela
primeiro **não**: o gate recusa CORS vazio. Use temporariamente a URL que a Vercel vai gerar,
ou faça o passo 4 antes e volte aqui.

5. No log do deploy, confirmar: migrações aplicadas, **nenhum erro do gate fail-closed**,
   servidor iniciado, e **nenhuma credencial impressa**.

## 4. Vercel — frontend

1. https://vercel.com → entrar com GitHub.
2. `Add New` → `Project` → repositório `hookshade`.
3. **Root Directory: `frontend`**.
4. Variável de ambiente:

| Variável | Valor |
|---|---|
| `BACKEND_INTERNAL_URL` | a URL pública do Render (`https://hookshade-api.onrender.com`) |

**Sem prefixo `NEXT_PUBLIC_`**, de propósito: assim a URL da API nunca entra no bundle do
navegador. O nome diz "internal" porque é de uso exclusivo do servidor do Next.

5. Depois do deploy, volte ao Render e ponha a URL da Vercel em `HOOKSHADE_CORS_ORIGINS`.

---

## 5. Verificar (obrigatório — deploy só está feito quando o smoke passa)

```bash
cd scripts && npm install
HOOKSHADE_FRONTEND_URL=https://<projeto>.vercel.app \
HOOKSHADE_API_URL=https://<api>.onrender.com \
HOOKSHADE_ADMIN_EMAIL=<seed email> \
HOOKSHADE_ADMIN_PASSWORD=<seed password> \
node postdeploy-smoke.cjs
```

O smoke confere HTTPS, todos os headers, CSP com nonce e **sem** `unsafe-inline`/`unsafe-eval`
em `script-src`, cookie `__Host-` + `Secure` + `HttpOnly` num navegador real, ausência de
violação de CSP, e o fluxo completo: login, análise, upload `.eml`, histórico, resultado,
regras, auditoria, RBAC, logout.

> Rode uma vez para "acordar" o Render antes do smoke de verdade: o free tier dorme e o
> primeiro acesso pode levar ~50s, o que faria o smoke falhar por timeout, não por defeito.

---

## Rollback

**CSP quebrou a UI.** Sintoma: página em branco, botões inertes, console cheio de
"Refused to execute". Na Vercel, defina `CSP_REPORT_ONLY=true` e redeploy: a política vira
`Report-Only` (relata sem bloquear) e a UI volta. Investigue, corrija, remova a variável.

**Deploy ruim.** Vercel e Render mantêm os deployments anteriores — promova o anterior pelo
painel. Nenhuma fase até aqui altera schema, então não há migração para desfazer.

**Migração falhou.** O start encadeia `alembic upgrade head && uvicorn`: se a migração
falhar, o processo **não sobe** e o deploy anterior continua servindo. Leia o log, corrija,
redeploy.

**Segredo comprometido.** Rotacione `HOOKSHADE_SECRET_KEY` — derruba todas as sessões, que é
o efeito desejado. **Não rotacione `HOOKSHADE_ENCRYPTION_KEY`** sem plano de re-cifra: hoje
não há versionamento de chave e trocá-la torna o histórico ilegível (Fase 6).

---

## Limitações conhecidas deste ambiente

- **Backend público** (sem rede privada). Risco aceito; toda rota exige sessão.
- **Backend dorme** após 15 min (free tier). Primeiro acesso ~50s.
- **1 worker.** Rate limit em memória por processo. Redis na Fase 6.
- **Purga não agendada.** Cron do Render é pago; sairá por GitHub Actions (Fase 3).
- **Sem backup automático nem restore comprovado.** Neon tem branching/PITR no free tier,
  mas ainda não exercitamos. Fase 3.
- **Sem monitoramento.** Se cair, ninguém é avisado. Fase 3.
- **Logout não revoga o JWT.** Token copiado antes vale até expirar (30 min).
- **Não processe e-mail corporativo real de terceiros** antes da Fase 7 (base legal e DPA).
