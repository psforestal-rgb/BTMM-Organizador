// Planificador greedy determinista (sección 7.3, ADR 0004). Puro: no lee
// el reloj de sistema (recibe `fecha` y `ahora` ya resueltos), no muta
// sus argumentos, no hace red ni IO.

import { diasHabilesEntre, finDeSemana } from './calendario'
import { aHHMM, aMinutos, duracion, restarIntervalos, type Intervalo } from './tiempo'
import type { Carril } from './tipos'

export type CodigoJustificacion =
  | 'VENCE_HOY'
  | 'HOLGURA_MINIMA'
  | 'PRIORIDAD_ALTA'
  | 'CUOTA_INICIATIVA'
  | 'CUOTA_DESPLAZADA_POR_URGENCIA'
  | 'RELLENO_CAPACIDAD'
  | 'FRAGMENTADA_LIMITE_90MIN'
  | 'PAUSA_TRAS_BLOQUE_INTENSO'
  | 'DESPLAZADA_POR_INTERRUPCION'
  | 'SIN_CAPACIDAD_PROGRAMABLE'
  | 'NO_CABE_INDIVISIBLE'
  | 'BLOQUEADA_POR_DEPENDENCIA'
  | 'FUERA_DE_JORNADA'
  | 'PROTEGIDO_BUFFER_ABSORCION'

export interface Justificacion {
  codigo: CodigoJustificacion
  texto: string
}

export interface EventoFijoPlan {
  inicio: string
  fin: string
}

export interface IntervaloEjecutado {
  inicio: string
  fin: string
}

export interface CandidataPlan {
  id: string
  titulo: string
  carril: Carril
  duracionMin: number
  vencimiento: string | null
  prioridad: 1 | 2 | 3 | 4
  indivisible: boolean
  dependenciasCumplidas: boolean
  contexto?: string
  iniciativaId?: string | null
  marcadorReanudacion?: string | null
}

export interface CuotaIniciativa {
  iniciativaId: string
  cuotaSemanalMin: number
  minutosEjecutadosSemana: number
  deudaMin: number
}

export interface EntradaPlanificador {
  fecha: string
  jornada: { inicio: string; fin: string; almuerzoInicio: string; almuerzoFin: string }
  eventosFijos: EventoFijoPlan[]
  bufferAbsorcionMin?: number
  minutosEmergentesHoy?: number
  intervalosEjecutados: IntervaloEjecutado[]
  candidatas: CandidataPlan[]
  cuotasIniciativa?: CuotaIniciativa[]
  ahora: string
}

export interface BloquePlanificado {
  candidataId: string
  inicio: string
  fin: string
  justificacion: Justificacion
  marcadorReanudacion?: string | null
}

export interface ReservaIniciativa {
  iniciativaId: string
  inicio: string
  fin: string
  justificacion: Justificacion
}

export interface Pausa {
  inicio: string
  fin: string
}

export interface NoProgramada {
  candidataId: string
  justificacion: Justificacion
}

export interface DeudaIniciativaRegistrada {
  iniciativaId: string
  minutos: number
}

export interface SalidaPlanificador {
  fecha: string
  bloques: BloquePlanificado[]
  reservasIniciativa: ReservaIniciativa[]
  pausas: Pausa[]
  noProgramadas: NoProgramada[]
  deudasRegistradas: DeudaIniciativaRegistrada[]
  capacidadTotalMin: number
  bufferRestanteMin: number
  capacidadProgramableMin: number
}

const BUFFER_ABSORCION_DEFECTO = 75
const PIEZA_MAXIMA_MIN = 90
const PIEZA_MINIMA_MIN = 25
const UMBRAL_PAUSA_MIN = 75
const DURACION_PAUSA_MIN = 10

/** Divide una duración total en piezas de [25,90] min, sin migajas,
 * mediante reparto equitativo (evita dejar un resto <25 al final). */
export function dividirEnPiezas(duracionTotalMin: number): number[] {
  if (duracionTotalMin <= PIEZA_MAXIMA_MIN) return [duracionTotalMin]
  const n = Math.ceil(duracionTotalMin / PIEZA_MAXIMA_MIN)
  const base = Math.floor(duracionTotalMin / n)
  const resto = duracionTotalMin - base * n
  const piezas: number[] = []
  for (let i = 0; i < n; i += 1) {
    piezas.push(i < resto ? base + 1 : base)
  }
  return piezas
}

function claveOrden(
  candidata: CandidataPlan,
  fecha: string,
  deudaPorIniciativa: ReadonlyMap<string, number>,
): [number, number, number, number, number, string] {
  const venceHoyOAntes = candidata.vencimiento !== null && candidata.vencimiento <= fecha ? 0 : 1
  const holgura =
    candidata.vencimiento !== null ? diasHabilesEntre(fecha, candidata.vencimiento) : 9999
  const deuda = candidata.iniciativaId ? (deudaPorIniciativa.get(candidata.iniciativaId) ?? 0) : 0
  return [venceHoyOAntes, holgura, -candidata.prioridad, -deuda, candidata.duracionMin, candidata.id]
}

function compararClaves(
  a: [number, number, number, number, number, string],
  b: [number, number, number, number, number, string],
): number {
  for (let i = 0; i < a.length - 1; i += 1) {
    const va = a[i] as number
    const vb = b[i] as number
    if (va !== vb) return va - vb
  }
  return String(a[5]).localeCompare(String(b[5]))
}

function elegirJustificacion(candidata: CandidataPlan, fecha: string): Justificacion {
  if (candidata.vencimiento !== null && candidata.vencimiento <= fecha) {
    return { codigo: 'VENCE_HOY', texto: `"${candidata.titulo}" vence hoy (${fecha}).` }
  }
  if (candidata.vencimiento !== null && diasHabilesEntre(fecha, candidata.vencimiento) <= 1) {
    return {
      codigo: 'HOLGURA_MINIMA',
      texto: `"${candidata.titulo}" tiene un día hábil o menos de holgura antes de su vencimiento.`,
    }
  }
  if (candidata.prioridad >= 4) {
    return { codigo: 'PRIORIDAD_ALTA', texto: `"${candidata.titulo}" tiene prioridad alta (${candidata.prioridad}).` }
  }
  return { codigo: 'RELLENO_CAPACIDAD', texto: `"${candidata.titulo}" ocupa capacidad disponible sin urgencia inmediata.` }
}

function extraerHueco(huecos: Intervalo[], indice: number, inicio: number, fin: number): void {
  const hueco = huecos[indice]
  if (!hueco) throw new Error('índice de hueco inválido')
  const restosAntes = hueco.inicio < inicio ? [{ inicio: hueco.inicio, fin: inicio }] : []
  const restosDespues = fin < hueco.fin ? [{ inicio: fin, fin: hueco.fin }] : []
  huecos.splice(indice, 1, ...restosAntes, ...restosDespues)
}

interface ColocacionParcial {
  piezas: Array<{ inicio: number; fin: number }>
  pausas: Array<{ inicio: number; fin: number }>
  minutosColocados: number
}

/** Intenta colocar `minutosObjetivo` (fragmentando si `permitirFragmentar`)
 * dentro de `huecos`/`presupuesto`, sin exceder ninguno de los dos.
 * Muta `huecos` solo si la colocación se confirma (se pasa una copia). */
function intentarColocar(
  minutosObjetivo: number,
  permitirFragmentar: boolean,
  huecos: Intervalo[],
  presupuestoDisponible: number,
): ColocacionParcial | null {
  if (!permitirFragmentar) {
    const indice = huecos.findIndex((h) => duracion(h) >= minutosObjetivo)
    if (indice === -1 || presupuestoDisponible < minutosObjetivo) return null
    const hueco = huecos[indice] as Intervalo
    const inicio = hueco.inicio
    const fin = inicio + minutosObjetivo
    extraerHueco(huecos, indice, inicio, fin)
    return { piezas: [{ inicio, fin }], pausas: [], minutosColocados: minutosObjetivo }
  }

  const piezasObjetivo = dividirEnPiezas(minutosObjetivo)
  const piezasColocadas: Array<{ inicio: number; fin: number }> = []
  const pausasColocadas: Array<{ inicio: number; fin: number }> = []
  let presupuesto = presupuestoDisponible

  for (const piezaObjetivo of piezasObjetivo) {
    let pieza = piezaObjetivo
    let colocada = false

    for (let i = 0; i < huecos.length && !colocada; i += 1) {
      const hueco = huecos[i] as Intervalo
      const espacio = duracion(hueco)
      if (espacio < PIEZA_MINIMA_MIN || presupuesto < PIEZA_MINIMA_MIN) continue

      let tamano = Math.min(pieza, espacio, presupuesto, PIEZA_MAXIMA_MIN)
      if (tamano < PIEZA_MINIMA_MIN) continue

      // Sin migajas: si el sobrante de este hueco tras colocar la pieza
      // cae en (0,25), absorbe ese sobrante en la propia pieza (hasta el
      // máximo permitido) o cede el excedente reduciendo `tamano`.
      const sobranteHueco = espacio - tamano
      if (sobranteHueco > 0 && sobranteHueco < PIEZA_MINIMA_MIN) {
        tamano = Math.min(espacio, PIEZA_MAXIMA_MIN, presupuesto)
      }
      if (tamano < PIEZA_MINIMA_MIN || tamano > pieza) {
        // No se puede ajustar sin romper los límites de la pieza objetivo.
        if (tamano > pieza) tamano = pieza
        else continue
      }

      const inicio = hueco.inicio
      const fin = inicio + tamano
      extraerHueco(huecos, i, inicio, fin)
      piezasColocadas.push({ inicio, fin })
      presupuesto -= tamano
      pieza -= tamano
      colocada = true

      if (tamano >= UMBRAL_PAUSA_MIN && pieza <= 0) {
        const indiceActualizado = huecos.findIndex((h) => h.inicio === fin)
        if (indiceActualizado !== -1) {
          const huecoSiguiente = huecos[indiceActualizado] as Intervalo
          if (duracion(huecoSiguiente) > 0 && presupuesto > 0) {
            const finPausa = Math.min(fin + DURACION_PAUSA_MIN, huecoSiguiente.fin)
            extraerHueco(huecos, indiceActualizado, fin, finPausa)
            pausasColocadas.push({ inicio: fin, fin: finPausa })
          }
        }
      }

      if (pieza > 0) {
        // Resto de esta pieza objetivo continúa en el siguiente hueco disponible.
        piezasObjetivo.push(pieza)
        pieza = 0
      }
    }

    if (!colocada) {
      return null
    }
  }

  const minutosColocados = piezasColocadas.reduce((total, p) => total + (p.fin - p.inicio), 0)
  return { piezas: piezasColocadas, pausas: pausasColocadas, minutosColocados }
}

export function planificarDia(entrada: EntradaPlanificador): SalidaPlanificador {
  const bufferAbsorcionMin = entrada.bufferAbsorcionMin ?? BUFFER_ABSORCION_DEFECTO
  const minutosEmergentesHoy = entrada.minutosEmergentesHoy ?? 0
  const jornadaInicio = aMinutos(entrada.jornada.inicio)
  const jornadaFin = aMinutos(entrada.jornada.fin)
  const ahoraMin = aMinutos(entrada.ahora)

  const ocupados: Intervalo[] = [
    { inicio: aMinutos(entrada.jornada.almuerzoInicio), fin: aMinutos(entrada.jornada.almuerzoFin) },
    ...entrada.eventosFijos.map((e) => ({ inicio: aMinutos(e.inicio), fin: aMinutos(e.fin) })),
    ...entrada.intervalosEjecutados.map((i) => ({ inicio: aMinutos(i.inicio), fin: aMinutos(i.fin) })),
  ]

  const huecos = restarIntervalos(
    { inicio: Math.max(ahoraMin, jornadaInicio), fin: jornadaFin },
    ocupados,
  )

  const capacidadTotalMin = huecos.reduce((total, h) => total + duracion(h), 0)
  const bufferRestanteMin = Math.max(0, bufferAbsorcionMin - minutosEmergentesHoy)
  const capacidadProgramableMin = Math.max(0, capacidadTotalMin - bufferRestanteMin)

  const bloques: BloquePlanificado[] = []
  const reservasIniciativa: ReservaIniciativa[] = []
  const pausas: Pausa[] = []
  const noProgramadas: NoProgramada[] = []
  const deudasRegistradas: DeudaIniciativaRegistrada[] = []

  let presupuestoRestante = capacidadProgramableMin
  const jornadaTerminada = ahoraMin >= jornadaFin

  // --- Reserva de cuota de iniciativas (antes del reparto general) -------
  const cuotas = [...(entrada.cuotasIniciativa ?? [])].sort((a, b) =>
    a.iniciativaId.localeCompare(b.iniciativaId),
  )
  const diasRestantesEnSemana = diasHabilesEntre(entrada.fecha, finDeSemana(entrada.fecha))
  const deudaPorIniciativa = new Map<string, number>(cuotas.map((c) => [c.iniciativaId, c.deudaMin]))

  if (!jornadaTerminada) {
    for (const cuota of cuotas) {
      const faltante = Math.max(0, cuota.cuotaSemanalMin - cuota.minutosEjecutadosSemana)
      if (faltante <= 0 || diasRestantesEnSemana < 2) continue
      const reservaMin = Math.min(60, faltante)
      const resultado = intentarColocar(reservaMin, false, huecos, presupuestoRestante)
      if (!resultado) continue
      presupuestoRestante -= resultado.minutosColocados
      const pieza = resultado.piezas[0]
      if (!pieza) continue
      reservasIniciativa.push({
        iniciativaId: cuota.iniciativaId,
        inicio: aHHMM(pieza.inicio),
        fin: aHHMM(pieza.fin),
        justificacion: {
          codigo: 'CUOTA_INICIATIVA',
          texto: `Minutos protegidos para que la iniciativa ${cuota.iniciativaId} no pierda su cuota semanal.`,
        },
      })
    }
  }

  // --- Reparto general -----------------------------------------------------
  const candidatasOrdenadas = [...entrada.candidatas].sort((a, b) =>
    compararClaves(
      claveOrden(a, entrada.fecha, deudaPorIniciativa),
      claveOrden(b, entrada.fecha, deudaPorIniciativa),
    ),
  )

  for (const candidata of candidatasOrdenadas) {
    if (!candidata.dependenciasCumplidas) {
      noProgramadas.push({
        candidataId: candidata.id,
        justificacion: {
          codigo: 'BLOQUEADA_POR_DEPENDENCIA',
          texto: `"${candidata.titulo}" tiene dependencias sin cumplir.`,
        },
      })
      continue
    }

    if (jornadaTerminada) {
      noProgramadas.push({
        candidataId: candidata.id,
        justificacion: { codigo: 'FUERA_DE_JORNADA', texto: 'La jornada de hoy ya terminó.' },
      })
      continue
    }

    const resultado = intentarColocar(
      candidata.duracionMin,
      !candidata.indivisible,
      huecos,
      presupuestoRestante,
    )

    if (resultado) {
      presupuestoRestante -= resultado.minutosColocados
      const justificacionBase = elegirJustificacion(candidata, entrada.fecha)
      resultado.piezas.forEach((pieza, indice) => {
        const esFragmento = resultado.piezas.length > 1
        bloques.push({
          candidataId: candidata.id,
          inicio: aHHMM(pieza.inicio),
          fin: aHHMM(pieza.fin),
          justificacion:
            esFragmento && indice > 0
              ? {
                  codigo: 'FRAGMENTADA_LIMITE_90MIN',
                  texto: `Fragmento ${indice + 1} de "${candidata.titulo}" (máximo 90 min por pieza).`,
                }
              : justificacionBase,
          marcadorReanudacion: candidata.marcadorReanudacion ?? null,
        })
      })
      resultado.pausas.forEach((pausa) => {
        pausas.push({ inicio: aHHMM(pausa.inicio), fin: aHHMM(pausa.fin) })
      })
      continue
    }

    // No colocada en el primer intento. Si vence hoy, se intenta desalojar
    // una reserva de cuota de iniciativa antes de rendirse.
    const venceHoy = candidata.vencimiento !== null && candidata.vencimiento <= entrada.fecha
    if (venceHoy && reservasIniciativa.length > 0) {
      const indiceReserva = reservasIniciativa.findIndex(
        (r) => aMinutos(r.fin) - aMinutos(r.inicio) > 0,
      )
      if (indiceReserva !== -1) {
        const reserva = reservasIniciativa[indiceReserva] as ReservaIniciativa
        const huecosConReserva = [
          ...huecos,
          { inicio: aMinutos(reserva.inicio), fin: aMinutos(reserva.fin) },
        ].sort((a, b) => a.inicio - b.inicio)
        const presupuestoConReserva =
          presupuestoRestante + (aMinutos(reserva.fin) - aMinutos(reserva.inicio))
        const reintento = intentarColocar(
          candidata.duracionMin,
          !candidata.indivisible,
          huecosConReserva,
          presupuestoConReserva,
        )
        if (reintento) {
          huecos.length = 0
          huecos.push(...huecosConReserva)
          presupuestoRestante = presupuestoConReserva - reintento.minutosColocados
          const minutosDesalojados = aMinutos(reserva.fin) - aMinutos(reserva.inicio)
          reservasIniciativa.splice(indiceReserva, 1)
          const deudaPrevia = deudaPorIniciativa.get(reserva.iniciativaId) ?? 0
          deudaPorIniciativa.set(reserva.iniciativaId, deudaPrevia + minutosDesalojados)
          deudasRegistradas.push({ iniciativaId: reserva.iniciativaId, minutos: minutosDesalojados })

          reintento.piezas.forEach((pieza) => {
            bloques.push({
              candidataId: candidata.id,
              inicio: aHHMM(pieza.inicio),
              fin: aHHMM(pieza.fin),
              justificacion: {
                codigo: 'CUOTA_DESPLAZADA_POR_URGENCIA',
                texto: `"${candidata.titulo}" vence hoy y desalojó ${minutosDesalojados} min reservados para la iniciativa ${reserva.iniciativaId}.`,
              },
              marcadorReanudacion: candidata.marcadorReanudacion ?? null,
            })
          })
          reintento.pausas.forEach((pausa) => {
            pausas.push({ inicio: aHHMM(pausa.inicio), fin: aHHMM(pausa.fin) })
          })
          continue
        }
      }
    }

    const cabeFisicamente = candidata.indivisible
      ? huecos.some((h) => duracion(h) >= candidata.duracionMin)
      : huecos.reduce((total, h) => total + duracion(h), 0) >= candidata.duracionMin

    if (!cabeFisicamente) {
      noProgramadas.push({
        candidataId: candidata.id,
        justificacion: {
          codigo: 'NO_CABE_INDIVISIBLE',
          texto: `"${candidata.titulo}" (${candidata.duracionMin} min, indivisible) no cabe en ningún hueco disponible.`,
        },
      })
      continue
    }

    if (presupuestoRestante < candidata.duracionMin) {
      noProgramadas.push({
        candidataId: candidata.id,
        justificacion: {
          codigo: 'PROTEGIDO_BUFFER_ABSORCION',
          texto: `"${candidata.titulo}" cabría físicamente, pero excedería el buffer de absorción reservado (${bufferRestanteMin} min).`,
        },
      })
      continue
    }

    noProgramadas.push({
      candidataId: candidata.id,
      justificacion: {
        codigo: 'SIN_CAPACIDAD_PROGRAMABLE',
        texto: `No queda capacidad programable disponible para "${candidata.titulo}".`,
      },
    })
  }

  return {
    fecha: entrada.fecha,
    bloques: bloques.sort((a, b) => aMinutos(a.inicio) - aMinutos(b.inicio)),
    reservasIniciativa,
    pausas,
    noProgramadas,
    deudasRegistradas,
    capacidadTotalMin,
    bufferRestanteMin,
    capacidadProgramableMin,
  }
}
