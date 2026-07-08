#!/usr/bin/env bash
# Backup lógico do Postgres da Hookshade (pg_dump, formato custom).
#
# Uso:
#   HOOKSHADE_DATABASE_URL="postgres://..." ./db-backup.sh [dir-de-saida]
#   (aceita também DATABASE_URL, o nome que o Railway injeta)
#
# Nunca passe a URL como argumento nem a grave em arquivo — só variável de
# ambiente. O dump NÃO deve ser commitado (contém dados cifrados + usuários).
set -euo pipefail

URL="${HOOKSHADE_DATABASE_URL:-${DATABASE_URL:-}}"
if [ -z "$URL" ]; then
  echo "ERRO: defina HOOKSHADE_DATABASE_URL (ou DATABASE_URL) com a URL do Postgres." >&2
  exit 1
fi
case "$URL" in
  sqlite*)
    echo "ERRO: banco SQLite — backup é cópia do arquivo .db com o app parado (ver runbook)." >&2
    exit 2
    ;;
esac

OUT_DIR="${1:-./backups}"
mkdir -p "$OUT_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$OUT_DIR/hookshade-$STAMP.dump"

pg_dump --format=custom --no-owner --no-privileges --file "$OUT" "$URL"

echo "Backup gerado: $OUT"
ls -lh "$OUT"
