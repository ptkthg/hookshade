"""GET /me deve expor o papel do usuário (a UI usa para esconder edição de não-admin)."""
from app.models import User  # garante registro dos modelos no Base antes do create_all


def test_me_returns_role(client):
    tok = client.post("/api/v1/auth/login",
                      json={"email": "analyst@hookshade.local", "password": "changeme123"}
                      ).json()["access_token"]
    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 200
    assert r.json()["role"] == "admin"
    assert r.json()["email"] == "analyst@hookshade.local"
