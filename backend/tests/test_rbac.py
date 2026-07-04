"""RBAC: papel do usuário e dependência require_role."""
import pytest
from fastapi import HTTPException

from app.deps import require_role
from app.models import User


def _user(role: str) -> User:
    return User(name=role, email=f"{role}@h.local", role=role, password_hash="x")


def test_require_role_allows_matching_role():
    dep = require_role("admin")
    u = _user("admin")
    assert dep(u) is u


def test_require_role_allows_any_of_multiple():
    dep = require_role("admin", "analyst")
    assert dep(_user("analyst")).role == "analyst"


def test_require_role_blocks_other_role():
    dep = require_role("admin")
    with pytest.raises(HTTPException) as ei:
        dep(_user("analyst"))
    assert ei.value.status_code == 403


def test_user_defaults_to_analyst_role():
    u = User(name="x", email="x@h.local", password_hash="x")
    # default aplicado no flush; instancia sem role -> None até persistir, mas a coluna default é analyst
    assert User.__table__.c.role.default.arg == "analyst"
