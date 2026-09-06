// Construye el RadarSnapshot (puro, dominio/radar.ts) a partir de Dexie.
// Este archivo sí puede tocar Dexie: vive en src/datos, no en src/dominio.

import type { RadarSnapshot } from '../dominio/radar'
import type { EstadoElemento } from '../dominio/tipos'
import type { GeoDexie } from './db'

const ESTADOS_ABIERTOS: readonly EstadoElemento[] = [
  'programado',
  'esperando',
  'pospuesto',
  'bloqueado',
]

export async function construirRadarSnapshot(db: GeoDexie): Promise<RadarSnapshot> {
  const [asignaciones, tramites, capturas, actividades, iniciativas, eventos] = await Promise.all([
    db.asignaciones.where('estado').anyOf([...ESTADOS_ABIERTOS]).toArray(),
    db.tramites.toArray(),
    db.capturas.toArray(),
    db.actividades.toArray(),
    db.iniciativas.toArray(),
    db.eventos.toArray(),
  ])

  const ultimoEventoPorEntidad = new Map<string, string>()
  const reprogramaciones: RadarSnapshot['reprogramaciones'] = []
  for (const evento of eventos) {
    const previo = ultimoEventoPorEntidad.get(evento.entity_id)
    if (!previo || evento.recorded_at > previo) {
      ultimoEventoPorEntidad.set(evento.entity_id, evento.recorded_at)
    }
    if (evento.event_type === 'asignacion_reprogramada') {
      reprogramaciones.push({ entidadId: evento.entity_id, ocurridoEn: evento.recorded_at })
    }
  }

  return {
    elementosAbiertos: [
      ...asignaciones.map((a) => ({
        id: a.id,
        tipo: 'asignacion' as const,
        titulo: a.titulo,
        estado: a.estado,
        fechaRevision: a.fecha_revision,
        ultimoEventoAt: ultimoEventoPorEntidad.get(a.id) ?? null,
        minutosPendientesTotales: a.duracion_estimada_min,
        vencimiento: a.vencimiento,
      })),
      ...tramites.map((t) => ({
        id: t.id,
        tipo: 'tramite' as const,
        titulo: t.titulo,
        estado: 'programado' as EstadoElemento,
        fechaRevision: null,
        ultimoEventoAt: ultimoEventoPorEntidad.get(t.id) ?? null,
        minutosPendientesTotales: 0,
        vencimiento: null,
      })),
    ],
    capturas: capturas.map((c) => ({ id: c.id, texto: c.texto, estado: c.estado, creadoEn: c.creado_en })),
    actividades: actividades.map((a) => ({
      id: a.id,
      titulo: a.asignacion_id ?? 'emergente',
      estado: a.estado,
      iniciadaEn: a.iniciada_en,
    })),
    iniciativas: iniciativas.map((i) => ({
      id: i.id,
      titulo: i.titulo,
      cuotaSemanalMin: i.cuota_semanal_min,
      minutosEjecutadosSemana: i.minutos_ejecutados_semana,
      deudaMin: i.deuda_min,
    })),
    reprogramaciones,
  }
}
