import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { obtenerDb, obtenerDeviceIdActual, reloj } from '../../config/contexto'
import { cambiarCampoAsignacion, type DependenciasEscritura } from '../../datos/asignaciones'
import { construirRadarSnapshot } from '../../datos/radarSnapshot'
import { creadorDeSecuencia } from '../../datos/secuencia'
import { aplicarDecisionCierre, type DecisionCierre } from '../../dominio/estados'
import { ejecutarRadar, RADAR_CONFIG_DEFECTO, type Hallazgo, type SeveridadHallazgo } from '../../dominio/radar'

const ORDEN_SEVERIDAD: SeveridadHallazgo[] = ['critico', 'atencion', 'info']
const ETIQUETA_SEVERIDAD: Record<SeveridadHallazgo, string> = {
  critico: 'Crítico',
  atencion: 'Atención',
  info: 'Informativo',
}

const OPCIONES_DECISION: Array<{ tipo: DecisionCierre['tipo']; etiqueta: string }> = [
  { tipo: 'continuar_manana', etiqueta: 'Continuar mañana' },
  { tipo: 'programar', etiqueta: 'Programar' },
  { tipo: 'esperar', etiqueta: 'Esperar' },
  { tipo: 'posponer', etiqueta: 'Posponer' },
  { tipo: 'cancelar', etiqueta: 'Cancelar' },
  { tipo: 'hecho', etiqueta: 'Marcar hecho' },
]

export function PantallaRadar() {
  const db = obtenerDb()
  const deviceId = obtenerDeviceIdActual()
  const [decididos, setDecididos] = useState<Set<string>>(new Set())

  const snapshot = useLiveQuery(() => construirRadarSnapshot(db), [], null)
  const hallazgos: Hallazgo[] = snapshot
    ? ejecutarRadar(snapshot, RADAR_CONFIG_DEFECTO, reloj.ahora())
    : []
  const visibles = hallazgos.filter((h) => !decididos.has(`${h.regla}:${h.entidad_id}`))

  function deps(): DependenciasEscritura {
    return {
      db,
      deviceId,
      ahoraISO: () => reloj.ahora(),
      siguienteClientSequenceEvento: creadorDeSecuencia(db, deviceId, 'evento'),
      siguienteClientSequenceCambio: creadorDeSecuencia(db, deviceId, 'cambio'),
    }
  }

  async function decidir(hallazgo: Hallazgo, tipo: DecisionCierre['tipo']) {
    const hoy = reloj.ahora().slice(0, 10)
    let decision: DecisionCierre
    switch (tipo) {
      case 'posponer':
        decision = { tipo: 'posponer', fecha: hoy }
        break
      case 'cancelar':
        decision = { tipo: 'cancelar', motivo: 'decidido desde RADAR' }
        break
      default:
        decision = { tipo } as DecisionCierre
    }
    // Invariante 4: aplicarDecisionCierre rechaza cualquier cosa que no
    // sea una de las seis decisiones válidas — no existe "descartar".
    const resultado = aplicarDecisionCierre(decision, hoy)
    if (hallazgo.entidad_tipo === 'asignacion') {
      await cambiarCampoAsignacion(deps(), hallazgo.entidad_id, {
        estado: resultado.estado,
        fecha_revision: resultado.fecha_revision,
        fecha_pospuesto: resultado.fecha_pospuesto,
        motivo: resultado.motivo,
      })
    }
    setDecididos((previo) => new Set(previo).add(`${hallazgo.regla}:${hallazgo.entidad_id}`))
  }

  return (
    <section aria-labelledby="titulo-radar">
      <h1 id="titulo-radar">Radar</h1>
      <p>¿Qué se me puede estar pasando?</p>

      {visibles.length === 0 && <p>Nada pendiente por ahora.</p>}

      {ORDEN_SEVERIDAD.map((severidad) => {
        const delGrupo = visibles.filter((h) => h.severidad === severidad)
        if (delGrupo.length === 0) return null
        return (
          <div key={severidad} className="geo-grupo-radar">
            <h2>{ETIQUETA_SEVERIDAD[severidad]}</h2>
            <ul>
              {delGrupo.map((hallazgo) => (
                <li key={`${hallazgo.regla}:${hallazgo.entidad_id}`} className="geo-hallazgo">
                  <p>
                    <strong>{hallazgo.titulo}</strong> — {hallazgo.regla}
                  </p>
                  <p>{hallazgo.explicacion}</p>
                  <div className="geo-decisiones">
                    {OPCIONES_DECISION.map((opcion) => (
                      <button
                        key={opcion.tipo}
                        type="button"
                        onClick={() => void decidir(hallazgo, opcion.tipo)}
                      >
                        {opcion.etiqueta}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </section>
  )
}
