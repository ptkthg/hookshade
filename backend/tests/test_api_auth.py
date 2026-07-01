def _token(client):
    r = client.post("/api/v1/auth/login",
                    json={"email": "analyst@hookshade.local", "password": "changeme123"})
    assert r.status_code == 200
    return r.json()["access_token"]


def test_login_success(client):
    assert _token(client)


def test_login_bad_password(client):
    r = client.post("/api/v1/auth/login",
                    json={"email": "analyst@hookshade.local", "password": "wrong"})
    assert r.status_code == 401


def test_me_requires_auth(client):
    assert client.get("/api/v1/auth/me").status_code == 401
    token = _token(client)
    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["email"] == "analyst@hookshade.local"
