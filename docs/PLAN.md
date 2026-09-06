# Plan de fases — GEO v0.1.0-alpha

0. **Cimientos**: estructura, CLAUDE.md, docs, ADRs iniciales, scaffold
   cliente (PWA instalándose) y servidor (`/health`), CI en verde.
1. **Núcleo de datos**: esquema Dexie completo, esquema SQLAlchemy +
   Alembic + disparadores append-only, pruebas de invariantes.
2. **Motores puros**: calendario, estados/espera, radar, planificador,
   cuotas de iniciativa. Suite Vitest completa. Sin interfaz.
3. **Sincronización real**: endpoints, idempotencia, puntos de control,
   fusión por campo, conflictos; cliente con cola y reintentos. Va antes
   que la interfaz porque concentra el riesgo técnico.
4. **Las cuatro superficies**: HOY, CAPTURAR, RADAR, BITÁCORA.
5. **Escenario canónico**: `escenario-canonico` end-to-end en Playwright
   más casos de captura, offline, interrupción, próxima acción y
   exportación.
6. **Cierre**: README, INFORME_FINAL.md, PENDIENTES_HUMANO.md, rama
   publicada, tag anotado `v0.1.0-alpha.1`, PR en borrador hacia `main`.

Cada fase cierra con: pruebas del módulo en verde, commit, evidencia
impresa (comando + código de salida + conteo), y reescritura de
`docs/PROGRESO.md`.
