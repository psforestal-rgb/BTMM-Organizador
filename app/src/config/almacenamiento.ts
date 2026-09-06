// Persistencia de almacenamiento (sección 8): se pide en el primer
// arranque y el resultado se muestra en BITÁCORA.

const CLAVE = 'geo.almacenamiento_persistente'

export async function solicitarAlmacenamientoPersistente(): Promise<boolean> {
  if (!('storage' in navigator) || !navigator.storage.persist) {
    return false
  }
  const yaConcedido = await navigator.storage.persisted?.()
  if (yaConcedido) {
    localStorage.setItem(CLAVE, 'true')
    return true
  }
  const concedido = await navigator.storage.persist()
  localStorage.setItem(CLAVE, String(concedido))
  return concedido
}

export function estadoAlmacenamientoConocido(): boolean | null {
  const valor = localStorage.getItem(CLAVE)
  if (valor === null) return null
  return valor === 'true'
}
