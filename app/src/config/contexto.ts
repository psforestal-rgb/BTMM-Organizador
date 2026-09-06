// Punto único de construcción de las dependencias de runtime (Dexie,
// Reloj, device_id, SyncAdapter). Los componentes de src/ui importan de
// aquí en vez de instanciar cada uno por su cuenta.

import { crearBaseDatos, type GeoDexie } from '../datos/db'
import { RelojSistema } from '../puertos/relojSistema'
import type { Reloj } from '../puertos'
import { SyncAdapterRest } from '../sync/syncAdapterRest'
import { obtenerDeviceId } from './dispositivo'

const URL_BASE_API =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000'

let dbSingleton: GeoDexie | null = null

export function obtenerDb(): GeoDexie {
  dbSingleton ??= crearBaseDatos('geo')
  return dbSingleton
}

export const reloj: Reloj = new RelojSistema()

export function obtenerDeviceIdActual(): string {
  return obtenerDeviceId()
}

let adapterSingleton: SyncAdapterRest | null = null

export function obtenerSyncAdapter(): SyncAdapterRest {
  adapterSingleton ??= new SyncAdapterRest(URL_BASE_API, obtenerDeviceId())
  return adapterSingleton
}
