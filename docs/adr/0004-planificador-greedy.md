# 0004 — Planificador greedy determinista, no óptimo

## Contexto

Programar el día es NP-difícil en general (empaquetamiento con
dependencias, indivisibilidad y prioridades). GEO necesita un resultado
explicable y estable, no el óptimo matemático.

## Decisión

Algoritmo greedy de primer-ajuste sobre una clave de orden totalmente
determinista (vence-hoy, holgura, prioridad, deuda de iniciativa,
duración, id). Cada colocación y cada rechazo llevan un código de un
vocabulario cerrado. Se renuncia a optimalidad global a cambio de
explicabilidad y de la prueba de determinismo por barajado (CA-06).

## Consecuencias

Puede haber acomodos mejores que el planificador no encuentra. Es
aceptable: el objetivo funcional es que el usuario confíe en el porqué de
cada bloque, no que el algoritmo sea óptimo.

## Alternativas descartadas

Programación por restricciones (CSP/ILP): mayor calidad de solución pero
mucho más difícil de explicar en lenguaje natural y de depurar bajo
presión de tiempo de campo.
