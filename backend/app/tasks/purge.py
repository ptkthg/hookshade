"""Comando de management: purga análises além do prazo de retenção (P0-11).

`purge_expired` só marca os deletes e grava a auditoria; este wrapper abre a
sessão, chama a purga, **commita** e fecha — o formato pronto para ser agendado.

Uso:
    python -m app.tasks.purge              # usa settings.retention_days (padrão 90)
    python -m app.tasks.purge --days 30    # sobrescreve o prazo

Agendar (rodar diariamente):
    - Linux/macOS (cron):   0 3 * * *  cd /app/backend && python -m app.tasks.purge
    - Windows (Task Scheduler): ação "python -m app.tasks.purge" no diretório backend
"""
import argparse

from app.config import settings
from app.database import SessionLocal
from app.retention import purge_expired


def run_purge(older_than_days: int, session_factory=None) -> int:
    """Abre uma sessão, purga análises expiradas, commita e fecha. Retorna quantas."""
    factory = session_factory or SessionLocal
    db = factory()
    try:
        removed = purge_expired(db, older_than_days)
        db.commit()
        return removed
    finally:
        db.close()


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        description="Purga análises cujo raw_content passou do prazo de retenção."
    )
    parser.add_argument(
        "--days", type=int, default=settings.retention_days,
        help=f"Prazo de retenção em dias (padrão: {settings.retention_days}).",
    )
    args = parser.parse_args(argv)
    removed = run_purge(args.days)
    print(f"Purga concluída: {removed} análise(s) removida(s) (retenção {args.days}d).")
    return removed


if __name__ == "__main__":
    main()
