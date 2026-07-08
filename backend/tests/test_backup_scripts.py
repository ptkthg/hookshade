"""Scripts de backup/restore (Fase 1 / Bloco 2) — contrato estático.

Não executa pg_dump (indisponível no CI/dev); garante o contrato de segurança:
scripts existem, falham cedo (set -euo pipefail), dependem de variáveis de
ambiente, exigem alvo EXPLÍCITO no restore, validam pós-restore e não contêm
credencial hardcoded.
"""
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
BACKUP = REPO_ROOT / "scripts" / "db-backup.sh"
RESTORE = REPO_ROOT / "scripts" / "db-restore.sh"

# URL com senha embutida que NÃO venha de variável (ex.: postgres://user:senha@host)
_HARDCODED_CRED = re.compile(r"postgres(?:ql)?://[^$\s\"']*:[^$\s\"'@]+@")


def test_backup_script_exists_and_fails_fast():
    text = BACKUP.read_text(encoding="utf-8")
    assert "set -euo pipefail" in text


def test_restore_script_exists_and_fails_fast():
    text = RESTORE.read_text(encoding="utf-8")
    assert "set -euo pipefail" in text


def test_backup_uses_env_url_not_hardcoded():
    text = BACKUP.read_text(encoding="utf-8")
    assert "HOOKSHADE_DATABASE_URL" in text or "DATABASE_URL" in text
    assert not _HARDCODED_CRED.search(text)


def test_restore_requires_explicit_target():
    """Restore nunca pode assumir a URL de produção como destino."""
    text = RESTORE.read_text(encoding="utf-8")
    assert "RESTORE_DATABASE_URL" in text
    assert not _HARDCODED_CRED.search(text)


def test_restore_validates_after_restoring():
    text = RESTORE.read_text(encoding="utf-8")
    assert "alembic_version" in text  # validação pós-restore obrigatória


def test_no_dump_files_versioned():
    tracked_dumps = list(REPO_ROOT.glob("**/*.dump")) + list(REPO_ROOT.glob("**/backups/**/*"))
    tracked_dumps = [p for p in tracked_dumps
                     if ".venv" not in p.parts and "node_modules" not in p.parts]
    assert tracked_dumps == []
