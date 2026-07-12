"""GET /me deve expor o papel do usuário (a UI usa para esconder edição de não-admin)."""
from app.models import User  # noqa: F401 — registra os modelos no Base antes do create_all


def test_me_returns_role(client, login):
    login()
    r = client.get("/api/v1/auth/me")
    assert r.status_code == 200
    assert r.json()["role"] == "admin"
    assert r.json()["email"] == "analyst@hookshade.local"
