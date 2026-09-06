// Enrutado propio mínimo sobre history.pushState. Sin dependencia de
// enrutador de terceros (sección 8).

export type Ruta = 'hoy' | 'capturar' | 'radar' | 'bitacora'

const RUTAS_VALIDAS: readonly Ruta[] = ['hoy', 'capturar', 'radar', 'bitacora']

function esRuta(valor: string): valor is Ruta {
  return (RUTAS_VALIDAS as readonly string[]).includes(valor)
}

export function rutaActual(): Ruta {
  const segmento = window.location.pathname.replace(/^\/+/, '')
  return esRuta(segmento) ? segmento : 'hoy'
}

export function navegarA(ruta: Ruta): void {
  if (rutaActual() === ruta) return
  window.history.pushState({}, '', `/${ruta}`)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function suscribirCambiosDeRuta(callback: () => void): () => void {
  window.addEventListener('popstate', callback)
  return () => window.removeEventListener('popstate', callback)
}
