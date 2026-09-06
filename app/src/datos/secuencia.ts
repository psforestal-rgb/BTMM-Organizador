// client_sequence es un entero monótono por dispositivo, nunca
// reutilizado (sección 5.1). Eventos y cambios llevan cada uno su propio
// contador persistente en `contadoresSecuencia`, para que sobreviva a la
// purga del outbox tras confirmarse en el servidor.

import type { GeoDexie } from './db'

export type TipoSecuencia = 'evento' | 'cambio'

export async function siguienteClientSequence(
  db: GeoDexie,
  deviceId: string,
  tipo: TipoSecuencia,
): Promise<number> {
  const clave = `${deviceId}:${tipo}`
  return db.transaction('rw', db.contadoresSecuencia, async () => {
    const actual = await db.contadoresSecuencia.get(clave)
    const siguiente = (actual?.valor ?? 0) + 1
    await db.contadoresSecuencia.put({ clave, valor: siguiente })
    return siguiente
  })
}

export function creadorDeSecuencia(
  db: GeoDexie,
  deviceId: string,
  tipo: TipoSecuencia,
): () => Promise<number> {
  return () => siguienteClientSequence(db, deviceId, tipo)
}
