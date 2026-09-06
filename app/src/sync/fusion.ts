// Fusión por campo (sección 5.4, ADR 0002). Debe coincidir exactamente
// con server/geo/sync/fusion.py — cualquier divergencia es un bug. No
// vive en src/dominio porque conceptualmente es parte del protocolo de
// sincronización, no un motor de planificación puro, pero es igual de
// pura: sin red, sin IO, sin Date.

export const CAMPOS_CRITICOS = new Set([
  'estado',
  'vencimiento',
  'prioridad',
  'fecha_revision',
  'duracion_estimada_min',
])

export interface MetaCampo {
  updated_at: string
  device_id: string
}

export interface ConflictoCampo {
  campo: string
  valor_ganador: unknown
  device_ganador: string
  ts_ganador: string
  valor_perdedor: unknown
  device_perdedor: string
  ts_perdedor: string
}

export interface ResultadoFusionCampo {
  valor: unknown
  meta: MetaCampo
  conflicto: ConflictoCampo | null
}

function gana(candidata: MetaCampo, actual: MetaCampo): boolean {
  if (candidata.updated_at !== actual.updated_at) {
    return candidata.updated_at > actual.updated_at
  }
  return candidata.device_id > actual.device_id
}

/** Fusiona un único campo que ya tenía valor previo (con su field_meta).
 * Un campo sin valor previo no pasa por aquí: se acepta directo. */
export function fusionarCampo(
  nombreCampo: string,
  valorActual: unknown,
  metaActual: MetaCampo,
  valorEntrante: unknown,
  metaEntrante: MetaCampo,
): ResultadoFusionCampo {
  let valorGanador: unknown
  let metaGanadora: MetaCampo
  let valorPerdedor: unknown
  let metaPerdedora: MetaCampo

  if (gana(metaEntrante, metaActual)) {
    valorGanador = valorEntrante
    metaGanadora = metaEntrante
    valorPerdedor = valorActual
    metaPerdedora = metaActual
  } else {
    valorGanador = valorActual
    metaGanadora = metaActual
    valorPerdedor = valorEntrante
    metaPerdedora = metaEntrante
  }

  let conflicto: ConflictoCampo | null = null
  if (CAMPOS_CRITICOS.has(nombreCampo) && valorPerdedor !== valorGanador) {
    conflicto = {
      campo: nombreCampo,
      valor_ganador: valorGanador,
      device_ganador: metaGanadora.device_id,
      ts_ganador: metaGanadora.updated_at,
      valor_perdedor: valorPerdedor,
      device_perdedor: metaPerdedora.device_id,
      ts_perdedor: metaPerdedora.updated_at,
    }
  }

  return { valor: valorGanador, meta: metaGanadora, conflicto }
}
