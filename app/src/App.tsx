import { useEffect, useState } from 'react'
import { PantallaBitacora } from './ui/bitacora/PantallaBitacora'
import { PantallaCapturar } from './ui/capturar/PantallaCapturar'
import { PantallaHoy } from './ui/hoy/PantallaHoy'
import { PantallaRadar } from './ui/radar/PantallaRadar'
import { navegarA, rutaActual, suscribirCambiosDeRuta, type Ruta } from './router'

const PESTANAS: Array<{ ruta: Ruta; etiqueta: string }> = [
  { ruta: 'hoy', etiqueta: 'Hoy' },
  { ruta: 'capturar', etiqueta: 'Capturar' },
  { ruta: 'radar', etiqueta: 'Radar' },
  { ruta: 'bitacora', etiqueta: 'Bitácora' },
]

function pantallaPara(ruta: Ruta) {
  switch (ruta) {
    case 'hoy':
      return <PantallaHoy />
    case 'capturar':
      return <PantallaCapturar />
    case 'radar':
      return <PantallaRadar />
    case 'bitacora':
      return <PantallaBitacora />
  }
}

export default function App() {
  const [ruta, setRuta] = useState<Ruta>(() => rutaActual())

  useEffect(() => suscribirCambiosDeRuta(() => setRuta(rutaActual())), [])

  return (
    <div className="geo-app">
      <main className="geo-contenido">{pantallaPara(ruta)}</main>
      <nav className="geo-tabs" aria-label="Navegación principal">
        {PESTANAS.map((pestana) => (
          <button
            key={pestana.ruta}
            type="button"
            className={pestana.ruta === ruta ? 'geo-tab geo-tab--activa' : 'geo-tab'}
            onClick={() => navegarA(pestana.ruta)}
            aria-current={pestana.ruta === ruta ? 'page' : undefined}
          >
            {pestana.etiqueta}
          </button>
        ))}
      </nav>
    </div>
  )
}
