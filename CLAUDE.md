# GEO — mapa del repositorio

GEO (Sistema Personal de Gestión Operativa, Planificación Adaptativa y
Memoria Externa) vive en el repositorio `BTMM-Organizador`. PWA
offline-first para trabajo de campo con conectividad intermitente.

## Stack fijo (no debatir; cualquier adición requiere ADR)

- Cliente: Vite + React 18 + TypeScript estricto, `vite-plugin-pwa`
  (Workbox), Dexie 4 + `dexie-react-hooks`, CSS propio, sin framework UI.
- Servidor: Python 3.12, FastAPI, Uvicorn, SQLAlchemy 2.x, Alembic,
  Pydantic v2, sobre SQLite (el dominio no depende de SQLite salvo los
  disparadores append-only, aislados en su propia migración).
- Pruebas: Vitest, `@playwright/test`, pytest, `pytest-cov`, `httpx`.
- Calidad: ESLint + Prettier (cliente), Ruff (servidor).
- CI: GitHub Actions.

## Estructura

```
app/src/dominio    motores puros (sin IO, sin reloj de sistema)
app/src/datos      Dexie, outbox, repositorios
app/src/sync       SyncAdapter y cliente
app/src/puertos    Reloj, AIProvider, WeatherProvider, ProtectedDataProvider, SyncAdapter
app/src/ui         HOY, CAPTURAR, RADAR, BITACORA
server/geo/api      endpoints FastAPI
server/geo/dominio  motores puros (espejo conceptual del cliente)
server/geo/sync     push/pull/status, fusión por campo
server/geo/datos    modelos SQLAlchemy, Alembic
docs/adr            decisiones arquitectónicas
docs/requisitos     CA-01 .. CA-12, un archivo por criterio
```

## Los ocho invariantes no negociables

1. Un evento nunca se modifica ni se borra (disparadores SQLite +
   ausencia de ruta de escritura en el cliente).
2. Eventos y entidades son cosas distintas: tabla, tipo y ruta de
   escritura separadas desde el primer commit.
3. Todo envío es idempotente: reenviar un lote no cambia el estado ni
   produce error, solo duplicados.
4. Ningún elemento sale de una vista sin una decisión registrada como
   evento. No existe el botón que solo oculta.
5. El dominio no conoce la hora del sistema. Toda lectura de tiempo pasa
   por el puerto `Reloj`. `new Date()` / `datetime.now()` prohibidos en
   `app/src/dominio` y `server/geo/dominio`, verificado por prueba.
6. Días hábiles: funciones deterministas sobre datos, nunca heurísticas
   de texto ni IA.
7. El planificador nunca excede la capacidad programable y siempre
   justifica cada bloque y cada candidata no colocada con un código de
   vocabulario cerrado.
8. Cero datos personales reales. Solo identificadores opacos
   (`CASO-2026-001`, `Persona A`, `Sitio Alfa`). Prueba de escaneo del
   repositorio.

## Fase actual

Ver `docs/PROGRESO.md` (reescrito al cierre de cada fase, no acumulativo).

## Punteros

- Concepto funcional completo: `docs/CONCEPTO.md`
- Plan de fases: `docs/PLAN.md`
- Criterios de aceptación: `docs/requisitos/CA-01.md` … `CA-12.md`
- Decisiones: `docs/adr/`
- Pendientes de validación humana: `docs/PENDIENTES_HUMANO.md`
- Reglas locales: `app/CLAUDE.md`, `server/CLAUDE.md`

## Reglas de trabajo

No volcar archivos completos en la conversación: `grep`/`glob` y leer solo
el rango necesario. Commits pequeños, conventional commits. Ejecutar solo
las pruebas del módulo tocado durante desarrollo; la suite completa al
cierre de fase. Al cerrar cada fase, imprimir en la conversación el
comando ejecutado, su código de salida y el conteo de pruebas.
