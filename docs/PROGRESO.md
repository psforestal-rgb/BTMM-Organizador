# Progreso — GEO v0.1.0-alpha

**Fase cerrada**: 6 (cierre). Prototipo completo.

**Último commit**: (ver `git log --oneline -1`)

**Estado**: los doce criterios de aceptación tienen evidencia real en
`docs/INFORME_FINAL.md`. CI de GitHub Actions con cuatro jobs (cliente,
build, servidor, end-to-end contra servidor real). Rama
`mvp/v0.1.0-alpha` publicada, tag anotado `v0.1.0-alpha.1` publicado, PR
en borrador hacia `main`.

**Próximo paso, si continúa el trabajo**: construir el formulario de
trámites en `app/src/ui` (el motor ya existe y está probado, ver
`docs/PENDIENTES_HUMANO.md`); validar humanamente el archivo de
feriados; decidir sobre CORS antes de cualquier despliegue.

**Comandos de verificación** (los mismos usados para `INFORME_FINAL.md`):
```
cd app && npm run typecheck && npm run lint && npm test -- --run && npm run build
cd app && PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test
cd server && ./.venv/bin/ruff check geo tests && ./.venv/bin/python -m pytest -q --cov=geo --cov-report=term-missing --cov-fail-under=80
```
