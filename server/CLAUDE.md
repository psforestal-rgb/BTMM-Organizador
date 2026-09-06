# server/ — reglas locales

Python 3.12, FastAPI, SQLAlchemy 2.x, Alembic, Pydantic v2, sobre SQLite.

- `geo/dominio/`: funciones puras. Prohibido `datetime.now()`/`date.today()`
  y cualquier import de `sqlalchemy` o `sqlite3`. Prohibido importar
  `geo.datos` o `geo.api` desde aquí (prueba de dirección de dependencias).
- `geo/datos/`: modelos SQLAlchemy y sesión. Los eventos son append-only;
  los disparadores viven en una migración Alembic aislada
  (`0002_append_only_triggers`), nunca en el modelo Python.
- `geo/sync/`: push/pull/status y fusión por campo. Debe coincidir campo a
  campo con `app/src/sync/fusion.ts` (ver ADR 0002); toda divergencia es un
  bug, no una libertad de implementación.
- `geo/api/`: FastAPI. Los endpoints validan con Pydantic y delegan toda
  lógica a `dominio`/`sync`; no contienen reglas de negocio.
- Migraciones: `alembic revision -m "..."` y `alembic upgrade head`. Nunca
  editar una migración ya aplicada en `main`.
- Pruebas: `pytest -q` desde `server/`. Cobertura objetivo ≥80% en
  `geo/dominio` y `geo/sync` (`--cov=geo --cov-report=term-missing`).
- Ruff para lint: `ruff check geo tests`.
- Entorno virtual en `server/.venv`, dependencias en `requirements.txt`
  (runtime) y `requirements-dev.txt` (pruebas y calidad).
