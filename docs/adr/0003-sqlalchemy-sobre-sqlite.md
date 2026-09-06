# 0003 — SQLAlchemy sobre SQLite, con disparadores aislados

## Contexto

El servidor necesita persistencia real ya en v0.1, pero no debe atarse a
SQLite: una migración futura a PostgreSQL institucional es previsible.

## Decisión

Todo acceso a datos pasa por SQLAlchemy 2.x y las migraciones por
Alembic. El código de dominio nunca importa `sqlite3` ni usa SQL crudo,
salvo los disparadores de append-only de la sección 6, que son DDL
específico de SQLite aislado en una única migración rotulada
`0002_append_only_triggers` con un comentario del equivalente en
PostgreSQL (una regla `BEFORE UPDATE/DELETE` con función `RAISE
EXCEPTION`).

## Consecuencias

Portabilidad futura a PostgreSQL requiere solo reescribir esa migración
puntual, no el resto del código.

## Alternativas descartadas

SQLite crudo sin ORM: más rápido de escribir pero ata toda la aplicación
al dialecto. PostgreSQL desde ya: descartado porque añade una dependencia
de infraestructura innecesaria para un prototipo local.
