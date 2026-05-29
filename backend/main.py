import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from db.session import init_db
from routers import districts, clusters, evidence, analyze


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
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(districts.router, prefix="/districts", tags=["districts"])
app.include_router(clusters.router, prefix="/cluster", tags=["clusters"])
app.include_router(evidence.router, prefix="/evidence", tags=["evidence"])
app.include_router(analyze.router, prefix="/analyze", tags=["analyze"])


@app.get("/health")
async def health():
    return {"status": "ok"}


