# 0002 — Fusión por campo con desempate determinista

## Contexto

Dos dispositivos sin maestro pueden editar la misma entidad sin conexión.
La sincronización debe converger al mismo resultado en ambos sin
coordinación en tiempo real.

## Decisión

Cada campo lleva `(updated_at, device_id)` en `field_meta`. Al fusionar,
gana la tupla mayor; empate en `updated_at` se resuelve por comparación
lexicográfica de `device_id` (determinista y simétrica). Si el valor
perdedor difiere del ganador y el campo es crítico
(`estado`, `vencimiento`, `prioridad`, `fecha_revision`,
`duracion_estimada_min`), se registra un `conflicto` con ambos valores y
se emite `conflicto_detectado`. El valor perdedor nunca se descarta.

## Consecuencias

La fusión es pura y testeable sin red. El costo es que el cliente y el
servidor deben aplicar exactamente el mismo algoritmo — se implementa una
sola vez en `server/geo/sync/fusion.py` y se traduce línea por línea a
`app/src/sync/fusion.ts`, con una prueba de paridad de tabla de verdad
entre ambos.

## Alternativas descartadas

CRDT genérico: mayor corrección teórica pero mucho mayor costo de
implementación para v0.1; se documenta como posible evolución vía
`SyncAdapter`. Last-write-wins global sin registro de conflicto:
descartado porque viola la prohibición de desaparición silenciosa de
valores.
