"""Logging estruturado de requisições com redaction (Fase 1 / Bloco 1).

Uma linha JSON por requisição: request_id, método, rota, status, latência e
user_id quando autenticado. Política de conteúdo: ALLOWLIST — só campos
explicitamente listados entram no log; corpo de requisição, headers e query
strings nunca são logados. `redact()` é a rede de segurança para qualquer
dict que venha a ser logado no futuro.
"""
import json
import logging
import time
import uuid

from fastapi import FastAPI, Request

logger = logging.getLogger("hookshade")

_SENSITIVE_KEYS = {
    "password", "token", "access_token", "refresh_token", "authorization",
    "cookie", "secret", "secret_key", "encryption_key", "raw_content",
    "content", "api_key",
}

_REDACTED = "[REDACTED]"


def redact(data: dict) -> dict:
    """Mascara valores de chaves sensíveis, recursivamente (case-insensitive)."""
    out: dict = {}
    for key, value in data.items():
        if key.lower() in _SENSITIVE_KEYS:
            out[key] = _REDACTED
        elif isinstance(value, dict):
            out[key] = redact(value)
        else:
            out[key] = value
    return out


class JsonFormatter(logging.Formatter):
    """Serializa o registro como JSON; campos extras vêm em record.ctx (redigidos)."""

    def format(self, record: logging.LogRecord) -> str:
        entry: dict = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "event": record.getMessage(),
        }
        ctx = getattr(record, "ctx", None)
        if isinstance(ctx, dict):
            entry.update(redact(ctx))
        if record.exc_info and record.exc_info[0] is not None:
            # tipo da exceção apenas — mensagem pode ecoar conteúdo sensível
            entry["exception"] = record.exc_info[0].__name__
        return json.dumps(entry, ensure_ascii=False, default=str)


def configure_logging() -> None:
    """Handler JSON em stdout para o logger da app. Idempotente."""
    root = logging.getLogger("hookshade")
    if any(isinstance(h.formatter, JsonFormatter) for h in root.handlers):
        return
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    root.addHandler(handler)
    root.setLevel(logging.INFO)


def install_request_logging(app: FastAPI) -> None:
    @app.middleware("http")
    async def _request_logging(request: Request, call_next):
        request_id = uuid.uuid4().hex[:12]
        request.state.request_id = request_id
        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            logger.error("request", exc_info=True, extra={"ctx": {
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status": 500,
                "duration_ms": round((time.perf_counter() - start) * 1000, 1),
                "ip": _client_host(request),
            }})
            raise
        ctx = {
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status": response.status_code,
            "duration_ms": round((time.perf_counter() - start) * 1000, 1),
            "ip": _client_host(request),
        }
        user_id = getattr(request.state, "user_id", None)
        if user_id is not None:
            ctx["user_id"] = user_id
        logger.info("request", extra={"ctx": ctx})
        response.headers["X-Request-ID"] = request_id
        return response


def _client_host(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
