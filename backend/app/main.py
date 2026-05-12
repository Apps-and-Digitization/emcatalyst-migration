from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.core.config import settings
from app.api.routers import auth, events, vendors, approvals, agreements, reports, access, promotional, master, brs

app = FastAPI(
    title=settings.APP_NAME,
    description="EMCatalyst - Pharmaceutical Event Management & Compliance System",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PREFIX = "/api"
app.include_router(auth.router, prefix=PREFIX)
app.include_router(events.router, prefix=PREFIX)
app.include_router(vendors.router, prefix=PREFIX)
app.include_router(approvals.router, prefix=PREFIX)
app.include_router(agreements.router, prefix=PREFIX)
app.include_router(reports.router, prefix=PREFIX)
app.include_router(access.router, prefix=PREFIX)
app.include_router(promotional.router, prefix=PREFIX)
app.include_router(master.router, prefix=PREFIX)
app.include_router(brs.router, prefix=PREFIX)

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.get("/")
def root():
    return {"message": f"Welcome to {settings.APP_NAME}", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}
