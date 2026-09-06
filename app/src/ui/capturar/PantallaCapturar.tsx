import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { obtenerDb, obtenerDeviceIdActual, reloj } from '../../config/contexto'
import { crearCaptura } from '../../datos/capturas'
import { creadorDeSecuencia } from '../../datos/secuencia'

export function PantallaCapturar() {
  const [texto, setTexto] = useState('')
  const [guardando, setGuardando] = useState(false)
  const db = obtenerDb()

  const recientes = useLiveQuery(
    () => db.capturas.orderBy('creado_en').reverse().limit(10).toArray(),
    [],
    [],
  )

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault()
    const textoAGuardar = texto.trim()
    if (!textoAGuardar || guardando) return
    setGuardando(true)
    setTexto('')
    try {
      const deviceId = obtenerDeviceIdActual()
      await crearCaptura(
        {
          db,
          deviceId,
          ahoraISO: () => reloj.ahora(),
          siguienteClientSequence: creadorDeSecuencia(db, deviceId, 'evento'),
        },
        textoAGuardar,
      )
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section aria-labelledby="titulo-capturar">
      <h1 id="titulo-capturar">Capturar</h1>
      <p>Registra ahora, organiza después.</p>
      <form onSubmit={(e) => void guardar(e)} className="geo-captura-form">
        <input
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="¿Qué necesitas recordar?"
          aria-label="Texto de la captura"
          autoFocus
        />
        <button type="submit" disabled={!texto.trim() || guardando}>
          Guardar
        </button>
      </form>
      {recientes && recientes.length > 0 && (
        <ul className="geo-lista-capturas" aria-label="Capturas recientes">
          {recientes.map((captura) => (
            <li key={captura.id}>
              <span>{captura.texto}</span>
              <span className="geo-etiqueta-estado">{captura.estado}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
