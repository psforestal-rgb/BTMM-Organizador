// device_id persistente por instalación. localStorage está permitido
// explícitamente para esto (sección 8: nunca para datos de dominio).

const CLAVE_DEVICE_ID = 'geo.device_id'

function generarId(): string {
  return crypto.randomUUID()
}

export function obtenerDeviceId(): string {
  const existente = localStorage.getItem(CLAVE_DEVICE_ID)
  if (existente) return existente
  const nuevo = generarId()
  localStorage.setItem(CLAVE_DEVICE_ID, nuevo)
  return nuevo
}
