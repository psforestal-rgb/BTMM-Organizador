# 0006 — Materialización de creación más allá del sufijo "_creada"

## Contexto

La creación de una entidad mutable se replica entre dispositivos sin un
evento de creación por separado: `materializarSiEsCreacion` (cliente,
`app/src/sync/outbox.ts`) y `_aplicar_evento_creacion` (servidor,
`server/geo/sync/servicio.py`) instancian la fila a partir del `payload`
del evento cuando su `event_type` indica creación. Hasta CA-07, las
únicas entidades creadas así (`captura`, `asignacion`) son sustantivos
femeninos en español, así que ambos lados detectaban creación
comprobando literalmente el sufijo `"_creada"`.

Trámite es masculino (`tramite_creado`, `tipo_tramite_creado`), y
`PasoTramite` no tiene un evento de creación separado: el vocabulario ya
cerrado en Fase 1 solo define `paso_completado`, porque la ausencia de
fila para una etapa ya significa "pendiente" (`dominio/tramites.ts`) —
completar una etapa es lo único que instancia su `PasoTramite`.

## Decisión

Generalizar la detección de creación en ambos lados a: termina en
`"_creada"` **o** `"_creado"`, **o** es literalmente `"paso_completado"`.
La función queda nombrada `indicaCreacionDeEntidad` (cliente) y
`_indica_creacion_de_entidad` (servidor), con el mismo comentario
explicando la excepción en los dos archivos.

## Consecuencias

Ningún evento de creación existente cambia de nombre ni de
comportamiento (la ampliación es solo aditiva); las pruebas de
`asignacion_creada`/`captura_creada` no se tocan. La excepción literal
para `paso_completado` es puntual: si en el futuro se necesita un evento
de creación separado para otra entidad sin sufijo `_creada`/`_creado`,
se añade como otro caso explícito en la misma función, no se vuelve a
generalizar el sufijo.

## Alternativas descartadas

Renombrar `paso_completado` a algo como `paso_tramite_creado` y emitir
un segundo evento (`paso_completado`) para el mismo hecho: duplica el
número de eventos por etapa completada sin aportar información nueva,
y rompe el vocabulario cerrado ya decidido en Fase 1 sin necesidad.
