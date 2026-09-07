// CA-07: crear un tipo de trámite versionado (etapas con dependencias y
// plazos relativos en días hábiles), instanciarlo como trámite y marcar
// etapas completadas. El motor de próxima acción (dominio/tramites.ts)
// ya está cerrado y probado; este archivo solo persiste y emite los
// eventos de creación que lo alimentan.

import type { EtapaTramite, EventoGEO, PasoTramite, Tramite, TipoTramite } from '../dominio/tipos'
import type { GeoDexie } from './db'
import { encolarEvento } from '../sync/outbox'

export interface DependenciasEscrituraTramites {
  db: GeoDexie
  deviceId: string
  ahoraISO: () => string
  siguienteClientSequenceEvento: () => Promise<number>
}

export interface DatosNuevoTipoTramite {
  nombre: string
  etapas: EtapaTramite[]
}

export async function crearTipoTramite(
  deps: DependenciasEscrituraTramites,
  datos: DatosNuevoTipoTramite,
): Promise<TipoTramite> {
  const ahora = deps.ahoraISO()
  const id = crypto.randomUUID()
  const tipo: TipoTramite = {
    id,
    version_id: crypto.randomUUID(),
    field_meta: {},
    eliminado: false,
    nombre: datos.nombre,
    version: 1,
    etapas: datos.etapas,
  }
  await deps.db.tiposTramite.add(tipo)

  const evento: EventoGEO = {
    event_id: crypto.randomUUID(),
    entity_type: 'tipo_tramite',
    entity_id: id,
    event_type: 'tipo_tramite_creado',
    occurred_at: ahora,
    recorded_at: ahora,
    device_id: deps.deviceId,
    client_sequence: await deps.siguienteClientSequenceEvento(),
    base_version: null,
    payload: {
      nombre: tipo.nombre,
      version: tipo.version,
      etapas: tipo.etapas,
    },
    server_seq: null,
  }
  await encolarEvento(deps.db, evento)

  return tipo
}

export interface DatosNuevoTramite {
  tipoTramiteId: string
  tipoTramiteVersion: number
  titulo: string
  fechaInicio: string
}

export async function crearTramite(
  deps: DependenciasEscrituraTramites,
  datos: DatosNuevoTramite,
): Promise<Tramite> {
  const ahora = deps.ahoraISO()
  const id = crypto.randomUUID()
  const tramite: Tramite = {
    id,
    version_id: crypto.randomUUID(),
    field_meta: {},
    eliminado: false,
    tipo_tramite_id: datos.tipoTramiteId,
    tipo_tramite_version: datos.tipoTramiteVersion,
    titulo: datos.titulo,
    etapa_actual_id: null,
    fecha_inicio: datos.fechaInicio,
  }
  await deps.db.tramites.add(tramite)

  const evento: EventoGEO = {
    event_id: crypto.randomUUID(),
    entity_type: 'tramite',
    entity_id: id,
    event_type: 'tramite_creado',
    occurred_at: ahora,
    recorded_at: ahora,
    device_id: deps.deviceId,
    client_sequence: await deps.siguienteClientSequenceEvento(),
    base_version: null,
    payload: {
      tipo_tramite_id: tramite.tipo_tramite_id,
      tipo_tramite_version: tramite.tipo_tramite_version,
      titulo: tramite.titulo,
      etapa_actual_id: tramite.etapa_actual_id,
      fecha_inicio: tramite.fecha_inicio,
    },
    server_seq: null,
  }
  await encolarEvento(deps.db, evento)

  return tramite
}

/** Completar una etapa es lo único que instancia su PasoTramite: la
 * ausencia de fila para una etapa ya significa "pendiente"
 * (dominio/tramites.ts), así que no hay un paso "creado" por separado. */
export async function completarPasoTramite(
  deps: DependenciasEscrituraTramites,
  tramiteId: string,
  etapaId: string,
): Promise<PasoTramite> {
  const ahora = deps.ahoraISO()
  const id = crypto.randomUUID()
  const paso: PasoTramite = {
    id,
    version_id: crypto.randomUUID(),
    field_meta: {},
    eliminado: false,
    tramite_id: tramiteId,
    etapa_id: etapaId,
    estado: 'completado',
    completado_en: ahora,
  }
  await deps.db.pasosTramite.add(paso)

  const evento: EventoGEO = {
    event_id: crypto.randomUUID(),
    entity_type: 'paso_tramite',
    entity_id: id,
    event_type: 'paso_completado',
    occurred_at: ahora,
    recorded_at: ahora,
    device_id: deps.deviceId,
    client_sequence: await deps.siguienteClientSequenceEvento(),
    base_version: null,
    payload: {
      tramite_id: paso.tramite_id,
      etapa_id: paso.etapa_id,
      estado: paso.estado,
      completado_en: paso.completado_en,
    },
    server_seq: null,
  }
  await encolarEvento(deps.db, evento)

  return paso
}
