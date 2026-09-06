# Concepto funcional de GEO

GEO es una memoria operativa externa y un planificador adaptativo, no una
lista de tareas. Principios: offline-first estructural, independencia de
dispositivos sin ningún maestro, captura de fricción mínima, prohibición
de la desaparición silenciosa, separación entre plan y realidad,
planificación por capacidad real, inteligencia artificial asistiva y
nunca crítica, y cero datos personales en esta etapa.

## Cuatro carriles

- **Reactivo o emergente**: atención de usuarios, consultas de jefatura,
  llamadas. Imprevisible, se registra en tiempo real o retrospectivo, y
  consume la capacidad de absorción.
- **Trámites**: procesos con identidad, etapas, condiciones,
  dependencias, plazos relativos en días hábiles y productos. Un trámite
  instancia un tipo de trámite versionado; la interfaz cotidiana muestra
  una única próxima acción.
- **Trabajo planificado**: informes, revisiones GIS, reuniones,
  preparación de campo.
- **Iniciativas propias**: proyectos valiosos sin plazo inmediato,
  protegidos con cuota mínima de progreso semanal y deuda de progreso
  recuperable cuando una urgencia consume su espacio.

## Captura inmediata

Registrar ahora, organizar después: una frase libre basta, recibe sello
temporal, queda marcada como capturada frente a procesada, no puede
perderse por falla de red ni de IA.

## Agenda adaptativa

No llena la jornada al 100%. Reserva una capacidad de absorción
configurable (75 min/día por defecto). Restricciones duras: reuniones,
jornada declarada, dependencias, indivisibilidad. Restricciones blandas:
bloques ≤90 min, alternancia de intensidad, agrupación de gestiones
breves. La replanificación solo mueve lo que está bajo control del
usuario y preserva evidencia de lo desplazado.

## Interrupciones

Un botón guarda un marcador de reanudación en texto libre, registra el
intervalo emergente en la bitácora como trabajo real, y recalcula la
jornada sin borrar evidencia. Al terminar el emergente se ofrece retomar
con el marcador visible.

## Memoria anti-olvido

Cada elemento relevante tiene fecha límite opcional, fecha objetivo
interna, próxima acción y próxima revisión. Estados: hecho, programado,
esperando, pospuesto con fecha, bloqueado, cancelado. Un radar periódico
detecta elementos sin movimiento, pospuestos repetidamente, en espera sin
revisión vigente, actividades iniciadas sin cerrar e iniciativas sin
avance. Pregunta central: "¿qué se me puede estar pasando?".

## Experiencia diaria

Inicio de jornada: síntesis accionable en <2 min. Durante el día: qué
hago ahora, qué sigue, cómo capturo. Cierre: una decisión por cada
elemento abierto, genera el borrador del día siguiente.

## Offline y sincronización

Toda función esencial opera sin red tras la primera carga. Base local
IndexedDB. Sincronización eventual, incremental, reanudable. Bitácora
append-only con id único; entidades editables se fusionan campo por
campo; conflictos en campos críticos se marcan para revisión sin destruir
el valor perdedor. Estado de sincronización siempre visible.
