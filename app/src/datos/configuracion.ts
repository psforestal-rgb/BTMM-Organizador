import type { Configuracion } from '../dominio/tipos'
import type { GeoDexie } from './db'

const ID_CONFIG_GLOBAL = 'global'

export function configuracionPorDefecto(): Configuracion {
  return {
    id: ID_CONFIG_GLOBAL,
    version_id: crypto.randomUUID(),
    field_meta: {},
    eliminado: false,
    buffer_absorcion_min: 75,
    dias_revision_espera: 5,
  }
}

/** Solo lectura, con valor por defecto en memoria si aún no existe fila.
 * A propósito no escribe nada: se usa dentro de useLiveQuery, que exige
 * una transacción de solo lectura (escribir ahí lanza ReadOnlyError). */
export async function obtenerConfiguracion(db: GeoDexie): Promise<Configuracion> {
  const existente = await db.configuraciones.get(ID_CONFIG_GLOBAL)
  return existente ?? configuracionPorDefecto()
}

/** Se llama una vez al arrancar la app (fuera de cualquier useLiveQuery)
 * para sembrar la fila por defecto si hace falta. */
export async function asegurarConfiguracionInicial(db: GeoDexie): Promise<void> {
  const existente = await db.configuraciones.get(ID_CONFIG_GLOBAL)
  if (!existente) {
    await db.configuraciones.put(configuracionPorDefecto())
  }
}
