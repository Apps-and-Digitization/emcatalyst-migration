from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
import os
import logging

from app.core.config import settings
from app.api.routers import auth, events, access, master, brs, import_mcl, reports
from app.api.routers import rbac as rbac_router
from app.api.routers import workflows as workflow_router
from app.api.routers import brs_bulk
from app.api.routers import vendor as vendor_router
from app.api.routers import jobs as jobs_router
from app.api.routers import budget as budget_router

logger = logging.getLogger(__name__)


def run_migrations():
    """Run Alembic migrations to ensure DB schema is up to date."""
    from alembic.config import Config
    from alembic import command

    alembic_cfg = Config("alembic.ini")
    command.upgrade(alembic_cfg, "head")


def seed_rbac_data():
    """Seed RBAC roles, pages, and admin access."""
    from app.db.base import SessionLocal
    from app.services.rbac_service import seed_rbac
    from app.services.workflow_service import seed_workflows
    from app.services.vendor_seed import seed_withholding_taxes
    from app.services.gl_account_seed import seed_gl_accounts
    from app.db.init_db import seed_data

    db = SessionLocal()
    try:
        seed_data(db)
        seed_rbac(db)
        seed_workflows(db)
        seed_withholding_taxes(db)
        seed_gl_accounts(db)
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run migrations manually: alembic upgrade head
    # Seed RBAC data on startup
    try:
        seed_rbac_data()
        logger.info("RBAC data seeded successfully.")
    except Exception as e:
        logger.warning(f"RBAC seeding skipped or failed: {e}")
    yield


app = FastAPI(
    title=settings.APP_NAME,
    description="EMCatalyst - Pharmaceutical Event Management & Compliance System",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
)

# Rate limiting
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def no_cache_for_api(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        response.headers["Pragma"] = "no-cache"
    return response

PREFIX = "/api"
app.include_router(auth.router, prefix=PREFIX)
app.include_router(events.router, prefix=PREFIX)
app.include_router(access.router, prefix=PREFIX)
app.include_router(master.router, prefix=PREFIX)
app.include_router(brs.router, prefix=PREFIX)
app.include_router(import_mcl.router, prefix=PREFIX)
app.include_router(rbac_router.router, prefix=PREFIX)
app.include_router(workflow_router.router, prefix=PREFIX)
app.include_router(brs_bulk.router, prefix=PREFIX)
app.include_router(reports.router, prefix=PREFIX)
app.include_router(vendor_router.router, prefix=PREFIX)
app.include_router(jobs_router.router, prefix=PREFIX)
app.include_router(budget_router.router, prefix=PREFIX)

os.makedirs("uploads", exist_ok=True)
# Uploaded files are served via authenticated endpoint below — not via StaticFiles


@app.get("/uploads/{file_path:path}")
def serve_protected_file(file_path: str):
    """Serve uploaded files — requires valid file path, prevents traversal."""
    from fastapi.responses import FileResponse
    from fastapi import HTTPException as HE
    from pathlib import Path
    safe_path = Path("uploads") / file_path
    # Prevent path traversal
    try:
        safe_path.resolve().relative_to(Path("uploads").resolve())
    except ValueError:
        raise HE(status_code=403, detail="Access denied")
    if not safe_path.exists():
        raise HE(status_code=404, detail="File not found")
    return FileResponse(safe_path)


@app.get("/")
def root():
    return {"message": f"Welcome to {settings.APP_NAME}", "docs": "/docs"}


@app.get("/health")
def health():
    from sqlalchemy import text
    from app.db.base import SessionLocal
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        return {"status": "ok", "db": "ok"}
    except Exception:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="Database unavailable")
