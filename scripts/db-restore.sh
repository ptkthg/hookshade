#!/usr/bin/env bash
# Restaura um dump da Hookshade em um banco ALVO EXPLÍCITO e valida o resultado.
#
# Uso:
#   RESTORE_DATABASE_URL="postgres://...banco-NOVO..." ./db-restore.sh caminho/do/arquivo.dump
#
# Segurança operacional:
#   - O alvo vem SÓ de RESTORE_DATABASE_URL — nunca de HOOKSHADE_DATABASE_URL/DATABASE_URL,
#     para impossibilitar restaurar por cima de produção por descuido.
#   - Restaure sempre num banco novo/vazio; valide; só então promova (troque a URL do app).
set -euo pipefail

DUMP="${1:-}"
TARGET="${RESTORE_DATABASE_URL:-}"

if [ -z "$DUMP" ] || [ ! -f "$DUMP" ]; then
  echo "ERRO: informe o arquivo de dump. Uso: RESTORE_DATABASE_URL=... ./db-restore.sh arquivo.dump" >&2
  exit 1
fi
if [ -z "$TARGET" ]; then
  echo "ERRO: defina RESTORE_DATABASE_URL com a URL do banco ALVO (novo/vazio)." >&2
  echo "      (variável separada de propósito — restore nunca assume a URL de produção)" >&2
  exit 1
fi

pg_restore --no-owner --no-privileges --exit-on-error --dbname "$TARGET" "$DUMP"

echo "--- Validação pós-restore ---"
psql "$TARGET" --no-psqlrc --tuples-only \
  -c "SELECT 'alembic_version: ' || version_num FROM alembic_version;" \
  -c "SELECT 'users: ' || count(*) FROM users;" \
  -c "SELECT 'analyses: ' || count(*) FROM analyses;" \
  -c "SELECT 'audit_logs: ' || count(*) FROM audit_logs;" \
  -c "SELECT 'detection_rules: ' || count(*) FROM detection_rules;"

echo "Restore concluído. Confira se alembic_version bate com o head do repo"
echo "(backend: python -m alembic heads) e se as contagens fazem sentido."
