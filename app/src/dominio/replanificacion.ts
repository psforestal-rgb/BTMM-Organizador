// Replanificación tras interrupción (sección 7.4). Pura: no muta
// `entradaOriginal`, no lee el reloj de sistema.

import { aMinutos } from './tiempo'
import { planificarDia, type CandidataPlan, type EntradaPlanificador, type SalidaPlanificador } from './planificador'

export interface InterrupcionInfo {
  candidataInterrumpidaId: string
  inicioInterrupcion: string
  finInterrupcion: string
  marcadorReanudacion: string
  minutosEjecutadosDeLaCandidata: number
}

export function replanificar(
  entradaOriginal: EntradaPlanificador,
  interrupcion: InterrupcionInfo,
  ahora: string,
): SalidaPlanificador {
  const original = entradaOriginal.candidatas.find(
    (c) => c.id === interrupcion.candidataInterrumpidaId,
  )
  if (!original) {
    throw new Error(
      `No se encontró la candidata interrumpida "${interrupcion.candidataInterrumpidaId}"`,
    )
  }

  const remanenteMin = original.duracionMin - interrupcion.minutosEjecutadosDeLaCandidata
  const candidatasSinInterrumpida = entradaOriginal.candidatas.filter((c) => c.id !== original.id)
  const remanente: CandidataPlan = {
    ...original,
    duracionMin: remanenteMin,
    marcadorReanudacion: interrupcion.marcadorReanudacion,
  }
  const candidatas: CandidataPlan[] =
    remanenteMin > 0 ? [...candidatasSinInterrumpida, remanente] : candidatasSinInterrumpida

  const duracionInterrupcionMin =
    aMinutos(interrupcion.finInterrupcion) - aMinutos(interrupcion.inicioInterrupcion)

  const entradaReplanificada: EntradaPlanificador = {
    ...entradaOriginal,
    ahora,
    minutosEmergentesHoy: (entradaOriginal.minutosEmergentesHoy ?? 0) + duracionInterrupcionMin,
    intervalosEjecutados: [
      ...entradaOriginal.intervalosEjecutados,
      { inicio: interrupcion.inicioInterrupcion, fin: interrupcion.finInterrupcion },
    ],
    candidatas,
  }

  const salida = planificarDia(entradaReplanificada)

  const bloques = salida.bloques.map((bloque) => {
    if (bloque.candidataId !== original.id) return bloque
    return {
      ...bloque,
      justificacion: {
        codigo: 'DESPLAZADA_POR_INTERRUPCION' as const,
        texto: `"${original.titulo}" se reprograma tras la interrupción de ${interrupcion.inicioInterrupcion} a ${interrupcion.finInterrupcion} ("${interrupcion.marcadorReanudacion}").`,
      },
    }
  })

  return { ...salida, bloques }
}
