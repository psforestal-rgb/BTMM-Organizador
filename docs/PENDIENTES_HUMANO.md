# Pendientes de validación humana

- **Feriados de Costa Rica** (`server/data/feriados_cr.json` y su copia en
  `app/src/dominio/datos/feriados_cr.json`): el campo `fuente` del
  archivo está marcado literalmente `PENDIENTE_VALIDACION_HUMANA`. Las
  fechas son datos de semilla razonables para que el motor de días
  hábiles sea probable, pero su exactitud jurídica (leyes/decretos de
  feriados de pago obligatorio, feriados trasladables al lunes según Ley
  9209) debe ser confirmada por una persona contra la fuente normativa
  vigente antes de cualquier uso real.
- **Política de permisos y ausencias**: el sistema no modela permisos,
  vacaciones ni incapacidades — la jornada declarada en `evento_fijo` es
  la única fuente de "no disponible". Una persona debe decidir si eso
  basta o si se necesita un tipo de entidad propio.
- **Decisiones institucionales pendientes**: el vocabulario de carriles,
  trámites y sitios usa únicamente identificadores opacos de ejemplo
  (`CASO-2026-001`, `Persona A`, `Sitio Alfa`). Cargar tipos de trámite
  reales requiere que una persona los modele y los versiones — no es un
  trabajo de este prototipo.
- **Simplificaciones registradas en ADR**: ver `docs/adr/`. Cualquier ADR
  nuevo que ceda un criterio de aceptación ante un bloqueo real debe
  añadirse a esta lista con su número.
- **CORS abierto (`allow_origins=["*"]`)** en `server/geo/api/main.py`:
  aceptable para un prototipo sin autenticación ni datos personales que
  corre en local, pero debe restringirse a orígenes explícitos antes de
  cualquier despliegue con datos reales.
- **Formulario de trámites**: el motor `app/src/dominio/tramites.ts`
  (próxima acción a partir de etapas y dependencias) está implementado y
  probado, pero no hay una pantalla para crear tipos de trámite ni
  instancias — el escenario canónico no los usa, así que no bloquea
  CA-12, pero es trabajo pendiente antes de un uso real con trámites.
