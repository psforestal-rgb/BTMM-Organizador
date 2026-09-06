import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { obtenerDb, obtenerDeviceIdActual, obtenerSyncAdapter, reloj } from '../../config/contexto'
import {
  estadoAlmacenamientoConocido,
  solicitarAlmacenamientoPersistente,
} from '../../config/almacenamiento'
import { exportarBitacoraCSV, exportarBitacoraJSON } from '../../datos/exportar'
import { sincronizar } from '../../sync/outbox'

function descargar(nombre: string, contenido: string, tipo: string) {
  const blob = new Blob([contenido], { type: tipo })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  document.body.appendChild(enlace)
  enlace.click()
  document.body.removeChild(enlace)
  URL.revokeObjectURL(url)
}

export function PantallaBitacora() {
  const db = obtenerDb()
  const deviceId = obtenerDeviceIdActual()
  const [persistente, setPersistente] = useState<boolean | null>(estadoAlmacenamientoConocido())
  const [sincronizando, setSincronizando] = useState(false)
  const [ultimoErrorSync, setUltimoErrorSync] = useState<string | null>(null)

  useEffect(() => {
    if (persistente === null) {
      void solicitarAlmacenamientoPersistente().then(setPersistente)
    }
  }, [persistente])

  const eventos = useLiveQuery(() => db.eventos.toArray(), [], [])
  const pendientes = useLiveQuery(() => db.outbox.where('estado').equals('pendiente').count(), [], 0)
  const syncState = useLiveQuery(() => db.syncState.get(deviceId), [deviceId])
  const conflictosAbiertos = useLiveQuery(
    () => db.conflictos.filter((c) => !c.resuelto).count(),
    [],
    0,
  )

  const eventosOrdenados = [...(eventos ?? [])].sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))
  const planificados = eventosOrdenados.filter((e) => e.entity_type !== 'actividad' || e.event_type !== 'emergente_registrado')
  const emergentes = eventosOrdenados.filter((e) => e.event_type === 'emergente_registrado')

  async function sincronizarAhora() {
    setSincronizando(true)
    setUltimoErrorSync(null)
    try {
      await sincronizar(db, obtenerSyncAdapter(), deviceId, reloj.ahora())
    } catch (error) {
      setUltimoErrorSync(error instanceof Error ? error.message : 'error desconocido')
    } finally {
      setSincronizando(false)
    }
  }

  return (
    <section aria-labelledby="titulo-bitacora">
      <h1 id="titulo-bitacora">Bitácora</h1>
      <p>
        Qué ocurrió realmente: {eventosOrdenados.length}{' '}
        {eventosOrdenados.length === 1 ? 'evento registrado' : 'eventos registrados'}.
      </p>

      <div className="geo-panel" aria-label="Estado de sincronización">
        <p>
          Cambios pendientes: <strong>{pendientes}</strong>
        </p>
        <p>Última sincronización correcta: {syncState?.ultima_sync_ok_at ?? 'nunca'}</p>
        <p>Conflictos abiertos: {conflictosAbiertos}</p>
        <p>
          Almacenamiento persistente:{' '}
          {persistente === null ? 'verificando…' : persistente ? 'concedido' : 'no concedido — los datos locales podrían eliminarse bajo presión de almacenamiento'}
        </p>
        <button type="button" onClick={() => void sincronizarAhora()} disabled={sincronizando}>
          {sincronizando ? 'Sincronizando…' : 'Sincronizar ahora'}
        </button>
        {ultimoErrorSync && <p role="alert">Sin conexión o error: {ultimoErrorSync}</p>}
      </div>

      <div className="geo-panel">
        <button
          type="button"
          onClick={() => void exportarBitacoraJSON(db).then((c) => descargar('bitacora.json', c, 'application/json'))}
        >
          Exportar JSON
        </button>
        <button
          type="button"
          onClick={() => void exportarBitacoraCSV(db).then((c) => descargar('bitacora.csv', c, 'text/csv'))}
        >
          Exportar CSV
        </button>
      </div>

      <h2>Planificado</h2>
      <ul aria-label="Eventos planificados">
        {planificados.slice(0, 20).map((e) => (
          <li key={e.event_id}>
            {e.recorded_at} — {e.event_type}
          </li>
        ))}
      </ul>

      <h2>Emergente</h2>
      <ul aria-label="Eventos emergentes">
        {emergentes.slice(0, 20).map((e) => (
          <li key={e.event_id}>
            {e.recorded_at} — {e.event_type}
          </li>
        ))}
      </ul>
    </section>
  )
}
