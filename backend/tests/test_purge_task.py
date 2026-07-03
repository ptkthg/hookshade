"""Comando de management da purga de retenção (agendável via cron/Task Scheduler).

Cobre o *wiring*: abrir sessão, chamar purge_expired, commitar e reportar.
A lógica de qual análise expira já é coberta por test_privacy.py.
"""
from datetime import datetime, timedelta, timezone

from app.models import Analysis, AuditLog
from app.tasks.purge import main, run_purge


def _token(client):
    r = client.post("/api/v1/auth/login",
                    json={"email": "analyst@hookshade.local", "password": "changeme123"})
    return r.json()["access_token"]


def _create_analysis(client, content="conteúdo"):
    headers = {"Authorization": f"Bearer {_token(client)}"}
    return client.post("/api/v1/analyses/text", json={"content": content}, headers=headers).json()["id"]


def _backdate(db_session, aid, days):
    row = db_session.get(Analysis, aid)
    row.created_at = datetime.now(timezone.utc) - timedelta(days=days)
    db_session.commit()


def test_run_purge_removes_and_persists(client, db_session):
    """run_purge deve remover a análise expirada, commitar e auditar."""
    aid = _create_analysis(client, "antigo")
    _backdate(db_session, aid, 120)

    removed = run_purge(90, session_factory=lambda: db_session)

    assert removed == 1
    assert db_session.get(Analysis, aid) is None
    assert db_session.query(AuditLog).filter(AuditLog.action == "analysis.purge").count() >= 1


def test_run_purge_keeps_recent(client, db_session):
    """Análise recente não deve ser tocada."""
    aid = _create_analysis(client, "novo")

    removed = run_purge(90, session_factory=lambda: db_session)

    assert removed == 0
    assert db_session.get(Analysis, aid) is not None


def test_main_uses_settings_retention_by_default(client, db_session, monkeypatch, capsys):
    """`python -m app.tasks.purge` sem args usa settings.retention_days (90)."""
    aid = _create_analysis(client, "antigo default")
    _backdate(db_session, aid, 120)
    monkeypatch.setattr("app.tasks.purge.SessionLocal", lambda: db_session)

    removed = main([])

    assert removed == 1
    assert db_session.get(Analysis, aid) is None
    assert "1" in capsys.readouterr().out


def test_main_accepts_days_override(client, db_session, monkeypatch, capsys):
    """--days sobrescreve o prazo padrão."""
    aid = _create_analysis(client, "40 dias")
    _backdate(db_session, aid, 40)
    monkeypatch.setattr("app.tasks.purge.SessionLocal", lambda: db_session)

    removed = main(["--days", "30"])

    assert removed == 1
    assert db_session.get(Analysis, aid) is None
