# Progreso — GEO v0.1.0-alpha

**Fase cerrada**: 4 (las cuatro superficies).

**Último commit**: (ver `git log --oneline -1` tras el commit de esta fase)

**Próximo paso**: Fase 5 — escenario canónico end-to-end en Playwright
con dos contextos de navegador (`DISPOSITIVO-A`/`DISPOSITIVO-B`) contra
un servidor FastAPI real levantado para la prueba (webServer de
Playwright o proceso `uvicorn` propio), más casos de offline total,
captura, interrupción/reanudación y exportación.

**Cuatro superficies wireadas de verdad** (no placeholders): HOY (crea
asignaciones, muestra capacidad/buffer vía `planificarDia` real,
iniciar/terminar/interrumpir/retomar actividad), CAPTURAR (persiste en
Dexie en <1500ms, sin bloquear), RADAR (ejecuta las 7 reglas sobre
snapshot real, decisión obligatoria de las 6 vías —
`aplicarDecisionCierre` rechaza cualquier "descartar"), BITÁCORA (estado
de sync, conflictos abiertos, persistencia de almacenamiento, export
JSON/CSV real). Verificado a mano con Playwright contra el build de
producción: crear asignación → iniciar → interrumpir → retomar, sin
errores de consola.

**Gaps conocidos, no bloqueantes para CA-12**: no hay formulario de
creación de trámites en la UI (el motor `dominio/tramites.ts` con
`proximaAccion` sí está implementado y probado); el escenario canónico
de la sección 13 no usa trámites, así que esto no afecta CA-12.

**Comandos de verificación**:
```
cd app && npm run typecheck && npm run lint && npm test -- --run && npm run build
cd server && ./.venv/bin/ruff check geo tests && ./.venv/bin/python -m pytest -q --cov=geo --cov-report=term-missing
```
