import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { crearBaseDatos, type GeoDexie } from './db'
import { completarPasoTramite, crearTipoTramite, crearTramite } from './tramites'
import { creadorDeSecuencia } from './secuencia'
import type { EtapaTramite } from '../dominio/tipos'
import { proximaAccion } from '../dominio/tramites'

const DEVICE_ID = 'DISPOSITIVO-A'

const ETAPAS: EtapaTramite[] = [
  {
    id: 'e1',
    nombre: 'Recepción',
    orden: 1,
    condiciones: [],
    dependencias: [],
    plazo_dias_habiles: 2,
    producto: 'acuse',
  },
  {
    id: 'e2',
    nombre: 'Revisión técnica',
    orden: 2,
    condiciones: [],
    dependencias: ['e1'],
    plazo_dias_habiles: 3,
    producto: 'informe',
  },
]

describe('tramites — CA-07', () => {
  let db: GeoDexie

  function deps() {
    return {
      db,
      deviceId: DEVICE_ID,
      ahoraISO: () => '2026-09-08T08:00:00-06:00',
      siguienteClientSequenceEvento: creadorDeSecuencia(db, DEVICE_ID, 'evento'),
    }
  }

  beforeEach(() => {
    db = crearBaseDatos(`geo-tramites-${crypto.randomUUID()}`)
  })

  afterEach(async () => {
    await db.delete()
  })

  it('crearTipoTramite persiste el tipo y encola un evento tipo_tramite_creado', async () => {
    const tipo = await crearTipoTramite(deps(), { nombre: 'Permiso de construcción', etapas: ETAPAS })

    expect(tipo.version).toBe(1)
    const enDexie = await db.tiposTramite.get(tipo.id)
    expect(enDexie?.etapas).toHaveLength(2)

    const eventos = await db.eventos.toArray()
    expect(eventos).toHaveLength(1)
    expect(eventos[0]).toMatchObject({ event_type: 'tipo_tramite_creado', entity_id: tipo.id })
  })

  it('crearTramite instancia un tipo existente y encola un evento tramite_creado', async () => {
    const tipo = await crearTipoTramite(deps(), { nombre: 'Permiso de construcción', etapas: ETAPAS })
    const tramite = await crearTramite(deps(), {
      tipoTramiteId: tipo.id,
      tipoTramiteVersion: tipo.version,
      titulo: 'CASO-2026-001',
      fechaInicio: '2026-09-08',
    })

    const enDexie = await db.tramites.get(tramite.id)
    expect(enDexie?.tipo_tramite_id).toBe(tipo.id)

    const eventos = (await db.eventos.toArray()).filter((e) => e.event_type === 'tramite_creado')
    expect(eventos).toHaveLength(1)
    expect(eventos[0]?.entity_id).toBe(tramite.id)
  })

  it('completarPasoTramite crea el PasoTramite y avanza la próxima acción', async () => {
    const tipo = await crearTipoTramite(deps(), { nombre: 'Permiso de construcción', etapas: ETAPAS })
    const tramite = await crearTramite(deps(), {
      tipoTramiteId: tipo.id,
      tipoTramiteVersion: tipo.version,
      titulo: 'CASO-2026-001',
      fechaInicio: '2026-09-08',
    })

    const antes = proximaAccion(tipo.etapas, [], tramite.fecha_inicio)
    expect(antes?.etapaId).toBe('e1')

    await completarPasoTramite(deps(), tramite.id, 'e1')

    const pasos = await db.pasosTramite.where('tramite_id').equals(tramite.id).toArray()
    expect(pasos).toHaveLength(1)
    expect(pasos[0]).toMatchObject({ etapa_id: 'e1', estado: 'completado' })

    const despues = proximaAccion(
      tipo.etapas,
      pasos.map((p) => ({ etapaId: p.etapa_id, estado: p.estado })),
      tramite.fecha_inicio,
    )
    expect(despues?.etapaId).toBe('e2')

    const eventos = (await db.eventos.toArray()).filter((e) => e.event_type === 'paso_completado')
    expect(eventos).toHaveLength(1)
  })
})
