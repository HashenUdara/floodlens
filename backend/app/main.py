"""FastAPI application for FloodLens model and knowledge services."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.document_routes import router as document_router
from app.api.routes import router
from app.services.document_service import reconcile_interrupted_documents


@asynccontextmanager
async def lifespan(_: FastAPI):
    reconcile_interrupted_documents()
    yield


app = FastAPI(title="FloodLens API", version="0.2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)
app.include_router(document_router)
