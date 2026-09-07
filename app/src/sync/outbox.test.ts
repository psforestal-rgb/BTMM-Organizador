import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { crearBaseDatos, type GeoDexie } from '../datos/db'
import type { Asignacion, EventoGEO } from '../dominio/tipos'
import type { EstadoSync, Lote, ResultadoPull, ResultadoPush, SyncAdapter } from '../puertos'
import { encolarEvento, sincronizar, type CambioGEO } from './outbox'

class AdaptadorFalso implements SyncAdapter {
  eventosServidor: EventoGEO[] = []
  cambiosServidor: CambioGEO[] = []
  llamadasPush = 0
  llamadasPull = 0
  fallarPushVeces = 0
  private siguienteServerSeq = 0

  async push(lote: Lote): Promise<ResultadoPush> {
    this.llamadasPush += 1
    if (this.fallarPushVeces > 0) {
      this.fallarPushVeces -= 1
      throw new Error('falla de red simulada')
    }
    const aceptados: string[] = []
    for (const eventoRaw of lote.eventos) {
      const evento = eventoRaw as EventoGEO
      if (this.eventosServidor.some((e) => e.event_id === evento.event_id)) continue
      this.siguienteServerSeq += 1
      this.eventosServidor.push({ ...evento, server_seq: this.siguienteServerSeq })
      aceptados.push(evento.event_id)
    }
    for (const cambioRaw of lote.cambios) {
      const cambio = cambioRaw as CambioGEO
      this.siguienteServerSeq += 1
      this.cambiosServidor.push(cambio)
      aceptados.push(cambio.change_id)
    }
    return { aceptados, duplicados: [], rechazados: [], serverSeq: this.siguienteServerSeq }
  }

  async pull(desde: number, limite: number): Promise<ResultadoPull> {
    this.llamadasPull += 1
    const combinados = [
      ...this.eventosServidor.map((e) => ({ tipo: 'evento' as const, seq: e.server_seq ?? 0, dato: e })),
      ...this.cambiosServidor.map((c, i) => ({ tipo: 'cambio' as const, seq: i + 1, dato: c })),
    ]
      .filter((x) => x.seq > desde)
      .sort((a, b) => a.seq - b.seq)
    const pagina = combinados.slice(0, limite)
    return {
      eventos: pagina.filter((x) => x.tipo === 'evento').map((x) => x.dato),
      cambios: pagina.filter((x) => x.tipo === 'cambio').map((x) => x.dato),
      serverSeq: pagina.length > 0 ? Math.max(...pagina.map((x) => x.seq)) : desde,
      hayMas: combinados.length > limite,
    }
  }

  async estado(): Promise<EstadoSync> {
    return {
      serverSeq: this.siguienteServerSeq,
      ultimoClientSequence: 0,
      conflictosAbiertos: 0,
      ultimaConexionAt: null,
    }
  }

  async conflictosAbiertos() {
    return []
  }
}

describe('encolarEvento', () => {
  let db: GeoDexie

  beforeEach(() => {
    db = crearBaseDatos(`geo-outbox-${crypto.randomUUID()}`)
  })

  afterEach(async () => {
    await db.delete()
  })

  it('persiste el evento localmente y lo encola en outbox', async () => {
    const evento: EventoGEO = {
      event_id: crypto.randomUUID(),
      entity_type: 'captura',
      entity_id: crypto.randomUUID(),
      event_type: 'captura_creada',
      occurred_at: '2026-09-08T08:00:00-06:00',
      recorded_at: '2026-09-08T08:00:00-06:00',
      device_id: 'DISPOSITIVO-A',
      client_sequence: 1,
      base_version: null,
      payload: { texto: 'x' },
      server_seq: null,
    }
    await encolarEvento(db, evento)

    expect(await db.eventos.count()).toBe(1)
    const outbox = await db.outbox.toArray()
    expect(outbox).toHaveLength(1)
    expect(outbox[0]).toMatchObject({ id: evento.event_id, tipo: 'evento', estado: 'pendiente' })
  })
})

describe('sincronizar', () => {
  let db: GeoDexie
  let adapter: AdaptadorFalso

  beforeEach(() => {
    db = crearBaseDatos(`geo-outbox-${crypto.randomUUID()}`)
    adapter = new AdaptadorFalso()
  })

  afterEach(async () => {
    await db.delete()
  })

  it('empuja lo pendiente y purga el outbox tras confirmación', async () => {
    const evento: EventoGEO = {
      event_id: crypto.randomUUID(),
      entity_type: 'captura',
      entity_id: crypto.randomUUID(),
      event_type: 'captura_creada',
      occurred_at: '2026-09-08T08:00:00-06:00',
      recorded_at: '2026-09-08T08:00:00-06:00',
      device_id: 'DISPOSITIVO-A',
      client_sequence: 1,
      base_version: null,
      payload: { texto: 'x' },
      server_seq: null,
    }
    await encolarEvento(db, evento)

    const resultado = await sincronizar(db, adapter, 'DISPOSITIVO-A', '2026-09-08T08:05:00-06:00')

    expect(resultado.confirmados).toBe(1)
    expect(await db.outbox.count()).toBe(0)
    expect(adapter.eventosServidor).toHaveLength(1)
  })

  it('aplica eventos y cambios recibidos de otro dispositivo, con fusión por campo', async () => {
    const asignacionId = crypto.randomUUID()
    await db.asignaciones.add({
      id: asignacionId,
      version_id: 'v1',
      field_meta: {},
      eliminado: false,
      titulo: 'Informe técnico CASO-2026-001',
      carril: 'planificado',
      duracion_estimada_min: 90,
      vencimiento: '2026-09-08',
      prioridad: 3,
      indivisible: false,
      dependencias: [],
      contexto: null,
      iniciativa_id: null,
      tramite_id: null,
      estado: 'programado',
      fecha_revision: null,
      fecha_pospuesto: null,
      motivo: null,
    } satisfies Asignacion)

    adapter.cambiosServidor.push({
      change_id: crypto.randomUUID(),
      entity_type: 'asignacion',
      entity_id: asignacionId,
      device_id: 'DISPOSITIVO-B',
      client_sequence: 1,
      occurred_at: '2026-09-08T09:15:00-06:00',
      base_version: null,
      campos: { prioridad: 4 },
      campo_ts: { prioridad: '2026-09-08T09:15:00-06:00' },
    })

    const resultado = await sincronizar(db, adapter, 'DISPOSITIVO-A', '2026-09-08T09:40:00-06:00')

    expect(resultado.cambiosRecibidos).toBe(1)
    const actualizada = await db.asignaciones.get(asignacionId)
    expect(actualizada?.prioridad).toBe(4)
    expect(actualizada?.field_meta.prioridad?.device_id).toBe('DISPOSITIVO-B')
  })

  it('materializa la entidad al recibir un evento *_creada de otro dispositivo', async () => {
    const asignacionId = crypto.randomUUID()
    adapter.eventosServidor.push({
      event_id: crypto.randomUUID(),
      entity_type: 'asignacion',
      entity_id: asignacionId,
      event_type: 'asignacion_creada',
      occurred_at: '2026-09-08T08:00:00-06:00',
      recorded_at: '2026-09-08T08:00:00-06:00',
      device_id: 'DISPOSITIVO-B',
      client_sequence: 1,
      base_version: null,
      payload: {
        titulo: 'Informe técnico CASO-2026-001',
        carril: 'planificado',
        duracion_estimada_min: 90,
        vencimiento: '2026-09-08',
        prioridad: 3,
        indivisible: false,
        dependencias: [],
        contexto: null,
        iniciativa_id: null,
        tramite_id: null,
        estado: 'programado',
        fecha_revision: null,
        fecha_pospuesto: null,
        motivo: null,
      },
      server_seq: 1,
    })

    await sincronizar(db, adapter, 'DISPOSITIVO-A', '2026-09-08T08:05:00-06:00')

    const materializada = await db.asignaciones.get(asignacionId)
    expect(materializada?.titulo).toBe('Informe técnico CASO-2026-001')
    expect(materializada?.duracion_estimada_min).toBe(90)
  })

  it('materializa un trámite con evento *_creado (masculino) de otro dispositivo', async () => {
    const tramiteId = crypto.randomUUID()
    adapter.eventosServidor.push({
      event_id: crypto.randomUUID(),
      entity_type: 'tramite',
      entity_id: tramiteId,
      event_type: 'tramite_creado',
      occurred_at: '2026-09-08T08:00:00-06:00',
      recorded_at: '2026-09-08T08:00:00-06:00',
      device_id: 'DISPOSITIVO-B',
      client_sequence: 1,
      base_version: null,
      payload: {
        tipo_tramite_id: 'tipo-1',
        tipo_tramite_version: 1,
        titulo: 'CASO-2026-001',
        etapa_actual_id: null,
        fecha_inicio: '2026-09-08',
      },
      server_seq: 1,
    })

    await sincronizar(db, adapter, 'DISPOSITIVO-A', '2026-09-08T08:05:00-06:00')

    const materializado = await db.tramites.get(tramiteId)
    expect(materializado?.titulo).toBe('CASO-2026-001')
  })

  it('materializa un paso_tramite al recibir un evento paso_completado de otro dispositivo', async () => {
    const pasoId = crypto.randomUUID()
    adapter.eventosServidor.push({
      event_id: crypto.randomUUID(),
      entity_type: 'paso_tramite',
      entity_id: pasoId,
      event_type: 'paso_completado',
      occurred_at: '2026-09-08T08:00:00-06:00',
      recorded_at: '2026-09-08T08:00:00-06:00',
      device_id: 'DISPOSITIVO-B',
      client_sequence: 1,
      base_version: null,
      payload: {
        tramite_id: 'tramite-1',
        etapa_id: 'e1',
        estado: 'completado',
        completado_en: '2026-09-08T08:00:00-06:00',
      },
      server_seq: 1,
    })

    await sincronizar(db, adapter, 'DISPOSITIVO-A', '2026-09-08T08:05:00-06:00')

    const materializado = await db.pasosTramite.get(pasoId)
    expect(materializado?.estado).toBe('completado')
  })

  it('reintenta con retroceso exponencial ante fallos y termina confirmando', async () => {
    adapter.fallarPushVeces = 2
    const evento: EventoGEO = {
      event_id: crypto.randomUUID(),
      entity_type: 'captura',
      entity_id: crypto.randomUUID(),
      event_type: 'captura_creada',
      occurred_at: '2026-09-08T08:00:00-06:00',
      recorded_at: '2026-09-08T08:00:00-06:00',
      device_id: 'DISPOSITIVO-A',
      client_sequence: 1,
      base_version: null,
      payload: { texto: 'x' },
      server_seq: null,
    }
    await encolarEvento(db, evento)

    // Sin fake timers: la espera real entre reintentos es corta a propósito
    // (ESPERA_BASE_MS = 50) precisamente para que esta prueba no dependa de
    // simular el reloj global, lo que en este proyecto choca con Dexie /
    // fake-indexeddb (sus transacciones internas usan temporizadores reales).
    const resultado = await sincronizar(db, adapter, 'DISPOSITIVO-A', '2026-09-08T08:05:00-06:00')

    expect(adapter.llamadasPush).toBe(3) // 2 fallos + 1 éxito
    expect(resultado.confirmados).toBe(1)
  })

  it('el pull queda reanudable: una segunda sincronización no repite lo ya recibido', async () => {
    for (let i = 0; i < 5; i += 1) {
      adapter.eventosServidor.push({
        event_id: crypto.randomUUID(),
        entity_type: 'captura',
        entity_id: crypto.randomUUID(),
        event_type: 'captura_creada',
        occurred_at: '2026-09-08T08:00:00-06:00',
        recorded_at: '2026-09-08T08:00:00-06:00',
        device_id: 'DISPOSITIVO-B',
        client_sequence: i + 1,
        base_version: null,
        payload: { texto: `x${i}` },
        server_seq: i + 1,
      })
    }

    const primera = await sincronizar(db, adapter, 'DISPOSITIVO-A', '2026-09-08T08:05:00-06:00')
    expect(primera.eventosRecibidos).toBe(5)
    expect(await db.eventos.count()).toBe(5)

    const segunda = await sincronizar(db, adapter, 'DISPOSITIVO-A', '2026-09-08T08:10:00-06:00')
    expect(segunda.eventosRecibidos).toBe(0)
    expect(await db.eventos.count()).toBe(5)
  })
})
