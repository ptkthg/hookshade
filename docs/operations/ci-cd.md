# CI/CD e processo de deploy

**Objetivo:** impedir que código quebrado chegue à produção.
**Responsável:** quem abre o PR.

---

## O problema que isto resolve

Antes desta fase, o Render fazia **auto-deploy a cada push**. Não havia CI. Ou seja:
qualquer commit ia direto para produção sem passar por nada, e os 221 testes verdes não
impediam absolutamente nada — eles só rodavam quando alguém lembrava de rodar.

## Por que não há branch protection

Branch protection e rulesets **não existem em repositório privado no plano gratuito** do
GitHub (a API responde `403: Upgrade to GitHub Pro`). Alternativas seriam tornar o repo
público ou assinar o Pro.

**Decisão:** manter o repo privado e mover o portão para o outro lado — **o Render não
publica mais sozinho**. Produção só muda por um ato deliberado, depois do CI verde.

**Limitação honesta:** não há barreira *técnica* contra force-push ou contra alguém
mergear com CI vermelho. A barreira é o processo abaixo, e o fato de o deploy ser manual.
Se o projeto ganhar mais de um committer, isto precisa virar branch protection de verdade.

---

## Workflows

| Workflow | Job | O que garante |
|---|---|---|
| `backend-ci` | `test` | Postgres 17 **efêmero** (o Neon de produção nunca é tocado); `alembic heads` exige **1 head**; `alembic upgrade head` em banco **vazio** (o mesmo que o Procfile faz no deploy); `alembic check` pega modelo alterado sem migration; `pytest` |
| | `hygiene` | nenhum `.env`, banco, dump ou chave privada versionado |
| `frontend-ci` | `verify` | `npm ci` (falha se o lockfile divergir), typecheck, lint, build **sem segredo**, e — específico da nossa arquitetura — **nenhuma URL de backend no bundle do cliente** (se ela vazar, a CSP e o proxy same-origin perdem o sentido, e o build passaria calado) |
| `security-ci` | `secrets scanning` | Gitleaks com **histórico completo** (segredo commitado e depois "removido" continua no histórico) |
| | `SAST (python)` | Bandit (`-ll`: médio/alto) |
| | `dependências vulneráveis` | `pip-audit --strict` e `npm audit --audit-level=high` |

Nenhum workflow acessa produção. Nenhum consome segredo.

---

## Processo de mudança

```
1. branch de trabalho          git switch -c feat/minha-mudanca
2. commits temáticos
3. push                        → CI roda automaticamente
4. Pull Request para main      gh pr create --base main
5. CI verde                    → só então mergear
6. merge                       gh pr merge --squash
7. DEPLOY (manual, deliberado):
     backend  → Render: Manual Deploy → Deploy latest commit
     frontend → cd frontend && npx vercel deploy --prod
8. SMOKE contra produção       (ver abaixo) — deploy só está feito quando passa
9. falhou? ROLLBACK            (ver docs/operations/rollback.md)
```

**Backend e frontend precisam ser publicados juntos** quando a mudança cruza o contrato da
API. O Render publica só quando mandam; a Vercel também. Se subir um e esquecer o outro,
eles divergem — e a falha aparece como um erro estranho na UI, não como um erro de deploy.

## Smoke pós-deploy

```bash
cd scripts && npm install
HOOKSHADE_FRONTEND_URL=https://hookshade.vercel.app \
HOOKSHADE_API_URL=https://hookshade-api.onrender.com \
HOOKSHADE_ADMIN_EMAIL=<admin> HOOKSHADE_ADMIN_PASSWORD=<senha> \
node postdeploy-smoke.cjs
```

> O free tier do Render **dorme após 15 min**. Acorde a API antes (`curl .../health`),
> senão o smoke falha por timeout — o que parece defeito e não é.

---

## Sinais de sucesso

- Os 3 workflows verdes no commit.
- Smoke 37/37 depois do deploy.

## Sinais de falha

| Sintoma | Significado |
|---|---|
| `alembic heads` retorna > 1 | duas migrations divergiram; vão colidir no deploy |
| `alembic check` falha | modelo mudou sem migration gerada |
| grep acha `onrender.com` em `.next/static` | a URL do backend vazou para o navegador |
| Gitleaks vermelho | segredo no código **ou no histórico** |
| Smoke falha no login | pode ser só cold start; acorde a API e repita antes de concluir que quebrou |

## Cuidados com dados e segredos

- Os workflows de CI **não recebem segredo nenhum** e usam banco efêmero.
- Nunca colocar `HOOKSHADE_DATABASE_URL` de produção em um job de CI.
- Nenhum log de workflow deve ecoar variável de ambiente.
