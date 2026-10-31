from collections.abc import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool, StaticPool

from app.config import get_settings


def make_engine(url: str) -> Engine:
    if url.startswith("sqlite"):
        if url in ("sqlite://", "sqlite:///:memory:"):
            # An in-memory database vanishes when its connection closes, and web requests
            # run on different threads. One shared connection keeps it alive for tests.
            engine = create_engine(url, poolclass=StaticPool, connect_args={"check_same_thread": False})
        else:
            engine = create_engine(url)

        # SQLite ignores foreign keys unless asked; Postgres always enforces them.
        @event.listens_for(engine, "connect")
        def _enable_fks(dbapi_conn, _):
            dbapi_conn.execute("PRAGMA foreign_keys=ON")

        return engine

    # Postgres through Supabase's transaction pooler (PgBouncer):
    # - NullPool: the pooler already pools connections, and a serverless function
    #   can't keep its own pool alive between invocations anyway.
    # - prepare_threshold=None: PgBouncer in transaction mode hands each transaction
    #   to a different server connection, so server-side prepared statements break.
    return create_engine(url, poolclass=NullPool, connect_args={"prepare_threshold": None})


engine = make_engine(get_settings().sqlalchemy_url)
SessionLocal = sessionmaker(engine, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """FastAPI dependency: one DB session per request, always closed afterwards."""
    with SessionLocal() as db:
        yield db
