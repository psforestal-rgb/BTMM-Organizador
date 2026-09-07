# Progreso — GEO v0.1.0-alpha

**Fase cerrada**: 6 (cierre). Prototipo completo y fusionado a `main`
(PR #2, tag `v0.1.0-alpha.1`).

**Incremento posterior al cierre**: formulario de trámites en la UI
(`app/src/ui/hoy/PanelTramites.tsx`), el único pendiente de ingeniería
que quedó anotado en `docs/PENDIENTES_HUMANO.md` al cerrar la Fase 6.
Ver `docs/requisitos/CA-07.md` para el detalle y `docs/adr/0006-*.md`
para la generalización de sincronización que requirió (los eventos de
creación de trámite son masculinos; `paso_completado` no tiene un evento
de creación separado).

**Último commit**: (ver `git log --oneline -1`)

**Estado**: los doce criterios de aceptación tienen evidencia real en
`docs/INFORME_FINAL.md` (v0.1.0-alpha) y CA-07 quedó completado después
del cierre (ver arriba). CI de GitHub Actions con cuatro jobs (cliente,
build, servidor, end-to-end contra servidor real).

**Pendiente real, todo en `docs/PENDIENTES_HUMANO.md`** (ninguno es
trabajo de ingeniería sin decisión previa de una persona):
validar humanamente el archivo de feriados de Costa Rica; decidir sobre
CORS (`allow_origins=["*"]`) antes de cualquier despliegue; cargar tipos
de trámite, carriles y sitios reales de la institución; decidir la
política de permisos/ausencias.

**Comandos de verificación**:
```
cd app && npm run typecheck && npm run lint && npm test -- --run && npm run build
cd app && PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test
cd server && ./.venv/bin/ruff check geo tests && ./.venv/bin/python -m pytest -q --cov=geo --cov-report=term-missing --cov-fail-under=80
```
