# Runbook — Backup e restore do banco (Hookshade)

> **Backup sem restore testado é teatro operacional.** Um dump que nunca foi restaurado
> não é um backup — é um arquivo com esperança dentro. Este runbook só está "cumprido"
> quando o restore foi executado e validado, e isso está registrado abaixo.

## O que é protegido

O Postgres contém: usuários (hash bcrypt), análises (`raw_content` **cifrado** com a
`HOOKSHADE_ENCRYPTION_KEY`), IOCs/findings/recomendações, regras + histórico e auditoria.

⚠️ **O backup do banco sem a `HOOKSHADE_ENCRYPTION_KEY` é irrecuperável na parte cifrada.**
Guarde a chave em um gerenciador de segredos separado do dump (nunca no mesmo lugar,
nunca no repo). Perder a chave = perder o histórico de `raw_content`; vazar chave+dump
juntos = vazar tudo.

## Backup (Postgres — Neon)

```bash
# do seu terminal, com a URL do Postgres de produção:
HOOKSHADE_DATABASE_URL="postgres://..." ./scripts/db-backup.sh ./backups
```

- Gera `backups/hookshade-<timestampUTC>.dump` (formato custom do pg_dump).
- Precisa do cliente Postgres (`pg_dump`). Sem ele instalado localmente, rode via Docker:
  `docker run --rm -v "$PWD/backups:/backups" postgres:16 pg_dump --format=custom --no-owner -f /backups/hookshade-$(date -u +%Y%m%dT%H%M%SZ).dump "$URL"`
- **Nunca** commite dumps (`backups/` está no .gitignore) e **nunca** deixe a URL em arquivo.
- Neon: confirme a retenção de recuperação do plano contratado; trate-a como camada extra,
  sem substituir o dump lógico que você controla e testa.

### Periodicidade recomendada

| Ação | Frequência |
|---|---|
| Dump lógico (`db-backup.sh`) | diária (automatize; guarde 7 diárias + 4 semanais) |
| Cópia offsite (fora do host do banco) | a cada dump |
| **Teste de restore** | mensal, e sempre antes de migração de schema arriscada |

## Restore (sempre em banco NOVO, nunca por cima de produção)

```bash
# 1. crie um banco vazio (novo serviço Postgres, ou CREATE DATABASE hookshade_restore)
# 2. restaure apontando para ele — a variável é separada DE PROPÓSITO:
RESTORE_DATABASE_URL="postgres://...banco-novo..." ./scripts/db-restore.sh backups/hookshade-XXXX.dump
```

O script valida automaticamente: `alembic_version` (deve bater com `python -m alembic heads`
no repo) e contagens de `users`, `analyses`, `audit_logs`, `detection_rules`.

**Validação funcional final:** aponte um backend local para o banco restaurado
(`HOOKSHADE_DATABASE_URL=...`) e faça login + abra uma análise antiga (prova que a
`ENCRYPTION_KEY` decifra o conteúdo restaurado).

**Promoção (disaster recovery):** só depois da validação, troque a `HOOKSHADE_DATABASE_URL`
do serviço web para o banco restaurado e redeploy. Nunca o inverso.

## SQLite (apenas dev)

Backup = copiar o arquivo `backend/hookshade.db` **com o app parado**. Restore = copiar de
volta. Não use SQLite além de dev/teste.

## Registro de testes de restore

| Data | Quem | Procedimento | Resultado |
|---|---|---|---|
| 2026-07-07 | Claude (assistido) | Postgres 16 em Docker local. Origem: `alembic upgrade head` + seed user + análise cifrada. `db-backup.sh` → dump 26K → `db-restore.sh` em banco novo (`hookshade_restore`). Validação: `alembic_version=f08dcac4679c` (== head do repo), contagens batendo (1 user, 1 analysis), `verify_password` da credencial seed OK e `decrypt()` do `raw_content` restaurado OK com a mesma `ENCRYPTION_KEY`. Container descartado ao final. | ✅ |

> Pendente: repetir este teste em uma branch descartável do Neon, sem sobrescrever produção.
> O registro acima é histórico; o head atual inclui `92cb401a0001` (`token_version`).
