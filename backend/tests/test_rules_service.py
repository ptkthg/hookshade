import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import AuditLog, DetectionRule, RuleChange, User
from app.rules.service import (create_rule, list_active_rule_dicts, rule_history,
                               set_status, soft_delete_rule, update_rule)
from app.rules.validation import RuleValidationError
from app.security import hash_password


@pytest.fixture
def db():
    eng = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(eng)
    s = sessionmaker(bind=eng)()
    s.add(User(name="Adm", email="a@h.local", role="admin", password_hash=hash_password("x")))
    s.commit()
    yield s
    s.close()


_COND = {"field": "subject", "op": "contains", "value": "loteria"}


def test_create_starts_inactive_v1_with_history_and_audit(db):
    r = create_rule(db, actor_id=1, name="Loteria", category="content", severity="médio",
                    condition=_COND, description="", justification="baseline")
    assert r.version == 1 and r.status == "inactive"
    assert db.query(RuleChange).filter_by(rule_id=r.id, action="create").count() == 1
    assert db.query(AuditLog).filter_by(action="rule.create").count() == 1


def test_create_rejects_invalid_condition(db):
    with pytest.raises(RuleValidationError):
        create_rule(db, actor_id=1, name="x", category="content", severity="médio",
                    condition={"field": "nope", "op": "contains", "value": "y"},
                    description="", justification="j")


def test_create_rejects_invalid_meta(db):
    with pytest.raises(ValueError):
        create_rule(db, actor_id=1, name="x", category="galaxia", severity="médio",
                    condition=_COND, description="", justification="j")


def test_update_bumps_version_and_snapshots(db):
    r = create_rule(db, actor_id=1, name="L", category="content", severity="médio",
                    condition=_COND, description="", justification="c")
    upd = update_rule(db, r.id, actor_id=1, severity="alto",
                      condition={"field": "subject", "op": "contains", "value": "prêmio"},
                      justification="subiu severidade")
    assert upd.version == 2 and upd.severity == "alto"
    hist = rule_history(db, r.id)
    assert [h.action for h in hist] == ["create", "update"]
    assert hist[-1].justification == "subiu severidade"


def test_activate_lists_in_active_dicts(db):
    r = create_rule(db, actor_id=1, name="L", category="content", severity="alto",
                    condition=_COND, description="", justification="c")
    assert list_active_rule_dicts(db) == []
    set_status(db, r.id, actor_id=1, active=True, justification="ligar")
    dicts = list_active_rule_dicts(db)
    assert len(dicts) == 1 and dicts[0]["id"] == r.id and dicts[0]["version"] == r.version


def test_soft_delete_hides_and_audits(db):
    r = create_rule(db, actor_id=1, name="L", category="content", severity="alto",
                    condition=_COND, description="", justification="c")
    set_status(db, r.id, actor_id=1, active=True, justification="on")
    soft_delete_rule(db, r.id, actor_id=1, justification="obsoleta")
    assert db.get(DetectionRule, r.id).status == "deleted"
    assert list_active_rule_dicts(db) == []
    assert db.query(AuditLog).filter_by(action="rule.delete").count() == 1


def test_update_on_deleted_rule_raises(db):
    r = create_rule(db, actor_id=1, name="L", category="content", severity="alto",
                    condition=_COND, description="", justification="c")
    soft_delete_rule(db, r.id, actor_id=1, justification="x")
    with pytest.raises(LookupError):
        update_rule(db, r.id, actor_id=1, severity="baixo", justification="tarde demais")
