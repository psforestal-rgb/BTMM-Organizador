# Progreso — GEO v0.1.0-alpha

**Fase cerrada**: 5 (escenario canónico).

**Último commit**: (ver `git log --oneline -1` tras el commit de esta fase)

**Próximo paso**: Fase 6 — cierre. README con arranque rápido (ya escrito
en Fase 0, revisar), `docs/INFORME_FINAL.md` con los 12 CA y su
evidencia, revisar `docs/PENDIENTES_HUMANO.md`, publicar rama, tag
`v0.1.0-alpha.1` y PR en borrador hacia `main`.

**Escenario canónico (CA-12) en verde**, contra un servidor FastAPI real
(no simulado): dos contextos de navegador reales, reloj controlado con
`page.clock.setFixedTime`, offline real vía `context.setOffline`. Las
ocho verificaciones de la sección 13 pasan, incluida la fusión con
exactamente un conflicto en `prioridad` y convergencia sin conflicto en
`duracion_estimada_min`. También en verde: CA-01 (offline total tras
primera carga) y la prueba adicional de paginación interrumpida a mitad
de página (CA-11).

**Bugs reales encontrados y corregidos durante esta fase** (documentados
aquí porque cambiaron código de fases anteriores):
1. `RelojSistema.ahora()` devolvía UTC con "Z" en vez de la hora de pared
   de Costa Rica con desplazamiento explícito — rompía toda extracción
   de fecha/hora local por subcadena. Corregido con un formateador propio
   basado en `Intl.DateTimeFormat` (ver `app/src/puertos/relojSistema.ts`
   y su prueba).
2. `outbox.ts` nunca materializaba un evento `*_creada` recibido de otro
   dispositivo en la tabla de entidad local — el otro dispositivo nunca
   veía lo creado por el primero. Corregido con
   `materializarSiEsCreacion`, espejo de `_aplicar_evento_creacion` del
   servidor.
3. Los conflictos generados en el servidor nunca llegaban al cliente (no
   viajan como evento ni como cambio). Se añadió
   `SyncAdapter.conflictosAbiertos()` y su llamada al final de
   `sincronizar()`.
4. `servicio.pull()` devolvía el contador global del servidor como
   `server_seq` de la página en vez del mayor `server_seq` efectivamente
   entregado en esa página — con más datos que el límite de una sola
   página, el cliente saltaba directo al final y perdía páginas
   intermedias. Corregido, con prueba de regresión dedicada.

**Comandos de verificación**:
```
cd app && npm run typecheck && npm run lint && npm test -- --run && npm run build
cd app && PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test
cd server && ./.venv/bin/ruff check geo tests && ./.venv/bin/python -m pytest -q --cov=geo --cov-report=term-missing
```
