// CA-07: crear tipos de trámite (etapas con dependencias y plazos en
// días hábiles), instanciarlos y ver/avanzar la próxima acción de cada
// trámite abierto. El motor (dominio/tramites.ts) ya está cerrado y
// probado; este panel solo lo cablea a Dexie.

import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { obtenerDb, obtenerDeviceIdActual, reloj } from '../../config/contexto'
import { completarPasoTramite, crearTipoTramite, crearTramite } from '../../datos/tramites'
import { construirVistaTramites } from '../../datos/tramitesVista'
import { creadorDeSecuencia } from '../../datos/secuencia'
import type { EtapaTramite } from '../../dominio/tipos'

interface EtapaBorrador {
  id: string
  nombre: string
  plazoDiasHabiles: number
  producto: string
  dependencias: string[]
  condiciones: string
}

function nuevaEtapaBorrador(): EtapaBorrador {
  return {
    id: crypto.randomUUID(),
    nombre: '',
    plazoDiasHabiles: 1,
    producto: '',
    dependencias: [],
    condiciones: '',
  }
}

export function PanelTramites() {
  const db = obtenerDb()
  const deviceId = obtenerDeviceIdActual()

  const [mostrandoNuevoTipo, setMostrandoNuevoTipo] = useState(false)
  const [nombreTipo, setNombreTipo] = useState('')
  const [etapas, setEtapas] = useState<EtapaBorrador[]>([nuevaEtapaBorrador()])
  const [guardandoTipo, setGuardandoTipo] = useState(false)

  const [mostrandoNuevoTramite, setMostrandoNuevoTramite] = useState(false)
  const [tipoElegidoId, setTipoElegidoId] = useState('')
  const [tituloTramite, setTituloTramite] = useState('')
  const [fechaInicio, setFechaInicio] = useState(reloj.ahora().slice(0, 10))
  const [guardandoTramite, setGuardandoTramite] = useState(false)
  const [completandoPasoId, setCompletandoPasoId] = useState<string | null>(null)

  const tipos = useLiveQuery(() => db.tiposTramite.toArray(), [], [])
  const tramites = useLiveQuery(() => db.tramites.toArray(), [], [])
  const pasos = useLiveQuery(() => db.pasosTramite.toArray(), [], [])
  const vista = useLiveQuery(
    () => construirVistaTramites(db),
    [tramites?.length, tipos?.length, pasos?.length],
    [],
  )

  function deps() {
    return {
      db,
      deviceId,
      ahoraISO: () => reloj.ahora(),
      siguienteClientSequenceEvento: creadorDeSecuencia(db, deviceId, 'evento'),
    }
  }

  function agregarEtapa() {
    setEtapas((actual) => [...actual, nuevaEtapaBorrador()])
  }

  function quitarEtapa(id: string) {
    setEtapas((actual) => actual.filter((e) => e.id !== id))
  }

  function actualizarEtapa(id: string, cambios: Partial<EtapaBorrador>) {
    setEtapas((actual) => actual.map((e) => (e.id === id ? { ...e, ...cambios } : e)))
  }

  function alternarDependencia(id: string, dependeDeId: string) {
    setEtapas((actual) =>
      actual.map((e) => {
        if (e.id !== id) return e
        const yaDepende = e.dependencias.includes(dependeDeId)
        return {
          ...e,
          dependencias: yaDepende
            ? e.dependencias.filter((d) => d !== dependeDeId)
            : [...e.dependencias, dependeDeId],
        }
      }),
    )
  }

  async function guardarTipoTramite() {
    const nombre = nombreTipo.trim()
    const etapasValidas = etapas.filter((e) => e.nombre.trim())
    if (!nombre || etapasValidas.length === 0 || guardandoTipo) return
    setGuardandoTipo(true)
    try {
      const etapasFinales: EtapaTramite[] = etapasValidas.map((e, indice) => ({
        id: e.id,
        nombre: e.nombre.trim(),
        orden: indice + 1,
        condiciones: e.condiciones
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean),
        dependencias: e.dependencias,
        plazo_dias_habiles: e.plazoDiasHabiles,
        producto: e.producto.trim(),
      }))
      await crearTipoTramite(deps(), { nombre, etapas: etapasFinales })
      setNombreTipo('')
      setEtapas([nuevaEtapaBorrador()])
      setMostrandoNuevoTipo(false)
    } finally {
      setGuardandoTipo(false)
    }
  }

  async function guardarTramite() {
    const titulo = tituloTramite.trim()
    const tipo = (tipos ?? []).find((t) => t.id === tipoElegidoId)
    if (!titulo || !tipo || !fechaInicio || guardandoTramite) return
    setGuardandoTramite(true)
    try {
      await crearTramite(deps(), {
        tipoTramiteId: tipo.id,
        tipoTramiteVersion: tipo.version,
        titulo,
        fechaInicio,
      })
      setTituloTramite('')
      setTipoElegidoId('')
      setMostrandoNuevoTramite(false)
    } finally {
      setGuardandoTramite(false)
    }
  }

  async function marcarCompletada(tramiteId: string, etapaId: string) {
    if (completandoPasoId) return
    setCompletandoPasoId(etapaId)
    try {
      await completarPasoTramite(deps(), tramiteId, etapaId)
    } finally {
      setCompletandoPasoId(null)
    }
  }

  return (
    <div className="geo-panel" aria-label="Trámites">
      <h2>Trámites</h2>

      <ul aria-label="Trámites abiertos">
        {(vista ?? []).map((v) => (
          <li key={v.id}>
            <strong>{v.titulo}</strong> ({v.tipoNombre})
            {v.proximaAccion ? (
              <p>
                Próxima acción: <strong>{v.proximaAccion.nombre}</strong>
                {v.proximaAccion.producto && ` — produce: ${v.proximaAccion.producto}`}
                {v.proximaAccion.bloqueadaPorDependencia
                  ? ' — bloqueada por dependencia'
                  : v.proximaAccion.fechaLimite && ` — límite ${v.proximaAccion.fechaLimite}`}
                <br />
                <button
                  type="button"
                  disabled={
                    v.proximaAccion.bloqueadaPorDependencia || completandoPasoId === v.proximaAccion.etapaId
                  }
                  onClick={() => void marcarCompletada(v.id, (v.proximaAccion as { etapaId: string }).etapaId)}
                >
                  Marcar &quot;{v.proximaAccion.nombre}&quot; como completada
                </button>
              </p>
            ) : (
              <p>Sin próxima acción — todas las etapas están completas.</p>
            )}
          </li>
        ))}
      </ul>

      {mostrandoNuevoTramite ? (
        <div className="geo-panel">
          <label>
            Tipo de trámite
            <select
              value={tipoElegidoId}
              onChange={(e) => setTipoElegidoId(e.target.value)}
              aria-label="Tipo de trámite"
            >
              <option value="">— elegir —</option>
              {(tipos ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </label>
          <input
            type="text"
            placeholder="Título del trámite (p. ej. CASO-2026-001)"
            value={tituloTramite}
            onChange={(e) => setTituloTramite(e.target.value)}
            aria-label="Título del trámite"
          />
          <label>
            Fecha de inicio
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              aria-label="Fecha de inicio del trámite"
            />
          </label>
          <button
            type="button"
            onClick={() => void guardarTramite()}
            disabled={!tituloTramite.trim() || !tipoElegidoId || guardandoTramite}
          >
            Guardar trámite
          </button>
        </div>
      ) : (
        (tipos ?? []).length > 0 && (
          <button type="button" onClick={() => setMostrandoNuevoTramite(true)}>
            Nuevo trámite
          </button>
        )
      )}

      {mostrandoNuevoTipo ? (
        <div className="geo-panel">
          <input
            type="text"
            placeholder="Nombre del tipo de trámite"
            value={nombreTipo}
            onChange={(e) => setNombreTipo(e.target.value)}
            aria-label="Nombre del tipo de trámite"
            autoFocus
          />

          <ul className="geo-lista-etapas" aria-label="Etapas del tipo de trámite">
            {etapas.map((etapa, indice) => (
              <li key={etapa.id}>
                <p>Etapa {indice + 1}</p>
                <input
                  type="text"
                  placeholder="Nombre de la etapa"
                  value={etapa.nombre}
                  onChange={(e) => actualizarEtapa(etapa.id, { nombre: e.target.value })}
                  aria-label={`Nombre de la etapa ${indice + 1}`}
                />
                <label>
                  Plazo (días hábiles)
                  <input
                    type="number"
                    min={0}
                    value={etapa.plazoDiasHabiles}
                    onChange={(e) =>
                      actualizarEtapa(etapa.id, { plazoDiasHabiles: Number(e.target.value) })
                    }
                    aria-label={`Plazo en días hábiles de la etapa ${indice + 1}`}
                  />
                </label>
                <input
                  type="text"
                  placeholder="Producto que entrega esta etapa"
                  value={etapa.producto}
                  onChange={(e) => actualizarEtapa(etapa.id, { producto: e.target.value })}
                  aria-label={`Producto de la etapa ${indice + 1}`}
                />
                <input
                  type="text"
                  placeholder="Condiciones (separadas por coma, opcional)"
                  value={etapa.condiciones}
                  onChange={(e) => actualizarEtapa(etapa.id, { condiciones: e.target.value })}
                  aria-label={`Condiciones de la etapa ${indice + 1}`}
                />
                {etapas.filter((e) => e.id !== etapa.id).length > 0 && (
                  <fieldset>
                    <legend>Depende de</legend>
                    {etapas
                      .filter((e) => e.id !== etapa.id)
                      .map((otra, indiceOtra) => (
                        <label key={otra.id}>
                          <input
                            type="checkbox"
                            checked={etapa.dependencias.includes(otra.id)}
                            onChange={() => alternarDependencia(etapa.id, otra.id)}
                          />
                          {otra.nombre.trim() || `Etapa ${etapas.findIndex((e) => e.id === otra.id) + 1 || indiceOtra + 1}`}
                        </label>
                      ))}
                  </fieldset>
                )}
                {etapas.length > 1 && (
                  <button type="button" onClick={() => quitarEtapa(etapa.id)}>
                    Quitar etapa
                  </button>
                )}
              </li>
            ))}
          </ul>

          <button type="button" onClick={agregarEtapa}>
            Agregar etapa
          </button>
          <button
            type="button"
            onClick={() => void guardarTipoTramite()}
            disabled={!nombreTipo.trim() || !etapas.some((e) => e.nombre.trim()) || guardandoTipo}
          >
            Guardar tipo de trámite
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setMostrandoNuevoTipo(true)}>
          Nuevo tipo de trámite
        </button>
      )}
    </div>
  )
}
