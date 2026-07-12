# Rollback

**Objetivo:** voltar a produção ao último estado bom, rápido, sem improviso.
**Responsável:** quem publicou.

> Antes de reverter, pergunte-se: **o problema é do deploy ou do ambiente?** O free tier
> do Render dorme após 15 min — uma primeira requisição lenta (~50s) **não** é regressão.
> Acorde a API (`curl https://hookshade-api.onrender.com/health`) e repita antes de agir.

---

## 1. Backend quebrado (Render)

**Sintoma:** `/health` não responde, ou o smoke falha em rotas de API.

1. Painel do Render → serviço `hookshade-api` → **Deploys**.
2. Localize o último deploy verde (o anterior ao problema).
3. **Rollback** (ou `Manual Deploy → Deploy a specific commit` e escolha o commit anterior).

**Migration não precisa ser desfeita** — nenhuma fase até aqui altera schema. Se um dia
alterar: reverter o código **não** reverte a migration. Aí o rollback exige `alembic
downgrade`, e isso tem que estar planejado **antes** de subir a migration, nunca depois.

**Se a migration falhou no deploy:** não há o que reverter. O start encadeia
`alembic upgrade head && uvicorn` — se a migration falha, o processo **não sobe** e o deploy
anterior continua servindo. É falha segura por construção.

## 2. Frontend quebrado (Vercel)

**Sintoma:** página em branco, botões inertes, erro de console.

```bash
npx vercel rollback --scope ptkthgs-projects
```

Ou pelo painel: projeto `hookshade` → **Deployments** → o anterior → **Promote to Production**.

## 3. CSP quebrou a UI

**Sintoma:** página em branco e console cheio de `Refused to execute inline script`.

**Não precisa reverter código.** Na Vercel, defina `CSP_REPORT_ONLY=true` e redeploy: a
política vira `Content-Security-Policy-Report-Only`, passa a **relatar sem bloquear**, e a
UI volta. Investigue as violações relatadas, corrija, remova a variável.

## 4. Segredo comprometido

- **`HOOKSHADE_SECRET_KEY`** — rotacione no Render. Derruba **todas** as sessões, que é
  exatamente o efeito desejado. Sem outros efeitos colaterais.
- **`HOOKSHADE_ENCRYPTION_KEY`** — ⚠️ **não rotacione.** Hoje não há versionamento de chave
  nem re-cifra: trocá-la torna **todo o histórico ilegível**, de forma irreversível. Se ela
  vazou, é um incidente que exige plano de re-cifra (Fase 6), não uma troca de variável.

## 5. Purga apagou o que não devia

**Não existe rollback.** Dado apagado não volta.

A única recuperação é o **restore de backup** (`docs/operations/backup-restore.md`), e ele
só existe se o backup tiver sido feito **e comprovado** antes. É por isso que o cron da
purga só é ativado depois do bloco de backup, e nunca antes.

---

## Depois de qualquer rollback

1. Rode o smoke e confirme que produção voltou (37/37).
2. Registre o que aconteceu e por quê.
3. Só então investigue a causa — com produção já estável, não sob pressão.
