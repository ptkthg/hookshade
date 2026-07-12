"""Login e /me — agora por sessão em cookie httpOnly (sem token no corpo)."""


def test_login_success(client, login):
    r = login()
    assert r.status_code == 200
    assert "access_token" not in r.json()  # o JWT vai só no cookie


def test_login_bad_password(client):
    r = client.post("/api/v1/auth/login",
                    json={"email": "analyst@hookshade.local", "password": "wrong"})
    assert r.status_code == 401


def test_me_requires_auth(client, login):
    assert client.get("/api/v1/auth/me").status_code == 401
    login()
    r = client.get("/api/v1/auth/me")
    assert r.status_code == 200
    assert r.json()["email"] == "analyst@hookshade.local"
