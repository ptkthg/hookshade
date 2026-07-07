"""Rate limiting por IP — sliding window em memória (Fase 1 / Bloco 1).

LIMITAÇÃO OPERACIONAL: o estado vive no processo. Suficiente para instância
única (uso interno controlado / deploy atual). Produção multi-instância ou
multi-worker exige um backend compartilhado (Redis ou equivalente) — decisão
adiada de propósito; não transformar isto em arquitetura distribuída agora.
"""
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status

from app.config import settings


class SlidingWindowLimiter:
    def __init__(self, clock=time.monotonic):
        self._clock = clock
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str, *, max_requests: int, window_seconds: float) -> bool:
        now = self._clock()
        hits = self._hits[key]
        while hits and hits[0] <= now - window_seconds:
            hits.popleft()
        if len(hits) >= max_requests:
            return False
        hits.append(now)
        return True

    def reset(self) -> None:
        self._hits.clear()


limiter = SlidingWindowLimiter()

_TOO_MANY = HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many requests")


def _client_ip(request: Request) -> str:
    """IP de origem. Atrás do proxy do PaaS usa o primeiro X-Forwarded-For
    (spoofável por cliente direto — barreira de abuso, não controle forte)."""
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit_login(request: Request) -> None:
    if not limiter.allow(f"login:{_client_ip(request)}",
                         max_requests=settings.rate_limit_login_per_minute,
                         window_seconds=60):
        raise _TOO_MANY


def rate_limit_analyses(request: Request) -> None:
    if not limiter.allow(f"analyses:{_client_ip(request)}",
                         max_requests=settings.rate_limit_analyses_per_minute,
                         window_seconds=60):
        raise _TOO_MANY
