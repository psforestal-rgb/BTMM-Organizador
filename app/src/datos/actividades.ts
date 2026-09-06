// Ciclo de vida de una actividad: iniciar, interrumpir, reanudar,
// finalizar; y el registro del emergente que produjo la interrupción
// (sección 3 y CA-04). Cada transición persiste local y emite el evento
// correspondiente del vocabulario cerrado.

import type { Actividad, Carril, EventoGEO, Interrupcion } from '../dominio/tipos'
import { diferenciaEnMs } from '../dominio/marcaTemporal'
import { encolarEvento } from '../sync/outbox'
import type { DependenciasEscritura } from './asignaciones'

async function emitir(
  deps: DependenciasEscritura,
  entityId: string,
  eventType: EventoGEO['event_type'],
  payload: Record<string, unknown>,
): Promise<void> {
  const ahora = deps.ahoraISO()
  const evento: EventoGEO = {
    event_id: crypto.randomUUID(),
    entity_type: 'actividad',
    entity_id: entityId,
    event_type: eventType,
    occurred_at: ahora,
    recorded_at: ahora,
    device_id: deps.deviceId,
    client_sequence: await deps.siguienteClientSequenceEvento(),
    base_version: null,
    payload,
    server_seq: null,
  }
  await encolarEvento(deps.db, evento)
}

export async function iniciarActividad(
  deps: DependenciasEscritura,
  asignacionId: string,
  carril: Carril,
): Promise<Actividad> {
  const ahora = deps.ahoraISO()
  const id = crypto.randomUUID()
  const actividad: Actividad = {
    id,
    version_id: crypto.randomUUID(),
    field_meta: {},
    eliminado: false,
    asignacion_id: asignacionId,
    carril,
    estado: 'en_curso',
    marcador_reanudacion: null,
    iniciada_en: ahora,
    finalizada_en: null,
    minutos_reales: null,
  }
  await deps.db.actividades.add(actividad)
  await emitir(deps, id, 'actividad_iniciada', { asignacion_id: asignacionId, iniciada_en: ahora })
  return actividad
}

export async function finalizarActividad(deps: DependenciasEscritura, actividadId: string): Promise<void> {
  const ahora = deps.ahoraISO()
  const actividad = await deps.db.actividades.get(actividadId)
  if (!actividad) throw new Error(`No existe la actividad ${actividadId}`)
  const minutosReales = Math.round(diferenciaEnMs(ahora, actividad.iniciada_en) / 60000)
  await deps.db.actividades.update(actividadId, {
    estado: 'finalizada',
    finalizada_en: ahora,
    minutos_reales: minutosReales,
  })
  await emitir(deps, actividadId, 'actividad_finalizada', { finalizada_en: ahora, minutos_reales: minutosReales })
}

export async function interrumpirActividad(
  deps: DependenciasEscritura,
  actividadId: string,
  marcadorReanudacion: string,
): Promise<Interrupcion> {
  const ahora = deps.ahoraISO()
  await deps.db.actividades.update(actividadId, {
    estado: 'interrumpida',
    marcador_reanudacion: marcadorReanudacion,
  })
  const interrupcion: Interrupcion = {
    id: crypto.randomUUID(),
    version_id: crypto.randomUUID(),
    field_meta: {},
    eliminado: false,
    actividad_id: actividadId,
    marcador_reanudacion: marcadorReanudacion,
    inicio: ahora,
    fin: null,
  }
  await deps.db.interrupciones.add(interrupcion)
  await emitir(deps, actividadId, 'actividad_interrumpida', {
    marcador_reanudacion: marcadorReanudacion,
    inicio: ahora,
  })
  return interrupcion
}

/** Se llama cuando el emergente termina: cierra la interrupción, registra
 * el intervalo como trabajo real (emergente_registrado) y deja la
 * actividad original lista para reanudarse mostrando el marcador. */
export async function registrarFinDeEmergente(
  deps: DependenciasEscritura,
  interrupcionId: string,
  tituloEmergente: string,
  carril: Carril,
): Promise<Actividad> {
  const ahora = deps.ahoraISO()
  const interrupcion = await deps.db.interrupciones.get(interrupcionId)
  if (!interrupcion) throw new Error(`No existe la interrupción ${interrupcionId}`)
  await deps.db.interrupciones.update(interrupcionId, { fin: ahora })

  const minutosReales = Math.round(diferenciaEnMs(ahora, interrupcion.inicio) / 60000)
  const id = crypto.randomUUID()
  const emergente: Actividad = {
    id,
    version_id: crypto.randomUUID(),
    field_meta: {},
    eliminado: false,
    asignacion_id: null,
    carril,
    estado: 'finalizada',
    marcador_reanudacion: null,
    iniciada_en: interrupcion.inicio,
    finalizada_en: ahora,
    minutos_reales: minutosReales,
  }
  await deps.db.actividades.add(emergente)
  await emitir(deps, id, 'emergente_registrado', {
    titulo: tituloEmergente,
    inicio: interrupcion.inicio,
    fin: ahora,
    minutos_reales: minutosReales,
  })
  return emergente
}

export async function reanudarActividad(deps: DependenciasEscritura, actividadId: string): Promise<void> {
  const ahora = deps.ahoraISO()
  await deps.db.actividades.update(actividadId, { estado: 'en_curso' })
  await emitir(deps, actividadId, 'actividad_reanudada', { reanudada_en: ahora })
}
