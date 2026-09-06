// Tipos del modelo de datos (sección 5). Los nombres de campo son
// snake_case a propósito: cruzan la red tal cual hacia/desde el servidor
// y deben coincidir letra por letra con geo/datos/modelos.py y con las
// claves de "campos"/"campo_ts" del protocolo de sincronización (ADR 0002).
// Este archivo no depende de Dexie ni de fetch: son tipos puros.

export type EventType =
  | 'captura_creada'
  | 'captura_procesada'
  | 'actividad_iniciada'
  | 'actividad_finalizada'
  | 'actividad_interrumpida'
  | 'actividad_reanudada'
  | 'emergente_registrado'
  | 'asignacion_creada'
  | 'asignacion_reprogramada'
  | 'estado_cambiado'
  | 'paso_completado'
  | 'espera_iniciada'
  | 'espera_revisada'
  | 'iniciativa_avance_registrado'
  | 'iniciativa_deuda_registrado'
  | 'jornada_iniciada'
  | 'jornada_cerrada'
  | 'decision_de_cierre'
  | 'conflicto_detectado'
  | 'conflicto_resuelto'

export interface EventoGEO {
  event_id: string
  entity_type: string
  entity_id: string
  event_type: EventType
  occurred_at: string
  recorded_at: string
  device_id: string
  client_sequence: number
  base_version: string | null
  payload: Record<string, unknown>
  server_seq: number | null
}

export type Carril = 'reactivo' | 'tramite' | 'planificado' | 'iniciativa'
export type EstadoElemento =
  | 'hecho'
  | 'programado'
  | 'esperando'
  | 'pospuesto'
  | 'bloqueado'
  | 'cancelado'

export interface FieldMetaEntrada {
  updated_at: string
  device_id: string
}

export type FieldMeta = Record<string, FieldMetaEntrada>

export interface EntidadMutable {
  id: string
  version_id: string
  field_meta: FieldMeta
  eliminado: boolean
}

export interface Captura extends EntidadMutable {
  texto: string
  estado: 'capturado' | 'procesado'
  device_id: string
  creado_en: string
}

export interface Asignacion extends EntidadMutable {
  titulo: string
  carril: Carril
  duracion_estimada_min: number
  vencimiento: string | null
  prioridad: 1 | 2 | 3 | 4
  indivisible: boolean
  dependencias: string[]
  contexto: string | null
  iniciativa_id: string | null
  tramite_id: string | null
  estado: EstadoElemento
  fecha_revision: string | null
  fecha_pospuesto: string | null
  motivo: string | null
}

export interface Actividad extends EntidadMutable {
  asignacion_id: string | null
  carril: Carril
  estado: 'en_curso' | 'interrumpida' | 'finalizada'
  marcador_reanudacion: string | null
  iniciada_en: string
  finalizada_en: string | null
  minutos_reales: number | null
}

export interface Interrupcion extends EntidadMutable {
  actividad_id: string
  marcador_reanudacion: string
  inicio: string
  fin: string | null
}

export interface EtapaTramite {
  id: string
  nombre: string
  orden: number
  condiciones: string[]
  dependencias: string[]
  plazo_dias_habiles: number
  producto: string
}

export interface TipoTramite extends EntidadMutable {
  nombre: string
  version: number
  etapas: EtapaTramite[]
}

export interface Tramite extends EntidadMutable {
  tipo_tramite_id: string
  tipo_tramite_version: number
  titulo: string
  etapa_actual_id: string | null
  fecha_inicio: string
}

export interface PasoTramite extends EntidadMutable {
  tramite_id: string
  etapa_id: string
  estado: 'pendiente' | 'completado'
  completado_en: string | null
}

export interface Iniciativa extends EntidadMutable {
  titulo: string
  cuota_semanal_min: number
  minutos_ejecutados_semana: number
  deuda_min: number
  semana_referencia: string
}

export interface EventoFijo extends EntidadMutable {
  titulo: string
  fecha: string
  inicio: string
  fin: string
  tipo: 'reunion' | 'jornada' | 'otro'
}

export interface BloqueAgenda extends EntidadMutable {
  fecha: string
  candidata_id: string | null
  inicio: string
  fin: string
  justificacion_codigo: string
  justificacion_texto: string
}

export interface Seguimiento extends EntidadMutable {
  entidad_tipo: string
  entidad_id: string
  fecha_revision: string
  notas: string | null
}

export interface Conflicto extends EntidadMutable {
  entity_type: string
  entity_id: string
  campo: string
  valor_ganador: unknown
  device_ganador: string
  ts_ganador: string
  valor_perdedor: unknown
  device_perdedor: string
  ts_perdedor: string
  resuelto: boolean
}

export interface Dispositivo extends EntidadMutable {
  nombre: string
}

export interface Configuracion extends EntidadMutable {
  buffer_absorcion_min: number
  dias_revision_espera: number
}
