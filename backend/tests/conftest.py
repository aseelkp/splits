import pytest
from sqlalchemy.orm import Session

from app.db import make_engine
from app.models import Base


@pytest.fixture
def db():
    """A fresh in-memory SQLite database per test."""
    engine = make_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
