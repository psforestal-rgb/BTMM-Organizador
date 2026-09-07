// Compone Dexie (tiposTramite, tramites, pasosTramite) para alimentar el
// motor puro proximaAccion (dominio/tramites.ts). Este archivo sí toca
// Dexie: vive en src/datos, no en src/dominio (mismo patrón que
// radarSnapshot.ts).

import { proximaAccion, type ProximaAccionTramite } from '../dominio/tramites'
import type { GeoDexie } from './db'

export interface VistaTramite {
  id: string
  titulo: string
  tipoNombre: string
  fechaInicio: string
  proximaAccion: ProximaAccionTramite | null
}

export async function construirVistaTramites(db: GeoDexie): Promise<VistaTramite[]> {
  const [tramites, tipos, pasos] = await Promise.all([
    db.tramites.filter((t) => !t.eliminado).toArray(),
    db.tiposTramite.toArray(),
    db.pasosTramite.toArray(),
  ])

  const tipoPorId = new Map(tipos.map((t) => [t.id, t]))

  return tramites.map((tramite) => {
    const tipo = tipoPorId.get(tramite.tipo_tramite_id)
    const pasosDelTramite = pasos
      .filter((p) => p.tramite_id === tramite.id)
      .map((p) => ({ etapaId: p.etapa_id, estado: p.estado }))

    return {
      id: tramite.id,
      titulo: tramite.titulo,
      tipoNombre: tipo?.nombre ?? tramite.tipo_tramite_id,
      fechaInicio: tramite.fecha_inicio,
      proximaAccion: tipo ? proximaAccion(tipo.etapas, pasosDelTramite, tramite.fecha_inicio) : null,
    }
  })
}
