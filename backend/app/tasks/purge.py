"""Comando de management: purga análises além do prazo de retenção (P0-11).

`purge_expired` só marca os deletes e grava a auditoria; este wrapper abre a
sessão, chama a purga, **commita** e fecha — o formato pronto para ser agendado.
Idempotente: rodar duas vezes remove zero na segunda. Falha propaga (exit != 0
para o agendador alertar) e loga JSON estruturado com o TIPO da exceção apenas
— a mensagem pode ecoar conteúdo sensível e nunca vai ao log.

Uso:
    python -m app.tasks.purge              # usa settings.retention_days (padrão 90)
    python -m app.tasks.purge --days 30    # sobrescreve o prazo

Agendar (rodar diariamente) — a retenção SÓ é garantida com este job ativo:
    - Railway: serviço separado do mesmo repo com Cron Schedule (ver README)
    - Linux/macOS (cron):   0 3 * * *  cd /app/backend && python -m app.tasks.purge
    - Windows (Task Scheduler): ação "python -m app.tasks.purge" no diretório backend
"""
import argparse
import logging

from app.config import settings
from app.database import SessionLocal
from app.request_logging import configure_logging
from app.retention import purge_expired

logger = logging.getLogger("hookshade")


def run_purge(older_than_days: int, session_factory=None) -> int:
    """Abre uma sessão, purga análises expiradas, commita e fecha. Retorna quantas."""
    factory = session_factory or SessionLocal
    db = factory()
    try:
        removed = purge_expired(db, older_than_days)
        db.commit()
        logger.info("purge.completed", extra={"ctx": {
            "removed": removed, "retention_days": older_than_days,
        }})
        return removed
    except Exception:
        logger.error("purge.failed", exc_info=True, extra={"ctx": {
            "retention_days": older_than_days,
        }})
        raise
    finally:
        db.close()


def main(argv=None) -> int:
    configure_logging()
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
