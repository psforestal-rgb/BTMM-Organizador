// Creación y edición de asignaciones. Crear emite un evento
// (asignacion_creada); editar un campo viaja como "cambio" (sección 5.3)
// para poder fusionarse por campo si dos dispositivos editan sin red.

import type { Asignacion, Carril, EventoGEO } from '../dominio/tipos'
import type { GeoDexie } from './db'
import { encolarCambio, encolarEvento, type CambioGEO } from '../sync/outbox'

export interface DependenciasEscritura {
  db: GeoDexie
  deviceId: string
  ahoraISO: () => string
  siguienteClientSequenceEvento: () => Promise<number>
  siguienteClientSequenceCambio: () => Promise<number>
}

export interface DatosNuevaAsignacion {
  titulo: string
  carril: Carril
  duracionEstimadaMin: number
  vencimiento: string | null
  prioridad: 1 | 2 | 3 | 4
  indivisible: boolean
  contexto?: string | null
  iniciativaId?: string | null
}

export async function crearAsignacion(
  deps: DependenciasEscritura,
  datos: DatosNuevaAsignacion,
): Promise<Asignacion> {
  const ahora = deps.ahoraISO()
  const id = crypto.randomUUID()
  const asignacion: Asignacion = {
    id,
    version_id: crypto.randomUUID(),
    field_meta: {},
    eliminado: false,
    titulo: datos.titulo,
    carril: datos.carril,
    duracion_estimada_min: datos.duracionEstimadaMin,
    vencimiento: datos.vencimiento,
    prioridad: datos.prioridad,
    indivisible: datos.indivisible,
    dependencias: [],
    contexto: datos.contexto ?? null,
    iniciativa_id: datos.iniciativaId ?? null,
    tramite_id: null,
    estado: 'programado',
    fecha_revision: null,
    fecha_pospuesto: null,
    motivo: null,
  }
  await deps.db.asignaciones.add(asignacion)

  const evento: EventoGEO = {
    event_id: crypto.randomUUID(),
    entity_type: 'asignacion',
    entity_id: id,
    event_type: 'asignacion_creada',
    occurred_at: ahora,
    recorded_at: ahora,
    device_id: deps.deviceId,
    client_sequence: await deps.siguienteClientSequenceEvento(),
    base_version: null,
    payload: {
      titulo: asignacion.titulo,
      carril: asignacion.carril,
      duracion_estimada_min: asignacion.duracion_estimada_min,
      vencimiento: asignacion.vencimiento,
      prioridad: asignacion.prioridad,
      indivisible: asignacion.indivisible,
      dependencias: asignacion.dependencias,
      contexto: asignacion.contexto,
      iniciativa_id: asignacion.iniciativa_id,
      tramite_id: asignacion.tramite_id,
      estado: asignacion.estado,
    },
    server_seq: null,
  }
  await encolarEvento(deps.db, evento)

  return asignacion
}

export async function cambiarCampoAsignacion(
  deps: DependenciasEscritura,
  asignacionId: string,
  campos: Record<string, unknown>,
): Promise<void> {
  const ahora = deps.ahoraISO()
  const cambio: CambioGEO = {
    change_id: crypto.randomUUID(),
    entity_type: 'asignacion',
    entity_id: asignacionId,
    device_id: deps.deviceId,
    client_sequence: await deps.siguienteClientSequenceCambio(),
    occurred_at: ahora,
    base_version: null,
    campos,
    campo_ts: Object.fromEntries(Object.keys(campos).map((campo) => [campo, ahora])),
  }
  await encolarCambio(deps.db, cambio, 'asignaciones')
}
