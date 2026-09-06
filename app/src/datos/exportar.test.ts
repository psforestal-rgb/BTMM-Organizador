import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { crearBaseDatos, type GeoDexie } from './db'
import { contarEventos, exportarBitacoraCSV, exportarBitacoraJSON } from './exportar'
import { crearCaptura } from './capturas'
import { creadorDeSecuencia } from './secuencia'

describe('exportación local — CA-12', () => {
  let db: GeoDexie

  beforeEach(() => {
    db = crearBaseDatos(`geo-export-${crypto.randomUUID()}`)
  })

  afterEach(async () => {
    await db.delete()
  })

  it('el número de filas exportadas coincide con el conteo de eventos', async () => {
    for (let i = 0; i < 3; i += 1) {
      await crearCaptura(
        {
          db,
          deviceId: 'DISPOSITIVO-A',
          ahoraISO: () => '2026-09-08T08:00:00-06:00',
          siguienteClientSequence: creadorDeSecuencia(db, 'DISPOSITIVO-A', 'evento'),
        },
        `captura ${i}`,
      )
    }

    const total = await contarEventos(db)
    expect(total).toBe(3)

    const json = JSON.parse(await exportarBitacoraJSON(db)) as unknown[]
    expect(json).toHaveLength(3)

    const csv = await exportarBitacoraCSV(db)
    const lineas = csv.trim().split('\n')
    expect(lineas).toHaveLength(4) // encabezado + 3 filas
  })
})
