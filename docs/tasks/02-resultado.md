# Resultado da spec 02 — logout do demo

## Implementação

- O logout do papel `demo` remove somente o cookie local e mantém `token_version`.
  Dois visitantes autenticados continuam independentes ao sair. O CSRF continua
  obrigatório e seu cookie é mantido, como antes.
- `DEMO_SESSION_MINUTES` define a validade própria do JWT e do cookie demo:
  padrão 30 minutos, inteiro positivo. Aplicado tanto a `/api/v1/auth/demo` quanto
  ao login comum de uma conta demo. Documentado nos dois `.env.example`.
- A auditoria dos incrementos de versão encontrou também o lockout por senha errada:
  para demo, mantém contador, auditoria e bloqueio temporário de novos logins, sem
  incrementar a versão nem revogar sessões de visitantes já autenticados.
- Logout, troca de senha e lockout de `analyst` e `admin` continuam revogando tokens.
  Os endpoints administrativos de papel/status/senha exigem admin; o demo não pode
  dispará-los. A rotação de senha demo pelo seed continua revogando sessões, pois
  é uma ação do operador, não do visitante.
- Seed analyst fictício `e2e-analyst@example.com`, com senha pública de teste
  `e2e-only-analyst-placeholder`: opt-in por `HOOKSHADE_E2E_SEED_ENABLED`, desligado
  por padrão e ignorado em produção mesmo se habilitado. Compose habilita a opção
  somente no ambiente local/E2E. Seed idempotente, sem alterar contas existentes.
- Playwright verifica limpeza do cookie pelo botão “Sair” para demo. A recusa de
  cookie antigo após logout usa o analyst do seed. O teste reutiliza o CSRF emitido
  à página, evitando desalinhar o cookie com o token em memória da interface.
- README atualizado em segurança e limitações; corrigido o item “Revogação por
  conta” do resultado da spec 01. Mudanças preexistentes preservadas. Sem commit,
  push ou deploy; workflows e referências de actions não foram alterados nesta tarefa.

## Testes e verificações

Primeiro foi reproduzida a regressão: o teste de dois visitantes recebeu 401 no
segundo visitante após o logout do primeiro. Antes da implementação, a nova suíte
registrou `8 failed, 2 passed`; depois, com cobertura adicional para contas comuns:

```text
pytest tests/test_demo_sessions.py -q -p no:cacheprovider
14 passed, 1 warning in 18.46s

npm ci --cache .npm-cache (frontend)
added 474 packages; found 0 vulnerabilities
npx tsc --noEmit: exit 0
npm run lint: exit 0
npm test: 1 arquivo, 18 testes passando
npm run build: exit 0; compilação, TypeScript e geração de páginas concluídos

npm ci --cache .npm-cache (e2e)
added 3 packages; found 0 vulnerabilities
npm test (Playwright): 2 passed (6.8s)
git diff --check: exit 0
```

Cobertura nova: dois clientes demo, cookie removido e versão preservada; expiração
real validada pelo decodificador JWT com relógio avançado, nos dois logins demo;
Max-Age coerente; default/variável/valor inválido da duração; lockout demo sem
incremento; duração comum independente da demo; revogação por logout, troca de
senha e lockout para analyst/admin; seed opt-in, idempotente e recusado em produção.
Os testes anteriores de desativação/reativação e da matriz RBAC foram mantidos.

A suíte completa do backend passou com temporários e cache locais:

```text
cd backend
.venv/Scripts/python.exe -m pytest -q \
  --basetemp=D:/estudos/hookshade/.local-test/pytest-spec02 \
  -o cache_dir=D:/estudos/hookshade/.local-test/pytest-cache-spec02
266 passed, 2 warnings in 156.67s (0:02:36)
```

Revisão final de correção, simplicidade, segurança e escopo concluída: logout mantém
a atualização atômica de versão para contas comuns, a exceção usa o papel persistido
no banco e os atributos de cookie/validação CSRF permanecem preservados. Nenhuma
dependência nova foi introduzida.

## Desvios e limitações do ambiente

- A primeira suíte completa registrou `258 passed, 4 errors`: os quatro erros foram
  no setup dos testes de migração, por `PermissionError` em
  `<TEMP>/pytest-of-<usuario>`. Também houve avisos de acesso ao cache pytest.
  A repetição usa `--basetemp` e `cache_dir` dentro de `.local-test/`, sem alterar testes.
- `npm ci` inicialmente falhou por EPERM no cache global fora do workspace.
  Resolvido usando `.npm-cache/` local, já ignorado pelo Git.
- Docker Compose não executou: `permission denied while trying to connect to the
  docker API at npipe:////./pipe/docker_engine`. Portanto não se afirma validação
  runtime de Compose/Postgres. Playwright executou contra Uvicorn local com SQLite
  descartável `backend/spec02-e2e.db`, seed E2E habilitado e frontend de produção
  pelo artefato `.next/standalone/server.js`, com assets copiados conforme o Dockerfile.
  Bancos, caches, assets de build e relatórios Playwright são ignorados pelo Git.
- A aprovação automática rejeitou `npm run start -- --hostname 127.0.0.1 --port 3000`,
  sem motivo adicional. A execução do artefato standalone foi aceita e utilizada.
- Avisos remanescentes: deprecações Starlette (`httpx` no TestClient e alias HTTP 422),
  script de instalação `unrs-resolver` não aprovado pelo npm e conflito de cores
  `NO_COLOR`/`FORCE_COLOR` do Playwright. Nenhum impediu as verificações finais.
- Por decisão explícita da spec, uma cópia do JWT demo permanece utilizável após
  logout até sua expiração; a validade curta limita essa janela. Não foi criado um
  sistema de sessões individuais. Rate limit, CSRF, cookies `__Host-`, bcrypt,
  redação de PII, headers e proteção contra ReDoS mantêm seus testes existentes.

Para repetir a validação pendente em ambiente com Docker acessível:

```bash
docker compose up --build --wait --wait-timeout 240
cd e2e
npm ci
npx playwright install --with-deps chromium
npm test
```
