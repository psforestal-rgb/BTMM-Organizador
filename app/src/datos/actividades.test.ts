import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { crearBaseDatos, type GeoDexie } from './db'
import { creadorDeSecuencia } from './secuencia'
import type { DependenciasEscritura } from './asignaciones'
import {
  finalizarActividad,
  iniciarActividad,
  interrumpirActividad,
  reanudarActividad,
  registrarFinDeEmergente,
} from './actividades'

const DEVICE_ID = 'DISPOSITIVO-A'

describe('ciclo de interrupción y reanudación — CA-04', () => {
  let db: GeoDexie
  let reloj: string

  function deps(): DependenciasEscritura {
    return {
      db,
      deviceId: DEVICE_ID,
      ahoraISO: () => reloj,
      siguienteClientSequenceEvento: creadorDeSecuencia(db, DEVICE_ID, 'evento'),
      siguienteClientSequenceCambio: creadorDeSecuencia(db, DEVICE_ID, 'cambio'),
    }
  }

  beforeEach(() => {
    db = crearBaseDatos(`geo-actividades-${crypto.randomUUID()}`)
    reloj = '2026-09-08T08:35:00-06:00'
  })

  afterEach(async () => {
    await db.delete()
  })

  it('reproduce la secuencia iniciar -> interrumpir -> emergente -> reanudar del escenario canónico', async () => {
    const asignacionId = crypto.randomUUID()
    const actividad = await iniciarActividad(deps(), asignacionId, 'planificado')
    expect(actividad.estado).toBe('en_curso')

    reloj = '2026-09-08T08:45:00-06:00'
    const interrupcion = await interrumpirActividad(
      deps(),
      actividad.id,
      'me quedé comparando vértices 11-17',
    )
    const actividadInterrumpida = await db.actividades.get(actividad.id)
    expect(actividadInterrumpida?.estado).toBe('interrumpida')
    expect(actividadInterrumpida?.marcador_reanudacion).toBe('me quedé comparando vértices 11-17')

    reloj = '2026-09-08T09:10:00-06:00'
    const emergente = await registrarFinDeEmergente(
      deps(),
      interrupcion.id,
      'atención de usuario en ventanilla',
      'reactivo',
    )
    expect(emergente.minutos_reales).toBe(25)
    expect(emergente.asignacion_id).toBeNull()

    const interrupcionCerrada = await db.interrupciones.get(interrupcion.id)
    expect(interrupcionCerrada?.fin).toBe('2026-09-08T09:10:00-06:00')

    await reanudarActividad(deps(), actividad.id)
    const actividadReanudada = await db.actividades.get(actividad.id)
    expect(actividadReanudada?.estado).toBe('en_curso')
    // El marcador sigue visible tras reanudar, para que HOY lo muestre.
    expect(actividadReanudada?.marcador_reanudacion).toBe('me quedé comparando vértices 11-17')

    const eventos = await db.eventos.toArray()
    const tipos = eventos.map((e) => e.event_type).sort()
    expect(tipos).toEqual(
      ['actividad_iniciada', 'actividad_interrumpida', 'actividad_reanudada', 'emergente_registrado'].sort(),
    )
  })

  it('finalizarActividad calcula minutos_reales a partir del reloj inyectado', async () => {
    const actividad = await iniciarActividad(deps(), crypto.randomUUID(), 'planificado')
    reloj = '2026-09-08T09:05:00-06:00'
    await finalizarActividad(deps(), actividad.id)
    const finalizada = await db.actividades.get(actividad.id)
    expect(finalizada?.estado).toBe('finalizada')
    expect(finalizada?.minutos_reales).toBe(30)
  })
})
