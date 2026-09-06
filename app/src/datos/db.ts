import Dexie, { type EntityTable } from 'dexie'
import type {
  Actividad,
  Asignacion,
  BloqueAgenda,
  Captura,
  Configuracion,
  Conflicto,
  Dispositivo,
  EventoFijo,
  EventoGEO,
  Iniciativa,
  Interrupcion,
  PasoTramite,
  Seguimiento,
  Tramite,
  TipoTramite,
} from '../dominio/tipos'

export type EstadoOutbox = 'pendiente' | 'enviado' | 'confirmado'

export interface OutboxItem {
  id: string
  tipo: 'evento' | 'cambio'
  payload: unknown
  client_sequence: number
  intentos: number
  ultimo_error: string | null
  estado: EstadoOutbox
}

export interface SyncStateRow {
  device_id: string
  ultimo_server_seq_recibido: number
  ultimo_client_sequence_confirmado: number
  ultima_sync_ok_at: string | null
  ultimo_error: string | null
}

/** Contador de client_sequence, persistente incluso tras purgar el
 * outbox: eventos y cambios llevan cada uno su propio espacio de
 * numeración por dispositivo (ambos monótonos, ninguno se reutiliza). */
export interface ContadorSecuencia {
  clave: string // `${deviceId}:${tipo}`
  valor: number
}

export class GeoDexie extends Dexie {
  eventos!: EntityTable<EventoGEO, 'event_id'>
  outbox!: EntityTable<OutboxItem, 'id'>
  syncState!: EntityTable<SyncStateRow, 'device_id'>
  capturas!: EntityTable<Captura, 'id'>
  asignaciones!: EntityTable<Asignacion, 'id'>
  actividades!: EntityTable<Actividad, 'id'>
  interrupciones!: EntityTable<Interrupcion, 'id'>
  tiposTramite!: EntityTable<TipoTramite, 'id'>
  tramites!: EntityTable<Tramite, 'id'>
  pasosTramite!: EntityTable<PasoTramite, 'id'>
  iniciativas!: EntityTable<Iniciativa, 'id'>
  eventosFijos!: EntityTable<EventoFijo, 'id'>
  bloquesAgenda!: EntityTable<BloqueAgenda, 'id'>
  seguimientos!: EntityTable<Seguimiento, 'id'>
  conflictos!: EntityTable<Conflicto, 'id'>
  dispositivos!: EntityTable<Dispositivo, 'id'>
  configuraciones!: EntityTable<Configuracion, 'id'>
  contadoresSecuencia!: EntityTable<ContadorSecuencia, 'clave'>

  constructor(nombre: string) {
    super(nombre)
    this.version(1).stores({
      eventos: 'event_id, entity_id, &[device_id+client_sequence], server_seq',
      outbox: 'id, estado, client_sequence',
      syncState: 'device_id',
      contadoresSecuencia: 'clave',
      capturas: 'id, estado, creado_en',
      asignaciones: 'id, estado, vencimiento, carril, iniciativa_id',
      actividades: 'id, estado, asignacion_id',
      interrupciones: 'id, actividad_id',
      tiposTramite: 'id',
      tramites: 'id, tipo_tramite_id',
      pasosTramite: 'id, tramite_id',
      iniciativas: 'id, semana_referencia',
      eventosFijos: 'id, fecha',
      bloquesAgenda: 'id, fecha, candidata_id',
      seguimientos: 'id, entidad_id, fecha_revision',
      conflictos: 'id, resuelto, entity_id',
      dispositivos: 'id',
      configuraciones: 'id',
    })
  }
}

export function crearBaseDatos(nombre = 'geo'): GeoDexie {
  return new GeoDexie(nombre)
}
