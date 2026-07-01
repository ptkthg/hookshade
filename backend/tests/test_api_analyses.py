from pathlib import Path

FIXTURES = Path(__file__).parent / "fixtures"


def _token(client):
    r = client.post("/api/v1/auth/login",
                    json={"email": "analyst@hookshade.local", "password": "changeme123"})
    return r.json()["access_token"]


def test_create_analysis_from_text_and_fetch(client):
    token = _token(client)
    headers = {"Authorization": f"Bearer {token}"}
    raw = (FIXTURES / "phishing.eml").read_text(encoding="utf-8")
    r = client.post("/api/v1/analyses/text", json={"content": raw}, headers=headers)
    assert r.status_code == 200
    detail = r.json()
    assert detail["risk_score"] >= 60
    assert detail["severity"] in ("alto", "crítico")
    assert detail["findings"]

    aid = detail["id"]
    r2 = client.get(f"/api/v1/analyses/{aid}", headers=headers)
    assert r2.status_code == 200
    assert r2.json()["id"] == aid

    r3 = client.get("/api/v1/analyses", headers=headers)
    assert r3.status_code == 200
    assert any(a["id"] == aid for a in r3.json())


def test_create_analysis_from_eml_upload(client):
    token = _token(client)
    headers = {"Authorization": f"Bearer {token}"}
    raw = (FIXTURES / "benign.eml").read_bytes()
    r = client.post("/api/v1/analyses",
                    files={"file": ("benign.eml", raw, "message/rfc822")}, headers=headers)
    assert r.status_code == 200
    assert r.json()["risk_score"] < 30


def test_analyses_require_auth(client):
    assert client.get("/api/v1/analyses").status_code == 401
