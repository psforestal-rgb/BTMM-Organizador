// Única implementación real de SyncAdapter (ADR 0005): habla HTTP con el
// servidor GEO. Debe poder sustituirse por PouchDB/CouchDB sin tocar el
// dominio, porque el dominio nunca importa este archivo.

import type { EstadoSync, Lote, ResultadoPull, ResultadoPush, SyncAdapter } from '../puertos'

export class SyncAdapterRest implements SyncAdapter {
  private readonly baseUrl: string
  private readonly deviceId: string

  constructor(baseUrl: string, deviceId: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
    this.deviceId = deviceId
  }

  async push(lote: Lote): Promise<ResultadoPush> {
    const respuesta = await fetch(`${this.baseUrl}/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: lote.deviceId, eventos: lote.eventos, cambios: lote.cambios }),
    })
    if (!respuesta.ok) {
      throw new Error(`POST /sync/push falló con estado ${respuesta.status}`)
    }
    const cuerpo = (await respuesta.json()) as {
      aceptados: string[]
      duplicados: string[]
      rechazados: Array<{ id: string; motivo: string }>
      server_seq: number
    }
    return {
      aceptados: cuerpo.aceptados,
      duplicados: cuerpo.duplicados,
      rechazados: cuerpo.rechazados,
      serverSeq: cuerpo.server_seq,
    }
  }

  async pull(desde: number, limite: number): Promise<ResultadoPull> {
    const parametros = new URLSearchParams({
      device_id: this.deviceId,
      desde: String(desde),
      limite: String(limite),
    })
    const respuesta = await fetch(`${this.baseUrl}/sync/pull?${parametros.toString()}`)
    if (!respuesta.ok) {
      throw new Error(`GET /sync/pull falló con estado ${respuesta.status}`)
    }
    const cuerpo = (await respuesta.json()) as {
      eventos: unknown[]
      cambios: unknown[]
      server_seq: number
      hay_mas: boolean
    }
    return {
      eventos: cuerpo.eventos,
      cambios: cuerpo.cambios,
      serverSeq: cuerpo.server_seq,
      hayMas: cuerpo.hay_mas,
    }
  }

  async estado(): Promise<EstadoSync> {
    const parametros = new URLSearchParams({ device_id: this.deviceId })
    const respuesta = await fetch(`${this.baseUrl}/sync/status?${parametros.toString()}`)
    if (!respuesta.ok) {
      throw new Error(`GET /sync/status falló con estado ${respuesta.status}`)
    }
    const cuerpo = (await respuesta.json()) as {
      server_seq: number
      ultimo_client_sequence: number
      conflictos_abiertos: number
      ultima_conexion_at: string | null
    }
    return {
      serverSeq: cuerpo.server_seq,
      ultimoClientSequence: cuerpo.ultimo_client_sequence,
      conflictosAbiertos: cuerpo.conflictos_abiertos,
      ultimaConexionAt: cuerpo.ultima_conexion_at,
    }
  }
}
