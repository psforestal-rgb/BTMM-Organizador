import pathlib

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from alembic import command
from alembic.config import Config

SERVER_ROOT = pathlib.Path(__file__).resolve().parent.parent


@pytest.fixture()
def db_path(tmp_path):
    return tmp_path / "geo_test.db"


@pytest.fixture()
def db_engine(db_path, monkeypatch):
    """Base de datos SQLite migrada con Alembic hasta head, incluidos los
    disparadores append-only. Aislada por prueba (archivo temporal)."""
    database_url = f"sqlite:///{db_path}"
    monkeypatch.setenv("GEO_DATABASE_URL", database_url)

    config = Config(str(SERVER_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(SERVER_ROOT / "alembic"))
    command.upgrade(config, "head")

    engine = create_engine(database_url, connect_args={"check_same_thread": False})
    try:
        yield engine
    finally:
        engine.dispose()


@pytest.fixture()
def db_session(db_engine):
    with Session(db_engine) as session:
        yield session
