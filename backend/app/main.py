import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.csrf import verify_csrf_token
from app.deps import get_db
from app.request_logging import configure_logging, install_request_logging
from app.routers import analyses, audit, auth, rules, users
from app.seed import init_db

# Métodos que mudam estado exigem prova de mesma-origem (double-submit).
# GET/HEAD/OPTIONS ficam de fora: são seguros por definição e o preflight quebraria.
_CSRF_PROTECTED_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

logger = logging.getLogger("hookshade")
configure_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Fail-closed: em produção, recusa subir com segredos fracos/default (SEC).
    settings.validate_for_production()
    try:
        init_db()
    except Exception:
        # In tests the DB is overridden; a locked/missing file DB must not block startup.
        pass
    yield


app = FastAPI(title="Hookshade API", version="0.1.0", lifespan=lifespan)

install_request_logging(app)


@app.middleware("http")
async def csrf_guard(request, call_next):
    if request.method in _CSRF_PROTECTED_METHODS and request.url.path.startswith("/api/"):
        cookie = request.cookies.get(settings.csrf_cookie_name)
        header = request.headers.get(settings.csrf_header_name)
        if not verify_csrf_token(cookie, header):
            # Mensagem opaca de propósito: não dizer se faltou cookie, faltou header
            # ou a assinatura não bateu. Isso só ajudaria quem está sondando.
            return JSONResponse(status_code=403, content={"detail": "CSRF validation failed"})
    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(analyses.router)
app.include_router(audit.router)
app.include_router(rules.router)
app.include_router(users.router)


@app.get("/health")
def health():
    """Liveness: o processo responde. Não toca o banco."""
    return {"status": "ok"}


@app.get("/ready")
def ready(db: Session = Depends(get_db)):
    """Readiness: app + banco. 503 genérico se o banco não responder —
    nunca expõe stack trace nem string de conexão."""
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        logger.warning("readiness check failed: database unavailable")
        return JSONResponse(status_code=503, content={"status": "unavailable"})
    return {"status": "ready"}
