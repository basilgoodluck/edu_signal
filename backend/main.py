import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from config import ALLOWED_ORIGINS
from db.session import init_db
from routers import ai, analytics, app_shell, clusters, districts, evidence, pipeline, scans, streams, workflow


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="EduSignal API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(app_shell.router, prefix="/api", tags=["app"])
app.include_router(streams.router, prefix="/api", tags=["streams"])
app.include_router(workflow.router, prefix="/api", tags=["workflow"])
app.include_router(analytics.router, prefix="/api", tags=["analytics"])
app.include_router(pipeline.router, prefix="/api", tags=["pipeline"])
app.include_router(ai.router, prefix="/api", tags=["ai"])
app.include_router(districts.router, prefix="/api/districts", tags=["districts"])
app.include_router(clusters.router, prefix="/api/clusters", tags=["clusters"])
app.include_router(evidence.router, prefix="/api/evidence", tags=["evidence"])
app.include_router(scans.router, prefix="/api/scans", tags=["scans"])
app.include_router(evidence.internal_router, prefix="/api/internal/evidence", tags=["internal"])

# Legacy development aliases kept so older scripts keep working while the frontend
# moves to the contract paths above.
app.include_router(districts.router, prefix="/districts", tags=["legacy-districts"])
app.include_router(clusters.router, prefix="/cluster", tags=["legacy-clusters"])
app.include_router(scans.router, prefix="/analyze", tags=["legacy-analyze"])


@app.get("/health")
async def health():
    return {"status": "ok"}


