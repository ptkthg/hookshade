from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import analyses, audit, auth, rules
from app.seed import init_db


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
    return {"status": "ok"}
