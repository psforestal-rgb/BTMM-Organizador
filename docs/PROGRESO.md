# Progreso — GEO v0.1.0-alpha

**Fase cerrada**: 3 (sincronización real).

**Último commit**: (ver `git log --oneline -1` tras el commit de esta fase)

**Próximo paso**: Fase 4 — las cuatro superficies (HOY, CAPTURAR, RADAR,
BITÁCORA) en `app/src/ui`, cableadas a Dexie vía `dexie-react-hooks` y al
dominio/sync ya construidos. Trámites e iniciativas viven dentro de HOY,
no en pantallas propias.

**Sincronización real implementada**: servidor con `/sync/push`,
`/sync/pull`, `/sync/status`, `/sync/conflictos` (extra, no rompe la
sección 6) y `/export/bitacora`; fusión por campo con field_meta
disperso (un campo sin editar aún no tiene entrada, así que la primera
edición real nunca es "conflicto" — solo lo es cuando dos dispositivos
distintos ya editaron el mismo campo); idempotencia por
`(device_id, client_sequence)`; server_seq compartido entre `evento` y
`cambio_registro` para paginación intercalada. Cliente con
`SyncAdapterRest`, `outbox.ts` (cola, reintentos con retroceso
exponencial, reanudación por `ultimo_server_seq_recibido`) y
`fusion.ts` (paridad con Python vía tabla de verdad compartida en
`docs/fixtures/fusion_casos.json`, copiada a `app/src/sync/` con prueba
de hash SHA-256).

**Comandos de verificación**:
```
cd app && npm run typecheck && npm run lint && npm test -- --run && npm run build
cd server && ./.venv/bin/ruff check geo tests && ./.venv/bin/python -m pytest -q --cov=geo --cov-report=term-missing
```
