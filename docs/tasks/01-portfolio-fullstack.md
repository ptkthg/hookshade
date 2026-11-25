# Spec 01: hookshade pronto para portfólio full stack

**Implementador:** Codex. **Revisor:** Claude. **Leia antes:** `AGENTS.md`, `README.md`, `backend/app/{deps,security,models,seed,ratelimit,main}.py`,
`backend/app/routers/*`, `frontend/lib/{api,auth}.ts`, `frontend/app/*`, `.github/workflows/*`, `render.yaml`.

## Linha de base (24/11/2026)
Backend: **221 testes** pytest passando. Frontend: `tsc` e `eslint` limpos, `build` ok, **nenhum teste**. Sem Docker.
O pipeline de análise **não faz chamadas de rede externas** (mantenha assim). Papéis atuais: `analyst` e `admin`
(`require_role` em `deps.py`). Amostras: `backend/tests/fixtures/{phishing,benign}.eml`.
Produção: front na Vercel (hookshade.vercel.app), API no Render free tier (dorme; cold start de ~1 min), banco no Neon.

## 1. Perfil demo somente leitura
- Novo papel `demo` no RBAC. O usuário demo é criado pelo seed (e-mail `demo@hookshade.example`), com senha vinda de
  variável de ambiente (`DEMO_PASSWORD`); se a variável não existir, o demo fica desligado.
- Endpoint `POST /auth/demo` (ou equivalente) que faz login como demo **sem senha digitada pelo visitante**, só quando
  `DEMO_ENABLED=true`. Mesmo cookie, CSRF e expiração dos outros logins; rate limit próprio e mais restritivo.
- O demo **vê** as análises seed (3 a 5 e-mails fictícios de phishing e benignos, criados pelo seed, com IOCs,
  SPF/DKIM/DMARC e score variados) e as regras, mas **qualquer escrita retorna 403**: criar/excluir análise, upload,
  texto colado, CRUD de regras, teste de regra com texto livre, usuários, auditoria de outros.
- "Testar com amostra": endpoint que roda o pipeline numa das amostras **do projeto** (escolhida por ID, nunca texto do
  visitante) e devolve o resultado **sem persistir**. Disponível para todos os papéis.
- Testes pytest: matriz de rotas de escrita × papel demo → 403; login demo desligado sem `DEMO_ENABLED`; amostra não
  grava nada (contagem de linhas antes/depois).

## 2. Revogação de JWT
`token_version` no usuário (migração Alembic). Entra no JWT; o logout, a troca de senha e o bloqueio incrementam; token
com versão antiga → 401. Testes: token antigo rejeitado após logout e após troca de senha. Atualize a lista de
limitações do README.

## 3. Frontend
- Vitest + React Testing Library + MSW (mock da API). Testes mínimos:
  - login: sucesso, erro, conta bloqueada e botão **"Entrar como demo"**, que só aparece quando a API informa que o demo está ligado;
  - nova análise (upload e texto) e o estado "somente leitura" para o demo (formulário desabilitado com aviso, botão
    "Testar com amostra" disponível);
  - resultado: score, evidências e IOCs renderizados;
  - regras: validação do editor e ações de escrita ocultas para o demo;
  - guarda de rotas por papel (usuários e auditoria só para admin).
- **Cold start:** se o `/health` não responder em ~3 s, mostrar "API acordando (plano gratuito do Render)…" com
  tentativa automática, em vez de erro. Teste com MSW atrasando a resposta.
- Faixa discreta no topo para o demo: "Demonstração · dados fictícios · somente leitura".
- `npm test` no workflow do frontend.

## 4. Docker e E2E
- `backend/Dockerfile`, `frontend/Dockerfile` (multi-stage, usuário não root) e `docker-compose.yml` na raiz:
  postgres + api (migra e roda o seed na subida) + web. `docker compose up --build` deixa o app em http://localhost:3000.
  `.env.example` na raiz com todas as variáveis e valores de desenvolvimento óbvios.
- Playwright em `e2e/` contra o compose: login como demo → abrir uma análise seed → ver score e IOCs → "Testar com
  amostra" → confirmar 403 ao tentar escrita pela API com o cookie do demo → logout e conferir que o cookie antigo
  não acessa mais (revogação).
- Workflow `e2e.yml` no CI: sobe o compose, espera a saúde, roda o Playwright, publica o relatório como artefato.

## 5. Cabeçalhos do front
Conferir os cabeçalhos de segurança do Next.js em produção (`next.config.ts` ou `proxy.ts`): CSP, `X-Frame-Options`/
`frame-ancestors`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`. Ajustar o que faltar sem quebrar
o app (o front chama a API do Render: inclua-a no `connect-src`). Registrar a política final no resultado.

## 6. README para recrutador
Reescrever o `README.md` (pt-BR, com resumo de 2 frases em inglês no topo):
- o que o app faz, com o fluxo de uma análise;
- link da demo e aviso de cold start;
- capturas reais em `docs/img/` (gere com Playwright a partir do compose: login, nova análise, resultado, regras);
- diagrama de arquitetura (mermaid): Next.js na Vercel → FastAPI no Render → Postgres no Neon;
- tabela "controle de segurança → onde está no código → teste que o cobre";
- como rodar (`docker compose up --build`) e os comandos de teste, com os **números reais** de testes;
- limitações honestas (rate limit em memória, purga de retenção sem agendamento, free tier).
Remover menções ao Railway em `README.md`, `docs/operations/*` e `scripts/db-backup.sh` (o deploy atual é Vercel + Render + Neon).

## Critérios de aceite
- Backend `pytest`, frontend `tsc`/`lint`/`test`/`build` e Playwright via compose passando, com as saídas no resultado.
- Nenhum segredo real nem dado pessoal real nos arquivos. Nenhuma chamada de rede externa nova no pipeline.
- Resultado em `docs/tasks/01-resultado.md`, incluindo como criar o demo em produção (variáveis no Render e comando de seed).
- Não faça commit nem push.
