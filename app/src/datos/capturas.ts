// CA-02: captura de fricción mínima. Persiste primero, clasifica
// después; la clasificación nunca bloquea ni altera el texto original.

import type { AIProvider } from '../puertos'
import type { Captura, EventoGEO } from '../dominio/tipos'
import type { GeoDexie } from './db'
import { encolarEvento } from '../sync/outbox'

export interface DependenciasCaptura {
  db: GeoDexie
  deviceId: string
  ahoraISO: () => string
  siguienteClientSequence: () => Promise<number>
}

export async function crearCaptura(deps: DependenciasCaptura, texto: string): Promise<Captura> {
  const ahora = deps.ahoraISO()
  const id = crypto.randomUUID()
  const captura: Captura = {
    id,
    version_id: crypto.randomUUID(),
    field_meta: {},
    eliminado: false,
    texto,
    estado: 'capturado',
    device_id: deps.deviceId,
    creado_en: ahora,
  }
  await deps.db.capturas.add(captura)

  const evento: EventoGEO = {
    event_id: crypto.randomUUID(),
    entity_type: 'captura',
    entity_id: id,
    event_type: 'captura_creada',
    occurred_at: ahora,
    recorded_at: ahora,
    device_id: deps.deviceId,
    client_sequence: await deps.siguienteClientSequence(),
    base_version: null,
    payload: {
      texto: captura.texto,
      estado: captura.estado,
      device_id: captura.device_id,
      creado_en: captura.creado_en,
    },
    server_seq: null,
  }
  await encolarEvento(deps.db, evento)

  return captura
}

/** Corre después de guardar; nunca puede alterar el texto ni bloquear la
 * captura, incluso si el proveedor de IA falla o no está disponible. */
export async function clasificarCapturaEnSegundoPlano(
  db: GeoDexie,
  capturaId: string,
  ai: AIProvider,
): Promise<void> {
  if (!ai.disponible()) return
  try {
    const captura = await db.capturas.get(capturaId)
    if (!captura) return
    const sugerencia = await ai.clasificarCaptura(captura.texto)
    if (!sugerencia) return
    // La sugerencia queda disponible para que la persona la confirme al
    // procesar la captura; no cambia el texto ni el estado por sí sola.
  } catch {
    // Un fallo de IA nunca debe afectar la captura ya persistida.
  }
}
