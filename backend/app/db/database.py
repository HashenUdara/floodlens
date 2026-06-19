"""Lazy SQLAlchemy engine and session management for optional RAG storage."""

from collections.abc import Generator
from functools import lru_cache

from fastapi import HTTPException, status
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.settings import settings


class Base(DeclarativeBase):
    pass


@lru_cache(maxsize=1)
def get_engine() -> Engine | None:
    if not settings.database_url:
        return None
    return create_engine(settings.database_url, pool_pre_ping=True)


@lru_cache(maxsize=1)
def get_session_factory() -> sessionmaker[Session] | None:
    engine = get_engine()
    if engine is None:
        return None
    return sessionmaker(bind=engine, expire_on_commit=False)


def require_session_factory() -> sessionmaker[Session]:
    factory = get_session_factory()
    if factory is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "message": "Knowledge Library is not configured.",
                "action": "Set DATABASE_URL and start PostgreSQL with pgvector.",
            },
        )
    return factory


def get_db_session() -> Generator[Session, None, None]:
    factory = require_session_factory()
    with factory() as session:
        yield session
