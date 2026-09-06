// Puertos reservados (sección 9). El dominio depende solo de estas
// interfaces; las implementaciones concretas viven fuera de src/dominio.

export interface Reloj {
  /** ISO 8601 con desplazamiento explícito. */
  ahora(): string
  /** YYYY-MM-DD en America/Costa_Rica. */
  hoy(): string
}

export interface ClasificacionSugerida {
  carril: 'reactivo' | 'tramite' | 'planificado' | 'iniciativa'
  etiquetas: string[]
}

export interface AIProvider {
  disponible(): boolean
  clasificarCaptura(texto: string): Promise<ClasificacionSugerida | null>
}

export interface Sitio {
  id: string
  nombre: string
}

export interface Ventana {
  desde: string
  hasta: string
}

export interface Pronostico {
  resumen: string
  probabilidadLluviaPct: number
}

export interface WeatherProvider {
  disponible(): boolean
  pronostico(sitio: Sitio, ventana: Ventana): Promise<Pronostico | null>
}

export interface ProtectedDataProvider {
  disponible(): boolean
  /** valor real -> token opaco, p.ej. "{{PERSONA_01}}" */
  tokenizar(valor: string): Promise<string>
  /** token opaco -> valor real, o null si no existe */
  resolver(token: string): Promise<string | null>
}

export interface Lote {
  deviceId: string
  eventos: unknown[]
  cambios: unknown[]
}

export interface ResultadoPush {
  aceptados: string[]
  duplicados: string[]
  rechazados: Array<{ id: string; motivo: string }>
  serverSeq: number
}

export interface ResultadoPull {
  eventos: unknown[]
  cambios: unknown[]
  serverSeq: number
  hayMas: boolean
}

export interface EstadoSync {
  serverSeq: number
  ultimoClientSequence: number
  conflictosAbiertos: number
  ultimaConexionAt: string | null
}

export interface ConflictoRemoto {
  id: string
  entity_type: string
  entity_id: string
  campo: string
  valor_ganador: unknown
  device_ganador: string
  ts_ganador: string
  valor_perdedor: unknown
  device_perdedor: string
  ts_perdedor: string
  resuelto: boolean
}

export interface SyncAdapter {
  push(lote: Lote): Promise<ResultadoPush>
  pull(desde: number, limite: number): Promise<ResultadoPull>
  estado(): Promise<EstadoSync>
  /** Extremo adicional (sección 6 solo exige push/pull/status/export,
   * pero sin esto los conflictos generados en el servidor nunca serían
   * visibles para el dispositivo que perdió la fusión). */
  conflictosAbiertos(): Promise<ConflictoRemoto[]>
}
