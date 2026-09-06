# 0001 — Separación estricta entre evento y entidad

## Contexto

GEO necesita que ningún compromiso desaparezca y que la evidencia de lo
ocurrido sea confiable incluso bajo sincronización concurrente entre
dispositivos.

## Decisión

Dos modelos de datos disjuntos desde el primer commit: una corriente de
`evento` append-only (hechos históricos inmutables, tabla y ruta de
escritura propias) y un conjunto de entidades mutables con
`version_id`/`field_meta` para fusión por campo. Ninguna tabla combina
ambos; ningún código de dominio escribe eventos con `UPDATE`/`DELETE`.

## Consecuencias

Toda transición de estado se expresa dos veces: como cambio de campo en
la entidad (para consultar el estado actual) y como evento (para
reconstruir el historial). Esto duplica escritura pero hace el invariante
1 verificable mecánicamente con disparadores SQLite y con ausencia de
métodos de escritura en el repositorio Dexie de eventos.

## Alternativas descartadas

Event sourcing puro (reconstruir todo el estado por reproducción de
eventos): descartado por costo de implementación en v0.1 y porque la UI
necesita lecturas rápidas del estado actual sin recalcular sobre miles de
eventos en cada render.
