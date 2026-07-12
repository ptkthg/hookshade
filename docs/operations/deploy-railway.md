# Deploy no Railway — runbook

Plataforma: **Railway para tudo** (Postgres + backend FastAPI + frontend Next).
Uma plataforma, uma fatura, um lugar para olhar.

> **Regra de ouro:** nenhum segredo entra no Git. Todos vivem nas variáveis do Railway.
> O gate fail-closed (`validate_for_production`) **recusa subir** com segredo fraco,
> cookie inseguro, HSTS desligado ou CORS com curinga. Se o backend não subir, leia o log:
> ele diz exatamente qual variável está errada.

---

## 1. Gerar os segredos (na sua máquina)

```bash
python -c "import secrets; print('SECRET_KEY     =', secrets.token_urlsafe(48))"
python -c "import secrets; print('ENCRYPTION_KEY =', secrets.token_urlsafe(48))"
python -c "import secrets; print('SEED_PASSWORD  =', secrets.token_urlsafe(18))"
```

Guarde os três num gerenciador de senhas. A `ENCRYPTION_KEY` **não pode ser perdida**:
sem ela, todo `raw_content` cifrado no banco vira lixo irrecuperável.

## 2. Provisionar

No Railway, dentro de um projeto novo:

1. **Postgres** — `New → Database → PostgreSQL`. Ele expõe `DATABASE_URL`.
2. **Backend** — `New → GitHub Repo`, raiz `backend/`. O `Procfile` já roda
   `alembic upgrade head` antes do uvicorn, então a migração é automática no deploy.
3. **Frontend** — `New → GitHub Repo`, raiz `frontend/`.

## 3. Variáveis — backend

| Variável | Valor |
|---|---|
| `HOOKSHADE_ENV` | `production` |
| `HOOKSHADE_SECRET_KEY` | (gerado no passo 1) |
| `HOOKSHADE_ENCRYPTION_KEY` | (gerado no passo 1) |
| `HOOKSHADE_SEED_EMAIL` | seu e-mail de admin |
| `HOOKSHADE_SEED_PASSWORD` | (gerado no passo 1) |
| `HOOKSHADE_DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (referência do Railway) |
| `HOOKSHADE_COOKIE_SECURE` | `true` |
| `HOOKSHADE_COOKIE_SAMESITE` | `lax` |
| `HOOKSHADE_HSTS_ENABLED` | `true` |
| `HOOKSHADE_CORS_ORIGINS` | a URL pública do frontend |

## 4. Variáveis — frontend

| Variável | Valor |
|---|---|
| `BACKEND_INTERNAL_URL` | URL **interna** do backend no Railway |
| `NODE_ENV` | `production` (o Railway já define) |

`BACKEND_INTERNAL_URL` **não** leva prefixo `NEXT_PUBLIC_` de propósito: assim ela nunca
entra no bundle do navegador. O browser fala só com `/api/*` do próprio frontend.

## 5. Verificar (obrigatório antes de considerar o deploy feito)

```bash
cd scripts && npm install
HOOKSHADE_FRONTEND_URL=https://<frontend>.up.railway.app \
HOOKSHADE_API_URL=https://<backend>.up.railway.app \
HOOKSHADE_ADMIN_EMAIL=<seed email> \
HOOKSHADE_ADMIN_PASSWORD=<seed password> \
node postdeploy-smoke.cjs
```

O smoke confere HTTPS, todos os headers, CSP com nonce e **sem** `unsafe-inline`/`unsafe-eval`
em `script-src`, cookie `__Host-` + `Secure` + `HttpOnly` num navegador real, ausência de
violação de CSP, e o fluxo completo: login, análise, histórico, resultado, regras, auditoria,
logout. **Deploy só está feito quando o smoke passa.**

---

## Rollback

**CSP quebrou a UI em produção.** Sintoma: página em branco ou botões inertes; console
cheio de "Refused to execute". Sem redeploy de código:

1. No frontend, defina `CSP_REPORT_ONLY=true` e reinicie o serviço.
2. A política vira `Content-Security-Policy-Report-Only`: **relata sem bloquear**. A UI volta.
3. Investigue as violações relatadas, corrija, e remova a variável.

**Deploy ruim.** Railway → serviço → `Deployments` → o deployment anterior → `Redeploy`.
Nenhuma fase até aqui altera schema, então não há migração para desfazer.

**Migração falhou.** O `Procfile` encadeia `alembic upgrade head && uvicorn`: se a migração
falhar, o processo **não sobe** e o deployment anterior continua servindo. Falha segura por
construção. Leia o log, corrija a migração, redeploy.

**Segredo comprometido.** Rotacione `HOOKSHADE_SECRET_KEY` (invalida todas as sessões, o que
é o efeito desejado). **Não rotacione `HOOKSHADE_ENCRYPTION_KEY`** sem um plano de re-cifra:
hoje não existe versionamento de chave e trocá-la torna o histórico ilegível (Fase 6).

---

## Limitações conhecidas deste deploy

- **1 worker apenas.** O rate limit é em memória por processo; com múltiplos workers, cada
  um teria a própria contagem. Redis entra na Fase 6.
- **Purga não está agendada.** O comando existe (`python -m app.tasks.purge`), mas nada o
  invoca sozinho ainda. Fase 3.
- **Sem backup automático nem restore comprovado no Postgres real.** Fase 3.
- **Sem monitoramento.** Se cair, ninguém é avisado. Fase 3.
- **Logout não revoga o JWT.** Um token copiado antes do logout vale até expirar (30 min).
- **Não processe e-mail corporativo real de terceiros** antes da Fase 7 (base legal e DPA).
