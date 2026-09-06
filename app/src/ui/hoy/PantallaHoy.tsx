import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { obtenerDb, obtenerDeviceIdActual, reloj } from '../../config/contexto'
import {
  finalizarActividad,
  iniciarActividad,
  interrumpirActividad,
  reanudarActividad,
  registrarFinDeEmergente,
} from '../../datos/actividades'
import { crearAsignacion, type DependenciasEscritura } from '../../datos/asignaciones'
import { construirEntradaPlanificador } from '../../datos/planificadorDatos'
import { creadorDeSecuencia } from '../../datos/secuencia'
import type { Carril, Interrupcion } from '../../dominio/tipos'
import { planificarDia } from '../../dominio/planificador'
import { navegarA } from '../../router'

function aHHMM(iso: string): string {
  return iso.slice(11, 16)
}

export function PantallaHoy() {
  const db = obtenerDb()
  const deviceId = obtenerDeviceIdActual()
  const [marcadorInterrupcion, setMarcadorInterrupcion] = useState('')
  const [mostrandoInterrupcion, setMostrandoInterrupcion] = useState(false)
  const [mostrandoNueva, setMostrandoNueva] = useState(false)
  const [nuevoTitulo, setNuevoTitulo] = useState('')
  const [nuevaDuracion, setNuevaDuracion] = useState(60)
  const [nuevoVencimiento, setNuevoVencimiento] = useState('')
  const [nuevaPrioridad, setNuevaPrioridad] = useState<1 | 2 | 3 | 4>(2)
  const [nuevoIndivisible, setNuevoIndivisible] = useState(false)
  const [nuevoCarril, setNuevoCarril] = useState<Carril>('planificado')

  const ahoraISO = reloj.ahora()
  const fecha = ahoraISO.slice(0, 10)
  const ahoraHHMM = aHHMM(ahoraISO)

  const asignaciones = useLiveQuery(() => db.asignaciones.toArray(), [], [])
  const actividadEnCurso = useLiveQuery(
    () => db.actividades.filter((a) => a.estado === 'en_curso').first(),
    [],
    undefined,
  )
  const actividadInterrumpida = useLiveQuery(
    () => db.actividades.filter((a) => a.estado === 'interrumpida').first(),
    [],
    undefined,
  )
  const interrupcionAbierta = useLiveQuery<Interrupcion | undefined, undefined>(
    async () => {
      if (!actividadInterrumpida) return undefined
      return db.interrupciones
        .where('actividad_id')
        .equals(actividadInterrumpida.id)
        .filter((i) => i.fin === null)
        .first()
    },
    [actividadInterrumpida?.id],
    undefined,
  )

  const plan = useLiveQuery(
    async () => {
      const entrada = await construirEntradaPlanificador(db, fecha, ahoraHHMM)
      return planificarDia(entrada)
    },
    [fecha, ahoraHHMM, asignaciones?.length],
    null,
  )

  const asignacionPorId = new Map((asignaciones ?? []).map((a) => [a.id, a]))

  const bloqueEnCurso = plan?.bloques.find((b) => b.inicio <= ahoraHHMM && ahoraHHMM < b.fin)
  const proximoBloque = plan?.bloques.find((b) => b.inicio > ahoraHHMM)

  function deps(): DependenciasEscritura {
    return {
      db,
      deviceId,
      ahoraISO: () => reloj.ahora(),
      siguienteClientSequenceEvento: creadorDeSecuencia(db, deviceId, 'evento'),
      siguienteClientSequenceCambio: creadorDeSecuencia(db, deviceId, 'cambio'),
    }
  }

  async function iniciar(asignacionId: string) {
    const asignacion = asignacionPorId.get(asignacionId)
    if (!asignacion) return
    await iniciarActividad(deps(), asignacionId, asignacion.carril)
  }

  async function terminar() {
    if (!actividadEnCurso) return
    await finalizarActividad(deps(), actividadEnCurso.id)
  }

  async function confirmarInterrupcion() {
    if (!actividadEnCurso || !marcadorInterrupcion.trim()) return
    await interrumpirActividad(deps(), actividadEnCurso.id, marcadorInterrupcion.trim())
    setMarcadorInterrupcion('')
    setMostrandoInterrupcion(false)
  }

  async function crearNuevaAsignacion() {
    if (!nuevoTitulo.trim()) return
    await crearAsignacion(deps(), {
      titulo: nuevoTitulo.trim(),
      carril: nuevoCarril,
      duracionEstimadaMin: nuevaDuracion,
      vencimiento: nuevoVencimiento || null,
      prioridad: nuevaPrioridad,
      indivisible: nuevoIndivisible,
    })
    setNuevoTitulo('')
    setNuevaDuracion(60)
    setNuevoVencimiento('')
    setNuevaPrioridad(2)
    setNuevoIndivisible(false)
    setMostrandoNueva(false)
  }

  async function terminarEmergenteYRetomar() {
    if (!interrupcionAbierta || !actividadInterrumpida) return
    await registrarFinDeEmergente(deps(), interrupcionAbierta.id, 'atención emergente', actividadInterrumpida.carril)
    await reanudarActividad(deps(), actividadInterrumpida.id)
  }

  return (
    <section aria-labelledby="titulo-hoy">
      <h1 id="titulo-hoy">Hoy</h1>

      {actividadInterrumpida && interrupcionAbierta && (
        <div className="geo-panel geo-retomar" role="status">
          <p>
            Interrumpiste: <strong>{actividadInterrumpida.marcador_reanudacion}</strong>
          </p>
          <button type="button" onClick={() => void terminarEmergenteYRetomar()}>
            Terminé el emergente — retomar
          </button>
        </div>
      )}

      <div className="geo-panel" aria-label="Capacidad del día">
        <p>Capacidad total: {plan?.capacidadTotalMin ?? '—'} min</p>
        <p>Buffer de absorción restante: {plan?.bufferRestanteMin ?? '—'} min</p>
        <p>Capacidad programable: {plan?.capacidadProgramableMin ?? '—'} min</p>
      </div>

      <div className="geo-panel" aria-label="Bloque en curso">
        <h2>Ahora</h2>
        {bloqueEnCurso ? (
          <p>
            {asignacionPorId.get(bloqueEnCurso.candidataId)?.titulo ?? bloqueEnCurso.candidataId} (
            {bloqueEnCurso.inicio}–{bloqueEnCurso.fin}) — {bloqueEnCurso.justificacion.texto}
          </p>
        ) : (
          <p>Sin bloque programado en este momento.</p>
        )}

        {actividadEnCurso ? (
          <div className="geo-acciones-grandes">
            <button type="button" onClick={() => void terminar()}>
              Terminar
            </button>
            <button type="button" onClick={() => setMostrandoInterrupcion(true)}>
              Interrumpir
            </button>
          </div>
        ) : (
          bloqueEnCurso && (
            <button type="button" onClick={() => void iniciar(bloqueEnCurso.candidataId)}>
              Iniciar
            </button>
          )
        )}

        {mostrandoInterrupcion && (
          <div className="geo-panel">
            <input
              type="text"
              placeholder="¿En qué te quedaste?"
              value={marcadorInterrupcion}
              onChange={(e) => setMarcadorInterrupcion(e.target.value)}
              aria-label="Marcador de reanudación"
              autoFocus
            />
            <button type="button" onClick={() => void confirmarInterrupcion()}>
              Confirmar interrupción
            </button>
          </div>
        )}
      </div>

      <div className="geo-panel" aria-label="Próximo">
        <h2>Próximo</h2>
        {proximoBloque ? (
          <p>
            {asignacionPorId.get(proximoBloque.candidataId)?.titulo ?? proximoBloque.candidataId} (
            {proximoBloque.inicio}–{proximoBloque.fin})
          </p>
        ) : (
          <p>Nada más programado por hoy.</p>
        )}
      </div>

      <div className="geo-panel" aria-label="Asignaciones abiertas">
        <h2>Asignaciones abiertas</h2>
        <ul>
          {(asignaciones ?? [])
            .filter((a) => a.estado === 'programado')
            .map((a) => (
              <li key={a.id}>
                {a.titulo} — {a.duracion_estimada_min} min — prioridad {a.prioridad}
                {a.vencimiento ? ` — vence ${a.vencimiento}` : ''}
                {!actividadEnCurso && !actividadInterrumpida && (
                  <button type="button" onClick={() => void iniciar(a.id)}>
                    Iniciar
                  </button>
                )}
              </li>
            ))}
        </ul>

        {mostrandoNueva ? (
          <div className="geo-panel">
            <input
              type="text"
              placeholder="Título de la asignación"
              value={nuevoTitulo}
              onChange={(e) => setNuevoTitulo(e.target.value)}
              aria-label="Título de la nueva asignación"
              autoFocus
            />
            <label>
              Duración (min)
              <input
                type="number"
                min={5}
                value={nuevaDuracion}
                onChange={(e) => setNuevaDuracion(Number(e.target.value))}
                aria-label="Duración estimada en minutos"
              />
            </label>
            <label>
              Vencimiento
              <input
                type="date"
                value={nuevoVencimiento}
                onChange={(e) => setNuevoVencimiento(e.target.value)}
                aria-label="Fecha de vencimiento"
              />
            </label>
            <label>
              Prioridad
              <select
                value={nuevaPrioridad}
                onChange={(e) => setNuevaPrioridad(Number(e.target.value) as 1 | 2 | 3 | 4)}
                aria-label="Prioridad"
              >
                <option value={1}>1 — baja</option>
                <option value={2}>2 — media</option>
                <option value={3}>3 — alta</option>
                <option value={4}>4 — crítica</option>
              </select>
            </label>
            <label>
              Carril
              <select
                value={nuevoCarril}
                onChange={(e) => setNuevoCarril(e.target.value as Carril)}
                aria-label="Carril"
              >
                <option value="planificado">Planificado</option>
                <option value="reactivo">Reactivo</option>
                <option value="tramite">Trámite</option>
                <option value="iniciativa">Iniciativa</option>
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={nuevoIndivisible}
                onChange={(e) => setNuevoIndivisible(e.target.checked)}
              />
              Indivisible
            </label>
            <button type="button" onClick={() => void crearNuevaAsignacion()}>
              Guardar asignación
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setMostrandoNueva(true)}>
            Nueva asignación
          </button>
        )}
      </div>

      <button type="button" onClick={() => navegarA('capturar')} className="geo-boton-capturar">
        Capturar algo nuevo
      </button>
    </section>
  )
}
