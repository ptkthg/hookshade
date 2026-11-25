# Resultado — spec 01: portfólio full stack

Implementação em 24–25/11/2026, seguindo `AGENTS.md`. Sem commit, push ou deploy.
Os arquivos `AGENTS.md`, a spec e `01-resultado-codex.md` já estavam presentes e foram preservados.

**Estado:** funcionalidades implementadas; validação local de backend, frontend e navegador
executada. O aceite de Docker/Playwright **via Compose/Postgres permanece pendente**, porque
este ambiente nega acesso ao Docker engine. As capturas são reais, mas foram feitas com
Next em produção + API local e SQLite descartável, não com Compose.

## Implementação

- **Demo opt-in:** `DEMO_PASSWORD` vem exclusivamente do ambiente; sem ela o demo fica
  desligado. `DEMO_ENABLED=true` habilita `POST /api/v1/auth/demo`. A disponibilidade é
  informada por `GET /api/v1/auth/config`. O login usa os mesmos cookies, CSRF e prazo de
  sessão do login comum, com limite independente de **3 requisições/IP/minuto**.
- **Seed idempotente:** cria `demo@hookshade.example`, uma regra demonstrativa e quatro
  mensagens de `app/samples.py`, com scores, IOCs e SPF/DKIM/DMARC variados. Usa o mesmo
  pipeline offline e cifra o conteúdo ao persistir. Não sobrescreve regras já existentes.
- **RBAC:** demo só lê suas análises seed e regras; upload, texto, exclusão, mutações/teste
  livre de regras e administração são negados. Usuários e auditoria global exigem admin.
  Na revisão final, testes adicionais reproduziram o acesso indevido da auditoria por
  analyst/viewer; a dependência foi restringida a admin.
- **Amostras:** `POST /api/v1/analyses/samples/{sample_id}` aceita somente IDs do catálogo
  fechado (`phishing`, `benign`, `invoice`, `notice`). Roda o pipeline sem gravar análise,
  IOCs, findings, recomendações ou auditoria; ID desconhecido retorna `404`.
  A resposta transitória usa `id=0` e `source_type=sample`; a interface mostra o resultado
  na própria página, sem navegar para um resultado inexistente.
- **Revogação:** `users.token_version`, migração reversível `92cb401a0001`, claim `ver`
  obrigatório no JWT e comparação com o banco. Logout, troca de senha, lockout,
  desativação e mudança de papel invalidam tokens antigos. Logout permanece idempotente.
- **Frontend:** Vitest/RTL/MSW; acesso demo, faixa de dados fictícios, formulário desabilitado
  por `fieldset` no demo, amostras disponíveis e guardas administrativas. Após 3 segundos
  aguardando `/health`, informa “API acordando (plano gratuito do Render)…”. O proxy
  `/api/health` tem destino fixo, timeout e resposta opaca; falhas são repetidas após 2 s.
  Mutações não são repetidas automaticamente.
- **Infraestrutura:** Dockerfiles multi-stage com usuário UID 10001, saída standalone do
  Next, Compose com Postgres 17, dependências por saúde, migração e seed na subida.
  `.env.example` contém apenas placeholders públicos; `.env` opcional não é versionado.
- **E2E/CI:** Playwright cobre demo → seed → score/IOCs → amostra → `403` com cookie e
  CSRF válidos → logout → cookie antigo rejeitado com `401`. Também confere headers e
  ausência de erros de CSP/JavaScript. `e2e.yml` sobe Compose, espera saúde e publica
  relatório/capturas. `frontend-ci` executa `npm test`; actions de todos os workflows
  foram fixadas em SHAs de commit e conferidas na API oficial do GitHub.
- **Documentação:** README reescrito em pt-BR com duas frases em inglês, fluxo, demo,
  screenshots, Mermaid, matriz de segurança, comandos e limitações. Removidas menções
  ao provedor antigo nos arquivos solicitados. Runbooks de deploy, CI e rollback atualizados.
- **Dependências:** npm audit encontrou achados altos/críticos no Next 16.2.10 original.
  Atualizados Next e eslint-config-next para 16.4.6 e transitivas corrigíveis sem `--force`.
  Auditoria final: **zero vulnerabilidades**, registrada em `01-npm-audit.json`.

## Verificações e saídas

| Verificação | Resultado |
|---|---|
| Backend `python -m pytest -q` | `252 passed, 2 warnings in 136.25s (0:02:16)` |
| Alembic em banco descartável | `92cb401a0001 (head)`; `No new upgrade operations detected.` |
| Frontend `npm ci` | 474 pacotes instalados; `found 0 vulnerabilities` |
| `npx tsc --noEmit` | exit 0, sem erros |
| `npm run lint` | exit 0, sem erros |
| `npm test` (Vitest) | `18 passed (18)` |
| `npm run build` | Next.js 16.4.6; compilação e TypeScript concluídos; rotas dinâmicas e Proxy gerados |
| URL de API em `.next/static` | `OK: nenhuma URL de backend no bundle do navegador` |
| `npm audit --audit-level=high` | `found 0 vulnerabilities` |
| E2E `npm ci` | `found 0 vulnerabilities` |
| Playwright contra Next standalone + API/SQLite | `1 passed (5.4s)` |
| `docker compose config --quiet` | exit 0; aviso de leitura negada do config pessoal do Docker |
| `docker compose up --build --wait --wait-timeout 240` | Falhou por acesso negado ao engine; imagens não construídas neste ambiente |
| `git diff --check` | exit 0; somente avisos de conversão LF/CRLF do Git no Windows |

O backend foi executado com Python 3.14 em `.venv` isolado e o frontend com Node 24.
Os testes de migração verificam banco vazio, seed, usuário preexistente com versão 0 e downgrade.
As suítes existentes de bcrypt, CSRF, cookies `__Host-`, bloqueio, rate limit, PII, headers e
ReDoS foram mantidas. A primeira rodada dos testes de demo/revogação falhou nas
funcionalidades ausentes antes da implementação; os testes de autorização adicionais
também reproduziram `200` indevido antes da restrição da auditoria.

Saída final das suítes:

```text
Backend:   252 passed, 2 warnings in 136.25s (0:02:16)
Vitest:    Test Files  1 passed (1)
           Tests       18 passed (18)
Playwright: 1 passed (5.4s)
Alembic:   92cb401a0001 (head)
           No new upgrade operations detected.
npm audit: found 0 vulnerabilities
```

Avisos observados: Starlette recomenda migrar o TestClient para `httpx2` e renomear o alias
de status 422; npm informou script de instalação não aprovado de `unrs-resolver` sem impedir
instalação/build/lint; Playwright informou conflito de variáveis `NO_COLOR`/`FORCE_COLOR`.
Nenhum desses avisos foi ocultado por configuração de teste.

## Capturas e navegador

`docs/img/{login,nova-analise,resultado,regras}.png` foram gerados com
`CAPTURE_DOCS=true npm test` em `e2e/`, com resolução 1440×1000, e inspecionados visualmente.
O resultado mostra uma mensagem fictícia com score 65, SPF/DKIM/DMARC fail, URL mascarada,
regra disparada e IOCs defanged. O frontend foi executado também pelo artefato
`node .next/standalone/server.js`, com os assets estáticos copiados como no Dockerfile.
Não houve acesso a banco ou contas de produção.

Para reproduzir o aceite ainda pendente em um ambiente com Docker acessível:

```bash
docker compose up --build --wait --wait-timeout 240
cd e2e
npm ci
npx playwright install --with-deps chromium
CAPTURE_DOCS=true npm test
```

A falha concreta local foi:

```text
permission denied while trying to connect to the docker API at npipe:////./pipe/docker_engine
```

O workflow implementa essa execução contra Postgres no runner, mas não foi disparado:
nenhum commit ou push foi realizado. Portanto não se afirma CI verde nem imagens Docker
validadas em runtime. A ausência do engine não foi contornada por elevação de privilégios.

## Política final de cabeçalhos

Produção (`frontend/proxy.ts`), com nonce novo por resposta:

```text
default-src 'self';
script-src 'self' 'nonce-<por-requisição>' 'strict-dynamic';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
font-src 'self';
connect-src 'self' https://hookshade-api.onrender.com;
frame-ancestors 'none';
object-src 'none';
base-uri 'self';
form-action 'self';
upgrade-insecure-requests
```

Scripts de produção continuam sem `unsafe-inline`/`unsafe-eval`; estilos inline são
mantidos porque a interface existente usa atributos `style` do React. O navegador usa
o proxy same-origin; a origem do Render também consta explicitamente em `connect-src`.
`next.config.ts` mantém `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: no-referrer`, `Permissions-Policy: camera=(), microphone=(), geolocation=(),
payment=(), usb=()` e HSTS `max-age=31536000; includeSubDomains` em produção.

Headers foram conferidos no Next local em modo produção; não foi feito deploy nem
se atribuem estes resultados ao domínio publicado. Uma inicialização com exceção CSP
para HTTP local foi rejeitada pela política automática, sem justificativa adicional.
A exceção foi removida; a validação passou usando a CSP padrão de produção.

## Criar o demo em produção

1. No serviço da API no Render, mantenha os segredos fortes `HOOKSHADE_*`, cookie Secure,
   HSTS, CORS da Vercel e conexão Neon existentes.
2. Configure `DEMO_ENABLED=true` e `DEMO_PASSWORD` com senha forte e exclusiva no painel
   de segredos. Não use o placeholder local e não divulgue a senha aos visitantes.
3. Em `backend`, com as variáveis do serviço, execute:

   ```bash
   alembic upgrade head
   python -m app.seed
   ```

   O start atualizado em `render.yaml` já executa esses comandos antes do Uvicorn.
4. Publique backend/frontend pelo processo operacional existente e verifique
   `/api/v1/auth/config`, o botão demo e o fluxo de leitura. Nenhum deploy foi feito nesta tarefa.

Sem `DEMO_PASSWORD`, o seed não cria o demo e a API não o habilita. Mudar a senha e rodar
o seed novamente invalida sessões demo existentes. Para desligar, use `DEMO_ENABLED=false`
e reinicie/reimplante a API para carregar a configuração.

## Desvios, decisões e limites

- **Compose/Postgres:** validação de configuração feita, build/runtime bloqueados pelo
  Docker engine. Playwright e screenshots locais usaram SQLite descartável; devem ser
  repetidos pelo workflow ou em Docker antes de considerar o aceite integral concluído.
- **Revogação por conta (corrigida na spec 02):** contas comuns continuam revogando todas
  as sessões por `token_version`. O logout demo só limpa o cookie local, preservando os
  outros visitantes; o JWT demo expira em `DEMO_SESSION_MINUTES` (padrão 30 minutos).
  Uma cópia do JWT demo pode ser reutilizada até expirar. Lockout demo não incrementa a
  versão; ações administrativas e rotação de senha pelo seed continuam revogando sessões.
  Detalhes e validação em [02-resultado.md](02-resultado.md).
- **Demo gerenciado pelo seed:** o papel demo não é disponibilizado como promoção no
  formulário administrativo. Regras seed só são criadas se não houver a regra demonstrativa;
  alterações administrativas existentes são preservadas.
- **Sem rede no pipeline:** `backend/app/analysis/` não ganhou clientes HTTP/DNS; os únicos
  usos de urllib são `urllib.parse`. As novas chamadas HTTP ficam no proxy/saúde ou tooling.
- Rate limit continua em memória por processo; purga de retenção continua sem scheduler;
  cold start/free tier, backup automático e monitoramento continuam limitações operacionais.
- Arquivos temporários, caches, bancos e relatórios de execução ficam ignorados. Somente
  dados de exemplo fictícios foram criados; nenhum segredo real foi registrado.

## Referências usadas

- [Vitest](https://vitest.dev/guide/) e [MSW Node](https://mswjs.io/guides/integrations/node),
  com as tipagens instaladas do MSW 3 (`onUnhandledFrame`).
- [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting) e
  [Playwright APIRequestContext](https://playwright.dev/docs/api/class-apirequestcontext).
- Consultas à API do GitHub e SHAs verificados em `01-actions-verificados.json`;
  reprodução: `node scripts/verify-action-refs.mjs` na raiz.
- Modern Web Guidance, guia `forms`: aplicado `fieldset`/`legend`, labels associados e
  botões auxiliares com `type=button`, seguindo “explicitly set `type="button"` on secondary
  or helper buttons”. Evita submit acidental ao entrar como demo ou testar uma amostra.
