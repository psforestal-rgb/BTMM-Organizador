# app/ — reglas locales

Vite + React 18 + TypeScript estricto. Sin framework de UI, CSS propio.

- `src/dominio/`: funciones puras. Prohibido `new Date()`; usar el puerto
  `Reloj` inyectado. Prohibido importar Dexie, `fetch` o `src/ui`.
- `src/datos/`: Dexie, outbox, repositorios. Los eventos solo se
  `add()`, nunca `put()`/`update()`/`delete()` — la ausencia de esos
  métodos en el repositorio de eventos es lo que prueba CA-03 en cliente.
- `src/sync/`: implementa el puerto `SyncAdapter`. Debe reproducir el
  mismo algoritmo de fusión que `server/geo/sync/fusion.py` (ver ADR
  0002); toda divergencia se corrige, nunca se documenta como "variante".
- `src/puertos/`: interfaces de la sección 9. Las implementaciones nulas
  viven aquí también; las reales (`RelojSistema`, `SyncAdapterRest`) son
  las únicas piezas del árbol `src/` con permiso de llamar `new Date()`
  o `fetch` directamente.
- `src/ui/`: HOY, CAPTURAR, RADAR, BITÁCORA. Componentes leen de Dexie
  vía `dexie-react-hooks`; no contienen lógica de negocio, solo llaman al
  dominio.
- Router propio sobre `history.pushState` en `src/router.ts`; no añadir
  un enrutador de terceros.
- `localStorage` solo para `device_id` y preferencias de interfaz, nunca
  datos de dominio.
- Pruebas: `npm test -- --run` (Vitest) durante desarrollo solo del
  módulo tocado; `npx playwright test` para E2E, incluido
  `escenario-canonico`.
- `npm run typecheck && npm run lint && npm test -- --run && npm run build`
  deben salir en 0 antes de cerrar cualquier fase.
