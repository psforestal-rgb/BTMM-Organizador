# Progreso — GEO v0.1.0-alpha

**Fase cerrada**: 0 (cimientos) — en curso, pendiente de commit final.

**Último commit**: (pendiente, se actualiza al cerrar la fase)

**Próximo paso**: cerrar Fase 0 (README, commit, push) y arrancar Fase 1
(esquema Dexie + SQLAlchemy/Alembic + disparadores append-only).

**Comandos de verificación**:
```
cd app && npm run typecheck && npm run lint && npm test -- --run && npm run build
cd server && ./.venv/bin/python -m pytest -q --cov=geo --cov-report=term-missing
```
