from app.models import Analysis, User


def test_can_persist_user_and_analysis(db_session):
    user = User(name="A", email="a@b.com", password_hash="x")
    db_session.add(user)
    db_session.commit()
    analysis = Analysis(
        submitted_by=user.id, source_type="text", raw_content="hi",
        sha256="0" * 64, risk_score=10, severity="baixo",
    )
    db_session.add(analysis)
    db_session.commit()
    assert analysis.id is not None
    assert analysis.iocs == []
