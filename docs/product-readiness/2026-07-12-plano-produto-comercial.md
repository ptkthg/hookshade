# Hookshade — Plano de conclusão como produto comercial single-tenant

**Data:** 2026-07-12
**Branch:** `feat/vertical-slice-1`
**Baseline:** `5e95623`
**Alvo:** produto instalável e operável por uma empresa, com instância e banco próprios.

> Multi-tenancy, RLS por organização, billing, planos automáticos, marketplace, SCIM e
> infraestrutura compartilhada estão **fora de escopo**. Recursos ofensivos, execução de
> anexos, phishing real e coleta de credenciais permanecem fora de escopo em definitivo.

---

## 1. Estado atual (verificado, não presumido)

Baseline conferido em 2026-07-12 sobre o commit `5e95623`, árvore limpa e sincronizada
com o remoto privado:

| Verificação | Resultado |
|---|---|
| `git status` | limpo; local == `origin/feat/vertical-slice-1` |
| `pytest` | **206 passed** |
| `alembic current` / `heads` | `f08dcac4679c` — head único, sincronizado |
| `tsc --noEmit` | OK |
| `eslint` | OK |
| `next build` | OK, 12 rotas (inclui o proxy `ƒ /api/[...path]`) |

**Pronto e provado:** sessão em cookie httpOnly, CSRF double-submit assinado por HMAC,
proxy same-origin com origem fixa (anti-SSRF), RBAC, anti-IDOR/BOLA, lockout, rate limit
(em memória), cifra em repouso, redação de PII, auditoria, retenção + comando de purga,
gestão de usuários, motor de regras editável, resultado explicável com ScoreDial.

**A verdade incômoda:** nada disso jamais rodou em produção. Não existe ambiente, não
existe URL, não existe operação. O projeto tem *código funcional*, não *operação
comprovada*, não *produto utilizável sem o desenvolvedor*, não *produto comercialmente
responsável*. Os 206 testes verdes não provam nenhuma das três últimas.

### Lacunas confirmadas por inspeção

- **Zero headers de segurança.** Sem CSP, HSTS, X-Frame-Options, X-Content-Type-Options,
  Referrer-Policy, Permissions-Policy.
- **Zero CI.** Não existe `.github/`.
- **Zero observabilidade.** Sem Sentry, métricas, alertas ou uptime. Há logging JSON
  estruturado no stdout — inútil enquanto ninguém o coleta.
- Purga: existe como CLI, **não está agendada**.
- Backup/restore: scripts + runbook; restore exercitado só em Postgres Docker local.
- Logout não revoga o JWT; sem refresh token, sem MFA, sem reset de senha por e-mail.
- Rate limit em memória por processo (quebra com múltiplos workers).
- Histórico sem paginação, busca ou filtro (`list_analyses` devolve tudo).
- Sem exportação, sem relatório, sem dashboard, sem onboarding.
- Reset de senha via `window.prompt` (`usuarios/page.tsx`).
- Sem SSO, sem pentest, sem preparação de LGPD.

**Sem débito de código oculto:** a varredura não encontrou TODO, FIXME, mocks,
credenciais de teste, flags inseguras, URLs hardcoded, resíduo de `localStorage`,
`Bearer`, `access_token` ou `NEXT_PUBLIC_API_BASE`. Nenhuma rota sem autorização.

---

## 2. Por que o cookie httpOnly ainda não fechou o XSS

Registrado aqui porque é a justificativa técnica da Fase 1 e é contraintuitivo:

O cookie httpOnly impede que um XSS **roube** a sessão. Não impede que ele **use** a
sessão. O token CSRF é legível por JavaScript por construção (é assim que double-submit
funciona) — um XSS o lê, monta a requisição, e o navegador anexa o cookie de sessão
sozinho. Ele faz tudo que o usuário faz.

A defesa contra o abuso em sessão é **CSP**, e ela não existe. Fase 1 não é cosmética:
é a metade que falta da migração de autenticação.

---

## 3. Roadmap por fases

Nenhuma fase começa antes de a anterior estar **verde, versionada e documentada**.

| Fase | Objetivo | Encerra o nível |
|---|---|---|
| **0** | Baseline + este plano | — |
| **1** | Headers/CSP + deploy real com HTTPS | **Portfólio** |
| **2** | CI/CD e qualidade contínua | — |
| **3** | Purga agendada, backup, restore real, observabilidade | **Uso interno** |
| **4** | Refresh + revogação, MFA, reset de senha | — |
| **5** | Paginação, filtros, relatórios, dashboard, onboarding | **Piloto** |
| **6** | SSO/OIDC, Redis, rotação de chave, pentest, disclosure | — |
| **7** | Privacidade/LGPD (técnico + minutas para jurídico) | — |
| **8** | Documentação e operação comercial | — |
| **9** | Release candidate comercial | **Comercial** |

**Plataforma decidida:** Railway para tudo (backend + frontend + Postgres + cron da purga).
Uma plataforma, uma fatura, um lugar para olhar.

**Divisão de execução:** o usuário (Patrick) cria as contas e roda os comandos que exigem
autenticação. Nenhuma credencial passa pelo agente. O agente prepara configuração,
variáveis, migrations, headers, testes e smoke, e conduz passo a passo.

---

## 4. FASE 1 — Exposição segura e deploy real (detalhada)

### 4.1 Escopo

**Parte A — código (agente, TDD).**
1. Middleware de headers de segurança no backend (API JSON).
2. Headers + CSP no frontend Next, com **nonce por requisição** via `middleware.ts`.
3. Settings de produção e extensão do gate fail-closed.
4. Testes: backend (headers) e smoke (headers reais no navegador).

**Parte B — deploy (usuário executa, agente guia).**
5. Provisionar Postgres, backend e frontend no Railway.
6. Variáveis fortes, HTTPS, migrations automáticas (Procfile já faz `alembic upgrade head`).
7. Rodar `scripts/postdeploy-smoke.cjs` contra a URL real.
8. README com URLs e limitações.

### 4.2 Decisões de CSP (e as exceções que não dá para evitar)

| Diretiva | Valor | Motivo |
|---|---|---|
| `default-src` | `'self'` | fecha o resto por padrão |
| `script-src` | `'self' 'nonce-<r>' 'strict-dynamic'` | **sem `unsafe-inline`, sem `unsafe-eval`** em produção. `strict-dynamic` deixa o bootstrap do Next carregar seus chunks |
| `style-src` | `'self' 'unsafe-inline'` | **exceção inevitável e documentada.** A UI usa `style={{...}}` do React em toda parte; atributos `style` são bloqueados por `style-src` sem `unsafe-inline`. Risco aceito: `unsafe-inline` em *estilo* é ordens de magnitude menos perigoso que em *script* (não executa código). Remover exigiria reescrever a UI inteira para classes — fora do escopo desta fase |
| `img-src` | `'self' data:` | favicon e SVGs inline |
| `font-src` | `'self'` | fontes via `next/font` são self-hosted (não há CDN) |
| `connect-src` | `'self'` | o proxy same-origin garante que o browser só fale com a própria origem |
| `frame-ancestors` | `'none'` | anti-clickjacking (substitui X-Frame-Options em navegador moderno; mandamos os dois) |
| `object-src` | `'none'` | sem plugins |
| `base-uri` | `'self'` | impede sequestro de URL base |
| `form-action` | `'self'` | impede exfiltração por submit |

**Dev:** o Turbopack exige `'unsafe-eval'` para HMR. A CSP de desenvolvimento é
deliberadamente mais frouxa; a de produção não. As duas ficam explicitamente separadas.

### 4.3 Headers do backend (API JSON, sem HTML)

- `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` — a API não serve
  HTML nem carrega recurso nenhum; a política mais restritiva possível é a correta.
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` — **só em produção**
  (sob HTTP, HSTS é ignorado e em dev quebraria o localhost).
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`

### 4.4 Testes que nascem primeiro (RED antes do código)

`backend/tests/test_security_headers.py`:
1. resposta traz `X-Content-Type-Options: nosniff`
2. resposta traz `X-Frame-Options: DENY`
3. resposta traz `Referrer-Policy`
4. resposta traz `Permissions-Policy`
5. resposta traz CSP `default-src 'none'`
6. **HSTS ausente em desenvolvimento** (senão travaria o localhost no browser)
7. **HSTS presente em produção**, com `max-age` >= 1 ano
8. headers presentes também em resposta de erro (401/403/404) — não só no caminho feliz
9. headers presentes em `/health` e `/ready`

`backend/tests/test_cookie_config.py` (estende o existente):
10. produção recusa subir sem `HOOKSHADE_ENV=production` coerente com `cookie_secure`
    (já coberto) — acrescentar: gate exige `HSTS` habilitado em produção

Smoke (`scripts/postdeploy-smoke.cjs`, estendido):
11. resposta real do frontend traz CSP com `nonce-` e **sem** `unsafe-inline` em `script-src`
12. resposta real traz HSTS
13. nenhuma violação de CSP no console ao percorrer as rotas autenticadas
14. cookie chega como `__Host-` + `Secure` + `HttpOnly` num navegador real

### 4.5 Arquivos prováveis

| Arquivo | Mudança |
|---|---|
| `backend/app/security_headers.py` | **novo** — middleware de headers |
| `backend/app/main.py` | instala o middleware |
| `backend/app/config.py` | settings `hsts_enabled` / `hsts_max_age`; gate |
| `backend/tests/test_security_headers.py` | **novo** |
| `backend/tests/test_cookie_config.py` | estende o gate |
| `frontend/middleware.ts` | **novo** — nonce por request + CSP |
| `frontend/next.config.ts` | headers estáticos (não-CSP) |
| `frontend/app/layout.tsx` | propagação do nonce, se necessária |
| `scripts/postdeploy-smoke.cjs` | checagens de header e CSP |
| `README.md` | seção de deploy, URLs, limitações |
| `backend/.env.example` | novas variáveis |

### 4.6 Critérios de aceite da Fase 1

- [ ] Ambiente público funcional sob **HTTPS real**.
- [ ] Headers verificados na **resposta real**, não só em teste.
- [ ] CSP de produção **sem `unsafe-eval` e sem `unsafe-inline` em `script-src`**.
- [ ] Exceção de `style-src` documentada e justificada.
- [ ] Cookie chegando como `__Host-` + `Secure` + `HttpOnly` + `SameSite=Lax`.
- [ ] Gate fail-closed passando com `HOOKSHADE_ENV=production`.
- [ ] `alembic upgrade head` rodando no start (Procfile).
- [ ] Smoke pós-deploy **verde contra a URL real**.
- [ ] Fluxos confirmados em produção: login, logout, upload `.eml`, RBAC, IDOR, regras, auditoria.
- [ ] Nenhum segredo no Git.
- [ ] README com URLs e limitações honestas.
- [ ] Suíte verde (206 + novos), typecheck, lint, build.

### 4.7 Rollback

**Código:** cada mudança é um commit temático. Reverter = `git revert <sha>`; nenhum
schema é alterado nesta fase, então não há migração para desfazer.

**CSP:** é o risco real de quebrar a UI em produção. Mitigação em duas camadas:
1. Validar a CSP **localmente com build de produção** antes de publicar (`next build && next start`),
   percorrendo todas as rotas com o console aberto.
2. Se ainda assim quebrar em produção, a CSP é controlada por variável de ambiente
   (`CSP_REPORT_ONLY=true`) que a transforma em `Content-Security-Policy-Report-Only`:
   ela passa a **relatar sem bloquear**, restaurando a UI em segundos sem redeploy de código.

**Deploy:** Railway mantém o deployment anterior; rollback = promover o build anterior
pela interface. Documentar o procedimento no README.

**Autenticação:** esta fase **não** altera autenticação. A regra "não publicar mudança de
auth sem plano de rollback" fica satisfeita por não haver mudança de auth.

### 4.8 Ordem de commits (Fase 1)

1. `feat(security): add security headers middleware to api`
2. `feat(security): add csp with per-request nonce to frontend`
3. `feat(config): require hsts and secure cookie in production gate`
4. `test(security): cover headers, csp and production gate`
5. `chore(deploy): railway config, env template and postdeploy smoke`
6. `docs: deploy runbook, public urls and known limitations`

---

## 5. Dependências

| Dependência | De quem | Bloqueia |
|---|---|---|
| Conta Railway + projeto | **Patrick** | Fase 1 parte B |
| Postgres provisionado | Patrick (via Railway) | Fase 1 parte B, Fase 3 |
| Domínio próprio (opcional) | Patrick | HSTS com `includeSubDomains` |
| Provedor de e-mail (Resend/SES) | Patrick | Fase 4 (reset de senha) |
| Conta Sentry | Patrick | Fase 3 |
| Redis | Patrick (Railway addon) | Fase 6 |
| Entra ID / tenant de teste | Patrick ou cliente | Fase 6 (SSO) |
| Empresa de pentest | Patrick (custo) | Fase 6, Fase 9 |
| Advogado / jurídico | Patrick | Fase 7 (o agente só produz minutas) |

---

## 6. Riscos

| Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|
| CSP quebra a UI em produção | **alta** | alto | Validar com build de produção local; `CSP_REPORT_ONLY` como interruptor sem redeploy |
| `style-src 'unsafe-inline'` permanece | certa | baixo | Risco aceito e documentado; estilo não executa código |
| HSTS travar o domínio se algo der errado | média | alto | Começar com `max-age` curto, subir depois de estável; **não** usar `preload` de saída |
| Rate limit em memória com múltiplos workers | alta em prod | médio | Fase 1 roda **1 worker**; Redis na Fase 6 |
| Purga não roda | alta | alto (LGPD) | Fase 3, com alerta em falha |
| Dados corporativos reais antes da Fase 7 | média | **crítico** | **Proibido.** Sem base legal e DPA, não se processa e-mail real de terceiros |
| Deploy expõe segredo | baixa | crítico | Segredos só em variáveis do Railway; gate fail-closed; `.gitignore` conferido |

---

## 7. O que fica fora do escopo (registrado para não voltar por acidente)

Multi-tenancy, `tenant_id`, RLS, billing, planos, marketplace, SCIM, infraestrutura
compartilhada, alta escala global. Recursos ofensivos, execução de anexos, phishing real,
coleta de credenciais — estes últimos, para sempre.

**Nenhuma feature nova de análise** durante as fases de fundação (1 a 3). A tentação de
adicionar detecção nova enquanto a base não é operável é o jeito mais rápido de nunca
terminar o produto.
