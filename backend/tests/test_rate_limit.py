"""Rate limiting por IP (Fase 1 / Bloco 1).

Sliding window in-memory nas rotas de login e criação de análise. Limites
configuráveis via settings; rajada → 429; uso normal não é afetado. Unidade
usa clock fake (determinístico); API usa limites baixos via monkeypatch.
"""
import pytest

from app.config import settings
from app.ratelimit import SlidingWindowLimiter, limiter

EMAIL = "analyst@hookshade.local"
PASSWORD = "changeme123"


# ---------- unidade (clock fake, sem flakiness) ----------

def test_limiter_allows_up_to_max_and_blocks_next():
    clock = [0.0]
    rl = SlidingWindowLimiter(clock=lambda: clock[0])
    for _ in range(3):
        assert rl.allow("k", max_requests=3, window_seconds=60)
    assert not rl.allow("k", max_requests=3, window_seconds=60)


def test_limiter_frees_slots_after_window():
    clock = [0.0]
    rl = SlidingWindowLimiter(clock=lambda: clock[0])
    for _ in range(3):
        assert rl.allow("k", max_requests=3, window_seconds=60)
    assert not rl.allow("k", max_requests=3, window_seconds=60)
    clock[0] = 61.0
    assert rl.allow("k", max_requests=3, window_seconds=60)


def test_limiter_keys_are_independent():
    clock = [0.0]
    rl = SlidingWindowLimiter(clock=lambda: clock[0])
    for _ in range(3):
        assert rl.allow("a", max_requests=3, window_seconds=60)
    assert not rl.allow("a", max_requests=3, window_seconds=60)
    assert rl.allow("b", max_requests=3, window_seconds=60)


# ---------- API ----------

@pytest.fixture
def low_limits(monkeypatch):
    monkeypatch.setattr(settings, "rate_limit_login_per_minute", 3)
    monkeypatch.setattr(settings, "rate_limit_analyses_per_minute", 2)


def _login(client, password=PASSWORD):
    return client.post("/api/v1/auth/login", json={"email": EMAIL, "password": password})


def test_login_burst_returns_429(client, low_limits):
    for _ in range(3):
        assert _login(client, password="errada").status_code == 401
    assert _login(client).status_code == 429


def test_normal_login_not_limited(client, low_limits):
    assert _login(client).status_code == 200


def test_analyses_post_respects_limit(client, low_limits):
    token = _login(client).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    body = {"content": "Corpo de teste sem nada de especial.", "context": None}
    for _ in range(2):
        assert client.post("/api/v1/analyses/text", json=body, headers=headers).status_code == 200
    r = client.post("/api/v1/analyses/text", json=body, headers=headers)
    assert r.status_code == 429


def test_analysis_read_routes_not_limited(client, low_limits):
    token = _login(client).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    for _ in range(5):
        assert client.get("/api/v1/analyses", headers=headers).status_code == 200


def test_limiter_reset_between_tests(client, low_limits):
    # o autouse de conftest zera o estado global — rajada do teste anterior não vaza
    assert _login(client).status_code == 200
    assert limiter is not None
