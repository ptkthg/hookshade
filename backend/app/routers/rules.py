from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.deps import get_current_user, get_db, require_role
from app.models import User
from app.rules import service
from app.rules.validation import RuleValidationError
from app.schemas import RuleChangeOut, RuleIn, RuleOut, RuleUpdateIn, StatusChangeIn

router = APIRouter(prefix="/api/v1/rules", tags=["rules"])


def _handle(fn):
    try:
        return fn()
    except (RuleValidationError, ValueError) as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e)) from e
    except LookupError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e)) from e


@router.get("", response_model=list[RuleOut])
def list_rules(status_f: str | None = Query(None, alias="status"),
               category: str | None = None,
               _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.list_rules(db, status=status_f, category=category)


@router.get("/{rule_id}", response_model=RuleOut)
def get_rule(rule_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    r = service.get_rule(db, rule_id)
    if r is None or r.status == "deleted":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    return r


@router.get("/{rule_id}/history", response_model=list[RuleChangeOut])
def history(rule_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return service.rule_history(db, rule_id)


@router.post("", response_model=RuleOut, status_code=status.HTTP_201_CREATED)
def create(body: RuleIn, user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    return _handle(lambda: service.create_rule(
        db, actor_id=user.id, name=body.name, category=body.category, severity=body.severity,
        condition=body.condition, description=body.description, justification=body.justification))


@router.put("/{rule_id}", response_model=RuleOut)
def update(rule_id: int, body: RuleUpdateIn,
           user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    return _handle(lambda: service.update_rule(
        db, rule_id, actor_id=user.id, name=body.name, description=body.description,
        category=body.category, severity=body.severity, condition=body.condition,
        justification=body.justification))


@router.post("/{rule_id}/activate", response_model=RuleOut)
def activate(rule_id: int, body: StatusChangeIn = StatusChangeIn(),
             user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    return _handle(lambda: service.set_status(db, rule_id, actor_id=user.id, active=True,
                                              justification=body.justification))


@router.post("/{rule_id}/deactivate", response_model=RuleOut)
def deactivate(rule_id: int, body: StatusChangeIn = StatusChangeIn(),
               user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    return _handle(lambda: service.set_status(db, rule_id, actor_id=user.id, active=False,
                                              justification=body.justification))


@router.delete("/{rule_id}", response_model=RuleOut)
def delete(rule_id: int, body: StatusChangeIn = StatusChangeIn(),
           user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    return _handle(lambda: service.soft_delete_rule(db, rule_id, actor_id=user.id,
                                                   justification=body.justification))
