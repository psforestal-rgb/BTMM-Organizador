import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { crearBaseDatos, type GeoDexie } from './db'
import { crearCaptura } from './capturas'
import { creadorDeSecuencia } from './secuencia'

const DEVICE_ID = 'DISPOSITIVO-A'

describe('crearCaptura — CA-02', () => {
  let db: GeoDexie

  beforeEach(() => {
    db = crearBaseDatos(`geo-capturas-${crypto.randomUUID()}`)
  })

  afterEach(async () => {
    await db.delete()
  })

  it('persiste en Dexie en menos de 1500ms, con sello temporal, device_id y estado capturado', async () => {
    const inicio = performance.now()
    const captura = await crearCaptura(
      {
        db,
        deviceId: DEVICE_ID,
        ahoraISO: () => '2026-09-08T08:00:00-06:00',
        siguienteClientSequence: creadorDeSecuencia(db, DEVICE_ID, 'evento'),
      },
      'llamar a Sitio Alfa sobre el permiso',
    )
    const duracionMs = performance.now() - inicio

    expect(duracionMs).toBeLessThan(1500)
    expect(captura.estado).toBe('capturado')
    expect(captura.device_id).toBe(DEVICE_ID)
    expect(captura.creado_en).toBe('2026-09-08T08:00:00-06:00')

    const enDexie = await db.capturas.get(captura.id)
    expect(enDexie?.texto).toBe('llamar a Sitio Alfa sobre el permiso')
  })

  it('encola un evento captura_creada para sincronización', async () => {
    const captura = await crearCaptura(
      {
        db,
        deviceId: DEVICE_ID,
        ahoraISO: () => '2026-09-08T08:00:00-06:00',
        siguienteClientSequence: creadorDeSecuencia(db, DEVICE_ID, 'evento'),
      },
      'texto de prueba',
    )

    const eventos = await db.eventos.toArray()
    expect(eventos).toHaveLength(1)
    expect(eventos[0]).toMatchObject({ event_type: 'captura_creada', entity_id: captura.id })

    const outbox = await db.outbox.toArray()
    expect(outbox).toHaveLength(1)
  })

  it('el texto persistido es idéntico al ingresado, sin alteración', async () => {
    const textoOriginal = '  espacios y MAYÚSCULAS sin normalizar  '
    const captura = await crearCaptura(
      {
        db,
        deviceId: DEVICE_ID,
        ahoraISO: () => '2026-09-08T08:00:00-06:00',
        siguienteClientSequence: creadorDeSecuencia(db, DEVICE_ID, 'evento'),
      },
      textoOriginal,
    )
    expect(captura.texto).toBe(textoOriginal)
  })
})
