// CA-07: un trámite instancia un tipo de trámite versionado, con etapas,
// dependencias y plazos relativos en días hábiles; expone una única
// próxima acción derivada automáticamente. Puro: no toca Dexie.

import { sumarDiasHabiles } from './calendario'
import type { EtapaTramite } from './tipos'

export interface PasoEstado {
  etapaId: string
  estado: 'pendiente' | 'completado'
}

export interface ProximaAccionTramite {
  etapaId: string
  nombre: string
  producto: string
  fechaLimite: string | null
  bloqueadaPorDependencia: boolean
}

/** La próxima acción es la primera etapa (por orden) que no está
 * completada y cuyas dependencias (otras etapas) sí lo están. Si todas
 * las etapas están completas, no hay próxima acción (null). */
export function proximaAccion(
  etapas: readonly EtapaTramite[],
  pasos: readonly PasoEstado[],
  fechaInicio: string,
): ProximaAccionTramite | null {
  const estadoPorEtapa = new Map(pasos.map((p) => [p.etapaId, p.estado]))
  const etapasOrdenadas = [...etapas].sort((a, b) => a.orden - b.orden)

  for (const etapa of etapasOrdenadas) {
    const estado = estadoPorEtapa.get(etapa.id) ?? 'pendiente'
    if (estado === 'completado') continue

    const dependenciasCumplidas = etapa.dependencias.every(
      (dep) => estadoPorEtapa.get(dep) === 'completado',
    )

    const diasAcumulados = etapasOrdenadas
      .filter((e) => e.orden <= etapa.orden)
      .reduce((total, e) => total + e.plazo_dias_habiles, 0)

    return {
      etapaId: etapa.id,
      nombre: etapa.nombre,
      producto: etapa.producto,
      fechaLimite: dependenciasCumplidas
        ? sumarDiasHabiles(fechaInicio, diasAcumulados)
        : null,
      bloqueadaPorDependencia: !dependenciasCumplidas,
    }
  }

  return null
}
