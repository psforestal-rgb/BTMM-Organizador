import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { crearBaseDatos, type GeoDexie } from './db'
import { siguienteClientSequence } from './secuencia'

describe('siguienteClientSequence', () => {
  let db: GeoDexie

  beforeEach(() => {
    db = crearBaseDatos(`geo-secuencia-${crypto.randomUUID()}`)
  })

  afterEach(async () => {
    await db.delete()
  })

  it('es monótona y arranca en 1', async () => {
    expect(await siguienteClientSequence(db, 'DISPOSITIVO-A', 'evento')).toBe(1)
    expect(await siguienteClientSequence(db, 'DISPOSITIVO-A', 'evento')).toBe(2)
    expect(await siguienteClientSequence(db, 'DISPOSITIVO-A', 'evento')).toBe(3)
  })

  it('eventos y cambios tienen contadores independientes', async () => {
    expect(await siguienteClientSequence(db, 'DISPOSITIVO-A', 'evento')).toBe(1)
    expect(await siguienteClientSequence(db, 'DISPOSITIVO-A', 'cambio')).toBe(1)
    expect(await siguienteClientSequence(db, 'DISPOSITIVO-A', 'evento')).toBe(2)
  })

  it('cada dispositivo tiene su propio contador', async () => {
    expect(await siguienteClientSequence(db, 'DISPOSITIVO-A', 'evento')).toBe(1)
    expect(await siguienteClientSequence(db, 'DISPOSITIVO-B', 'evento')).toBe(1)
  })

  it('nunca reutiliza un número ya usado, incluso si se recrea la conexión', async () => {
    await siguienteClientSequence(db, 'DISPOSITIVO-A', 'evento')
    await siguienteClientSequence(db, 'DISPOSITIVO-A', 'evento')
    const otraConexion = crearBaseDatos(db.name)
    try {
      expect(await siguienteClientSequence(otraConexion, 'DISPOSITIVO-A', 'evento')).toBe(3)
    } finally {
      otraConexion.close()
    }
  })
})
