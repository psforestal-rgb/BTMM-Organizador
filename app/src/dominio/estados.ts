// Motor puro de estados y espera (sección 7.2) y de la regla "ningún
// elemento sale de una vista sin una decisión registrada" (invariante 4,
// CA-08). No lee el reloj de sistema: recibe `hoy` ya resuelto por el
// llamador a través del puerto Reloj.

import { sumarDiasHabiles } from './calendario'
import type { EstadoElemento } from './tipos'

export class TransicionInvalidaError extends Error {}

export interface EntradaTransicion {
  estadoNuevo: EstadoElemento
  hoy: string
  fechaRevision?: string
  fechaPospuesto?: string
  motivo?: string
  diasRevisionEsperaPorDefecto?: number
}

export interface ResultadoTransicion {
  estado: EstadoElemento
  fecha_revision: string | null
  fecha_pospuesto: string | null
  motivo: string | null
}

const DIAS_REVISION_ESPERA_DEFECTO = 5

export function transicionarEstado(entrada: EntradaTransicion): ResultadoTransicion {
  const diasPorDefecto = entrada.diasRevisionEsperaPorDefecto ?? DIAS_REVISION_ESPERA_DEFECTO

  switch (entrada.estadoNuevo) {
    case 'esperando': {
      const fecha = entrada.fechaRevision ?? sumarDiasHabiles(entrada.hoy, diasPorDefecto)
      return { estado: 'esperando', fecha_revision: fecha, fecha_pospuesto: null, motivo: null }
    }
    case 'pospuesto': {
      if (!entrada.fechaPospuesto) {
        throw new TransicionInvalidaError('la transición a "pospuesto" exige fecha_pospuesto')
      }
      return {
        estado: 'pospuesto',
        fecha_revision: null,
        fecha_pospuesto: entrada.fechaPospuesto,
        motivo: null,
      }
    }
    case 'bloqueado': {
      if (!entrada.motivo) {
        throw new TransicionInvalidaError('la transición a "bloqueado" exige motivo')
      }
      return { estado: 'bloqueado', fecha_revision: null, fecha_pospuesto: null, motivo: entrada.motivo }
    }
    case 'cancelado': {
      if (!entrada.motivo) {
        throw new TransicionInvalidaError('la transición a "cancelado" exige motivo')
      }
      return { estado: 'cancelado', fecha_revision: null, fecha_pospuesto: null, motivo: entrada.motivo }
    }
    case 'hecho':
    case 'programado':
      return { estado: entrada.estadoNuevo, fecha_revision: null, fecha_pospuesto: null, motivo: null }
  }
}

// --- Decisión de cierre / RADAR: invariante 4 -----------------------------

export type DecisionCierre =
  | { tipo: 'continuar_manana' }
  | { tipo: 'programar' }
  | { tipo: 'esperar'; fechaRevision?: string }
  | { tipo: 'posponer'; fecha: string }
  | { tipo: 'cancelar'; motivo: string }
  | { tipo: 'hecho' }

const TIPOS_DECISION_VALIDOS = new Set<string>([
  'continuar_manana',
  'programar',
  'esperar',
  'posponer',
  'cancelar',
  'hecho',
])

/** Ningún elemento sale de una vista sin una decisión registrada como
 * evento (invariante 4). No existe una variante "descartar": cualquier
 * entrada que no sea una de las seis decisiones cerradas es rechazada. */
export function aplicarDecisionCierre(
  decision: unknown,
  hoy: string,
  diasRevisionEsperaPorDefecto = DIAS_REVISION_ESPERA_DEFECTO,
): ResultadoTransicion {
  if (
    typeof decision !== 'object' ||
    decision === null ||
    !('tipo' in decision) ||
    typeof (decision as { tipo: unknown }).tipo !== 'string' ||
    !TIPOS_DECISION_VALIDOS.has((decision as { tipo: string }).tipo)
  ) {
    throw new TransicionInvalidaError(
      'no se puede salir de la vista sin registrar una de las seis decisiones válidas',
    )
  }

  const decisionTipada = decision as DecisionCierre
  switch (decisionTipada.tipo) {
    case 'continuar_manana':
      return { estado: 'programado', fecha_revision: null, fecha_pospuesto: null, motivo: null }
    case 'programar':
      return transicionarEstado({ estadoNuevo: 'programado', hoy })
    case 'esperar':
      return transicionarEstado({
        estadoNuevo: 'esperando',
        hoy,
        diasRevisionEsperaPorDefecto,
        ...(decisionTipada.fechaRevision !== undefined
          ? { fechaRevision: decisionTipada.fechaRevision }
          : {}),
      })
    case 'posponer':
      return transicionarEstado({
        estadoNuevo: 'pospuesto',
        hoy,
        fechaPospuesto: decisionTipada.fecha,
      })
    case 'cancelar':
      return transicionarEstado({ estadoNuevo: 'cancelado', hoy, motivo: decisionTipada.motivo })
    case 'hecho':
      return transicionarEstado({ estadoNuevo: 'hecho', hoy })
  }
}
