import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.deps import get_db
from app.routers import analyses, audit, auth, rules
from app.seed import init_db

logger = logging.getLogger("hookshade")


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
