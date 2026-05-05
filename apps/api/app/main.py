from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers import courses, health, meta


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Course Inquiry API",
        version="0.1.0",
        description="Modern API for online and offline PKU course inquiry.",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.origin_list,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(meta.router, prefix="/api")
    app.include_router(courses.router, prefix="/api")
    return app


app = create_app()
