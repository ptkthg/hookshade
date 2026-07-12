from pathlib import Path

FIXTURES = Path(__file__).parent / "fixtures"




def test_create_analysis_from_text_and_fetch(client, login):
    login()
    raw = (FIXTURES / "phishing.eml").read_text(encoding="utf-8")
    r = client.post("/api/v1/analyses/text", json={"content": raw})
    assert r.status_code == 200
    detail = r.json()
    assert detail["risk_score"] >= 60
    assert detail["severity"] in ("alto", "crítico")
    assert detail["findings"]

    aid = detail["id"]
    r2 = client.get(f"/api/v1/analyses/{aid}")
    assert r2.status_code == 200
    assert r2.json()["id"] == aid

    r3 = client.get("/api/v1/analyses")
    assert r3.status_code == 200
    assert any(a["id"] == aid for a in r3.json())


def test_create_analysis_from_eml_upload(client, login):
    login()
    raw = (FIXTURES / "benign.eml").read_bytes()
    r = client.post("/api/v1/analyses",
                    files={"file": ("benign.eml", raw, "message/rfc822")})
    assert r.status_code == 200
    assert r.json()["risk_score"] < 30


def test_analyses_require_auth(client):
    assert client.get("/api/v1/analyses").status_code == 401
