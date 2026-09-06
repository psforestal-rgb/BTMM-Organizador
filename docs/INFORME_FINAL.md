# Informe final — GEO v0.1.0-alpha

Evidencia real de los doce criterios de aceptación. Cada uno lista el
comando ejecutado, el archivo y nombre de la prueba que lo cubre, y un
extracto literal de la salida obtenida al cerrar el prototipo.

Comandos de verificación completos (sección 15):

```
cd app && npm run typecheck && npm run lint && npm test -- --run && npm run build
```
```
> tsc -b --noEmit          (sin salida, código 0)
> eslint . --max-warnings 0 (sin salida, código 0)
> vitest --run
 Test Files  18 passed (18)
      Tests  96 passed (96)
> vite build
✓ built in 408ms
PWA v1.3.0 — dist/sw.js, dist/workbox-9c191d2f.js generados
```

```
cd server && ./.venv/bin/ruff check geo tests && ./.venv/bin/python -m pytest -q --cov=geo --cov-report=term-missing --cov-fail-under=80
```
```
All checks passed!
25 passed, 1 warning in 3.82s
Name                      Stmts   Miss Branch BrPart  Cover
geo/sync/fusion.py           36      0      6      0   100%
geo/sync/schemas.py          61      0      0      0   100%
geo/sync/servicio.py        135     12     38      9    88%
TOTAL                       440     19     50     11    94%
Required test coverage of 80% reached. Total coverage: 93.88%
```

```
cd app && PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test
```
```
Running 4 tests using 1 worker
  ✓ e2e/escenario-canonico.spec.ts:30:1 › escenario-canonico (4.1s)
  ✓ e2e/offline-total.spec.ts:7:1 › funciona completamente offline tras la primera carga (715ms)
  ✓ e2e/smoke.spec.ts:3:1 › la app carga y muestra las cuatro pestañas de navegación (340ms)
  ✓ e2e/sync-paginacion-interrumpida.spec.ts:16:1 › reanuda tras un corte de red a mitad de la paginación de /sync/pull (3.0s)
4 passed (12.3s)
```

`git status --short` limpio y `git log --oneline` con un commit por fase,
tal como exige la sección 2. No hay `TODO`, `FIXME`, pruebas `skip` ni
funciones vacías en `app/src` ni en `server/geo` (verificado por
inspección al cerrar cada fase).

---

## CA-01 — PWA instalable y offline al 100%

**Cumplido.** `vite-plugin-pwa` genera manifest y service worker
(Workbox); `app/e2e/offline-total.spec.ts` carga la app en línea una vez,
corta la red con `context.setOffline(true)` y recarga, navegando las
cuatro superficies y creando una captura sin red.

- Comando: `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test offline-total`
- Prueba: `app/e2e/offline-total.spec.ts` — *funciona completamente offline tras la primera carga*
- Salida: `✓ e2e/offline-total.spec.ts:7:1 › funciona completamente offline tras la primera carga (715ms)` — `1 passed`

## CA-02 — Captura de fricción mínima

**Cumplido.** Persiste en Dexie con sello temporal, `device_id` y
`estado: 'capturado'`; la clasificación heurística no está en el camino
crítico de guardado.

- Comando: `npx vitest run src/datos/capturas.test.ts --reporter=verbose`
- Prueba: `src/datos/capturas.test.ts`
- Salida:
  ```
  ✓ crearCaptura — CA-02 > persiste en Dexie en menos de 1500ms, con sello temporal, device_id y estado capturado 27ms
  ✓ crearCaptura — CA-02 > encola un evento captura_creada para sincronización 9ms
  ✓ crearCaptura — CA-02 > el texto persistido es idéntico al ingresado, sin alteración 5ms
  ```

## CA-03 — Bitácora append-only

**Cumplido** en ambos lados.

- Comando servidor: `./.venv/bin/python -m pytest -q -v tests/test_evento_append_only.py`
- Prueba: `server/tests/test_evento_append_only.py` — `test_update_sobre_evento_es_rechazado`, `test_delete_sobre_evento_es_rechazado`
- Salida: `tests/test_evento_append_only.py ..` — 2 passed. El disparador SQLite
  lanza `IntegrityError: evento es append-only` ante `UPDATE` o `DELETE`.
- Comando cliente: `npx vitest run src/test/invariantes.test.ts --reporter=verbose`
- Prueba: `src/test/invariantes.test.ts` — *RepositorioEventos no expone actualizar/eliminar/update/delete/put*
- Salida: `✓ CA-03 (cliente) — el repositorio de eventos no permite modificar ni borrar` — passed

## CA-04 — Interrupción y reanudación

**Cumplido.** Marcador de reanudación persistente, emergente registrado
como trabajo real (25 min), evidencia del bloque original intacta.

- Comando: `npx vitest run src/datos/actividades.test.ts --reporter=verbose`
- Prueba: `src/datos/actividades.test.ts` — *reproduce la secuencia iniciar -> interrumpir -> emergente -> reanudar del escenario canónico*
- Salida: `✓ ciclo de interrupción y reanudación — CA-04 > reproduce la secuencia... 41ms` — passed
- Verificación end-to-end adicional: `escenario-canonico.spec.ts` reproduce
  exactamente esta secuencia contra un servidor real (ver CA-12).

## CA-05 — Capacidad de absorción real

**Cumplido.** El planificador nunca excede `capacidad_total −
buffer_restante`; el emergente ya registrado reduce el buffer antes de
programar.

- Comando: `npx vitest run src/dominio/planificador.test.ts --reporter=verbose`
- Prueba: `src/dominio/planificador.test.ts` — *CA-05 — capacidad de absorción real*
- Salida:
  ```
  ✓ CA-05 — capacidad de absorción real > nunca programa por encima de capacidad_total - buffer_restante 1ms
  ✓ CA-05 — capacidad de absorción real > minutos emergentes ya registrados reducen el buffer restante y liberan capacidad 0ms
  ```
  El caso incluye una candidata rechazada explícitamente con el código
  `PROTEGIDO_BUFFER_ABSORCION`.

## CA-06 — Planificador determinista y explicable

**Cumplido.**

- Comando: `npx vitest run src/dominio/planificador.test.ts --reporter=verbose`
- Prueba: `src/dominio/planificador.test.ts` — *CA-06 — determinismo del planificador*
- Salida:
  ```
  ✓ CA-06 — determinismo del planificador > el mismo resultado (serializado) sale de 100 barajados del orden de entrada 9ms
  ✓ CA-06 — determinismo del planificador > cada bloque y cada no-programada llevan un código del vocabulario cerrado 0ms
  ```
  Los eventos fijos nunca se mueven (`nunca mueve los eventos fijos`, passed).

## CA-07 — Trámites versionados con próxima acción

**Cumplido** a nivel de motor de dominio, probado y determinista.

- Comando: `npx vitest run src/dominio/tramites.test.ts --reporter=verbose`
- Prueba: `src/dominio/tramites.test.ts` — `app/src/dominio/tramites.ts` (`proximaAccion`)
- Salida:
  ```
  ✓ proximaAccion — CA-07 > la primera etapa pendiente es la próxima acción cuando nada se ha completado 3ms
  ✓ proximaAccion — CA-07 > avanza a la siguiente etapa una vez completada la anterior 1ms
  ✓ proximaAccion — CA-07 > marca bloqueada por dependencia si la etapa previa no está completa 0ms
  ✓ proximaAccion — CA-07 > no hay próxima acción cuando todas las etapas están completas 0ms
  ✓ proximaAccion — CA-07 > es determinista sin importar el orden de entrada de las etapas 1ms
  ```
  **Limitación honesta**: no existe formulario en la UI para crear tipos
  de trámite ni instancias (ver `docs/PENDIENTES_HUMANO.md`). El
  escenario canónico (sección 13) no usa trámites, así que esto no
  bloquea CA-12, pero el criterio queda parcialmente cumplido: el motor
  está completo y probado, la superficie de captura de trámites no.

## CA-08 — Espera con revisión obligatoria y sin descarte silencioso

**Cumplido.**

- Comando: `npx vitest run src/dominio/estados.test.ts --reporter=verbose`
- Prueba: `src/dominio/estados.test.ts` — *aplicarDecisionCierre — invariante 4*
- Salida:
  ```
  ✓ transicionarEstado — esperando > calcula fecha_revision por defecto a 5 días hábiles si no se aporta 3ms
  ✓ aplicarDecisionCierre — invariante 4 (sin descarte silencioso) > rechaza cualquier entrada que no sea una de las seis decisiones 1ms
  ✓ aplicarDecisionCierre — invariante 4 (sin descarte silencioso) > posponer sin fecha sigue siendo rechazado incluso pasando por la decisión de cierre 1ms
  ```
  La prueba intenta descartar (`{tipo:'ocultar'}`, `undefined`, `{}`) y
  `aplicarDecisionCierre` rechaza todo lo que no sea una de las seis
  decisiones válidas, lanzando `TransicionInvalidaError`.

## CA-09 — Cuotas de iniciativa y deuda de progreso

**Cumplido**, probado en ambos sentidos.

- Comando: `npx vitest run src/dominio/planificador.test.ts --reporter=verbose`
- Prueba: `src/dominio/planificador.test.ts` — *CA-09 — cuotas de iniciativa y deuda de progreso*
- Salida:
  ```
  ✓ CA-09 — cuotas de iniciativa y deuda de progreso > reserva CUOTA_INICIATIVA cuando falta cuota semanal y quedan >=2 días hábiles 0ms
  ✓ CA-09 — cuotas de iniciativa y deuda de progreso > una urgencia que vence hoy puede desalojar la reserva y registra deuda 0ms
  ```
  Nota de trazabilidad: la lógica de cuotas vive dentro de
  `app/src/dominio/planificador.ts` (no en un archivo `iniciativas.ts`
  separado como sugería el borrador inicial de requisitos).

## CA-10 — Radar con las siete reglas

**Cumplido**, una prueba positiva y una negativa por regla.

- Comando: `npx vitest run src/dominio/radar.test.ts --reporter=verbose`
- Prueba: `src/dominio/radar.test.ts`
- Salida (14 pruebas, dos por regla, todas passed):
  ```
  ✓ SIN_MOVIMIENTO > detecta un elemento abierto sin eventos en >= 7 días 3ms
  ✓ ESPERA_VENCIDA > detecta esperando con fecha_revision pasada 0ms
  ✓ POSPUESTO_REITERADO > detecta >=3 reprogramaciones en 30 días 0ms
  ✓ ACTIVIDAD_SIN_CIERRE > detecta una actividad iniciada hace > 12 horas sin finalizar 0ms
  ✓ INICIATIVA_SIN_AVANCE > detecta cuota incumplida con deuda sobre el umbral 1ms
  ✓ CAPTURA_SIN_PROCESAR > detecta una captura de más de 48 horas 0ms
  ✓ VENCIMIENTO_INALCANZABLE > detecta cuando el trabajo pendiente excede la capacidad disponible 1ms
  ```

## CA-11 — Sincronización entre dos dispositivos

**Cumplido.**

- Comando: `./.venv/bin/python -m pytest -q -v tests/test_evento_append_only.py tests/test_sync_dos_dispositivos.py tests/test_sync_idempotencia.py tests/test_sync_paginacion_reanudable.py tests/test_fusion.py tests/test_fusion_paridad.py`
- Pruebas: `server/tests/test_sync_dos_dispositivos.py`,
  `test_sync_idempotencia.py`, `test_sync_paginacion_reanudable.py`,
  `test_fusion.py`, `test_fusion_paridad.py`
- Salida: `16 passed, 1 warning in 1.36s`
- Idempotencia real de extremo a extremo, reenvío del último lote vía
  HTTP: verificación 6 del escenario canónico (ver CA-12).
- Paginación cortada a mitad de página, con corte de red real
  (`page.route().abort()`), no un doble de `SyncAdapter`:
  - Comando: `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test sync-paginacion-interrumpida`
  - Prueba: `app/e2e/sync-paginacion-interrumpida.spec.ts`
  - Salida: `✓ reanuda tras un corte de red a mitad de la paginación de /sync/pull (3.0s)` — `1 passed`
- **Bug de regresión encontrado y corregido durante esta verificación**:
  `servicio.pull()` devolvía el contador global del servidor como
  `server_seq` de la página, en vez del mayor `server_seq` de los items
  efectivamente entregados; con más datos que el límite de una página
  esto saltaba páginas intermedias. Prueba de regresión:
  `test_server_seq_de_la_pagina_no_es_el_contador_global`.

## CA-12 — Escenario canónico end-to-end

**Cumplido**, contra un servidor FastAPI real (no simulado), con dos
contextos de navegador reales.

- Comando: `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test escenario-canonico`
- Prueba: `app/e2e/escenario-canonico.spec.ts`
- Salida: `✓ e2e/escenario-canonico.spec.ts:30:1 › escenario-canonico (4.1s)` — `1 passed` (confirmado estable en 5 corridas consecutivas)
- Las ocho verificaciones finales de la sección 13, todas dentro de esta
  única prueba: bitácora íntegra de A (los cuatro tipos de evento
  presentes), visibilidad cruzada de asignaciones, convergencia de
  `prioridad` a `2` (media) y `duracion_estimada_min` a `120` en ambos
  dispositivos, exactamente un conflicto abierto sobre `prioridad` con
  `valor_perdedor: 4` (crítica, de B) conservado y consultado vía
  `GET /sync/conflictos`, reenvío del último lote de A vía HTTP real con
  todos los elementos clasificados como duplicados y sin cambio de
  `server_seq`, marcador de reanudación visible en HOY como parte del
  remanente replanificado, y paridad exacta entre el conteo de eventos
  mostrado en BITÁCORA y las filas exportadas a JSON y CSV (descarga real
  interceptada con `page.waitForEvent('download')`).
- Indicador de almacenamiento persistente verificado en ambos estados
  (`navigator.storage.persist`/`persisted` fijados por dispositivo vía
  `addInitScript`): "concedido" en A, "no concedido" en B.

---

## Bugs reales encontrados durante la verificación (no ocultados)

1. **Reloj en UTC en vez de hora de Costa Rica** (`RelojSistema.ahora()`
   devolvía `new Date().toISOString()`, con sufijo "Z"). Rompía toda
   extracción de fecha/hora local por subcadena en el planificador.
   Corregido con un formateador propio vía `Intl.DateTimeFormat`; prueba
   en `app/src/puertos/relojSistema.test.ts`.
2. **Eventos de creación de otro dispositivo nunca materializaban la
   entidad local** — el dispositivo receptor nunca veía lo creado por el
   emisor. Corregido con `materializarSiEsCreacion` en
   `app/src/sync/outbox.ts`; prueba dedicada en `outbox.test.ts`.
3. **Los conflictos generados en el servidor nunca llegaban al cliente**
   (no viajan como evento ni como cambio). Se añadió
   `SyncAdapter.conflictosAbiertos()` y su consumo al final de
   `sincronizar()`.
4. **`server_seq` de página vs. contador global** en `/sync/pull` (ver
   CA-11) — el más serio de los cuatro, porque silenciosamente perdía
   páginas completas de la bitácora en bases de datos más grandes que el
   límite de una sola página.
5. **El job de CI "End-to-end — Playwright" fallaba solo en GitHub
   Actions**, nunca en desarrollo, con `Timed out waiting Nms from
   config.webServer` sin ningún rastro de causa. Diagnóstico con
   `DEBUG=pw:webserver` (documentado ahora como paso permanente del job):
   los dos `webServer` del array se arrancan secuencialmente — Playwright
   espera un `200` del primero antes de arrancar el segundo. Sin
   `--host` explícito, `vite preview` deja que Node resuelva el string
   `localhost`, cuyo orden de direcciones IPv4/IPv6 no está garantizado
   igual entre el runner de GitHub Actions y un entorno de desarrollo: el
   proceso quedaba escuchando (imprimía su propio banner) pero el
   chequeo de salud de Playwright contra `127.0.0.1:4173` nunca recibía
   respuesta, así que el servidor real (uvicorn) jamás llegaba a
   arrancar. Corregido fijando `--host 127.0.0.1` en el comando de
   `preview`, igual que ya se hacía con `uvicorn`.

Los primeros cuatro se encontraron precisamente porque el escenario
canónico se verificó contra un servidor real y no contra dobles de
prueba; el quinto, porque el pipeline de CI se verificó ejecutándolo de
verdad en GitHub Actions y no asumiendo que "pasa en desarrollo" bastaba
— es la misma justificación práctica extendida a la infraestructura de
verificación, no solo al dominio (sección 17).

## Trazabilidad de archivos

Ver `docs/requisitos/CA-01.md` … `CA-12.md` para el detalle de cada
criterio y `docs/adr/` para las decisiones de diseño que subyacen a
varias de estas pruebas (fusión por campo, separación evento/entidad,
planificador greedy, puertos reservados).
