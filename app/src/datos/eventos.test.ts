import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { crearBaseDatos, type GeoDexie } from './db'
import { RepositorioEventos } from './eventos'
import type { EventoGEO } from '../dominio/tipos'

function eventoDeEjemplo(overrides: Partial<EventoGEO> = {}): EventoGEO {
  return {
    event_id: crypto.randomUUID(),
    entity_type: 'asignacion',
    entity_id: crypto.randomUUID(),
    event_type: 'asignacion_creada',
    occurred_at: '2026-09-08T08:00:00-06:00',
    recorded_at: '2026-09-08T08:00:00-06:00',
    device_id: 'DISPOSITIVO-A',
    client_sequence: 1,
    base_version: null,
    payload: { titulo: 'CASO-2026-001' },
    server_seq: null,
    ...overrides,
  }
}

describe('RepositorioEventos (Dexie real vía fake-indexeddb)', () => {
  let db: GeoDexie
  let repo: RepositorioEventos

  beforeEach(() => {
    db = crearBaseDatos(`geo-test-${crypto.randomUUID()}`)
    repo = new RepositorioEventos(db)
  })

  afterEach(async () => {
    await db.delete()
  })

  it('agrega un evento y lo recupera', async () => {
    const evento = eventoDeEjemplo()
    await repo.agregar(evento)

    expect(await repo.contar()).toBe(1)
    const porEntidad = await repo.porEntidad(evento.entity_id)
    expect(porEntidad).toHaveLength(1)
    expect(porEntidad[0]).toEqual(evento)
  })

  it('rechaza un event_id duplicado (idempotencia local)', async () => {
    const evento = eventoDeEjemplo()
    await repo.agregar(evento)
    await expect(repo.agregar(evento)).rejects.toThrow()
    expect(await repo.contar()).toBe(1)
  })

  it('calcula el máximo client_sequence por dispositivo', async () => {
    await repo.agregar(eventoDeEjemplo({ event_id: crypto.randomUUID(), client_sequence: 1 }))
    await repo.agregar(eventoDeEjemplo({ event_id: crypto.randomUUID(), client_sequence: 3 }))
    await repo.agregar(
      eventoDeEjemplo({
        event_id: crypto.randomUUID(),
        client_sequence: 99,
        device_id: 'DISPOSITIVO-B',
      }),
    )
    expect(await repo.maximoClientSequence('DISPOSITIVO-A')).toBe(3)
    expect(await repo.maximoClientSequence('DISPOSITIVO-B')).toBe(99)
  })
})
