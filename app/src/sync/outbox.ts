// Cola de salida y orquestación de sincronización (sección 5.5 y 6).
// Aplica los eventos/cambios recibidos localmente con el mismo algoritmo
// de fusión que el servidor (fusion.ts), para que ambos lados converjan.

import type { Table } from 'dexie'
import type { GeoDexie, OutboxItem } from '../datos/db'
import { RepositorioEventos } from '../datos/eventos'
import type { EntidadMutable, EventoGEO } from '../dominio/tipos'
import type { SyncAdapter } from '../puertos'
import { fusionarCampo, type MetaCampo } from './fusion'

/** Todas las tablas de entidades mutables comparten la forma
 * `EntidadMutable`; esta es la única frontera donde se afirma ese hecho
 * para poder despachar dinámicamente por `entity_type` sin `any`. */
function tablaGenerica(db: GeoDexie, tabla: keyof GeoDexie): Table<EntidadMutable, string> {
  return db[tabla] as unknown as Table<EntidadMutable, string>
}

/** Acceso indexado a un campo de una entidad mutable por nombre, para
 * aplicar cambios genéricos sin recurrir a `any`. */
function obtenerCampo(fila: EntidadMutable, campo: string): unknown {
  return (fila as unknown as Record<string, unknown>)[campo]
}

function asignarCampo(fila: EntidadMutable, campo: string, valor: unknown): void {
  ;(fila as unknown as Record<string, unknown>)[campo] = valor
}

export interface CambioGEO {
  change_id: string
  entity_type: string
  entity_id: string
  device_id: string
  client_sequence: number
  occurred_at: string
  base_version: string | null
  campos: Record<string, unknown>
  campo_ts: Record<string, string>
}

const LIMITE_PAGINA_PULL = 200
const REINTENTOS_MAXIMOS = 4
const ESPERA_BASE_MS = 50

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function conReintentos<T>(operacion: () => Promise<T>): Promise<T> {
  let ultimoError: unknown
  for (let intento = 0; intento < REINTENTOS_MAXIMOS; intento += 1) {
    try {
      return await operacion()
    } catch (error) {
      ultimoError = error
      if (intento < REINTENTOS_MAXIMOS - 1) {
        await esperar(ESPERA_BASE_MS * 2 ** intento)
      }
    }
  }
  throw ultimoError
}

export async function encolarEvento(db: GeoDexie, evento: EventoGEO): Promise<void> {
  await new RepositorioEventos(db).agregar(evento)
  const item: OutboxItem = {
    id: evento.event_id,
    tipo: 'evento',
    payload: evento,
    client_sequence: evento.client_sequence,
    intentos: 0,
    ultimo_error: null,
    estado: 'pendiente',
  }
  await db.outbox.add(item)
}

export async function encolarCambio(
  db: GeoDexie,
  cambio: CambioGEO,
  tabla: keyof GeoDexie,
): Promise<void> {
  const coleccion = tablaGenerica(db, tabla)
  const fila = await coleccion.get(cambio.entity_id)
  if (fila) {
    const fieldMeta = { ...fila.field_meta }
    for (const [campo, valor] of Object.entries(cambio.campos)) {
      asignarCampo(fila, campo, valor)
      fieldMeta[campo] = {
        updated_at: cambio.campo_ts[campo] ?? cambio.occurred_at,
        device_id: cambio.device_id,
      }
    }
    fila.field_meta = fieldMeta
    fila.version_id = cambio.change_id
    await coleccion.put(fila)
  }

  const item: OutboxItem = {
    id: cambio.change_id,
    tipo: 'cambio',
    payload: cambio,
    client_sequence: cambio.client_sequence,
    intentos: 0,
    ultimo_error: null,
    estado: 'pendiente',
  }
  await db.outbox.add(item)
}

function aplicarCambioLocal(fila: EntidadMutable, cambio: CambioGEO): void {
  const fieldMeta = { ...fila.field_meta }
  for (const [campo, valorEntrante] of Object.entries(cambio.campos)) {
    const tsEntrante = cambio.campo_ts[campo] ?? cambio.occurred_at
    const metaEntrante: MetaCampo = { updated_at: tsEntrante, device_id: cambio.device_id }
    const metaActual = fieldMeta[campo]

    if (!metaActual) {
      asignarCampo(fila, campo, valorEntrante)
      fieldMeta[campo] = { updated_at: tsEntrante, device_id: cambio.device_id }
      continue
    }

    const valorActual = obtenerCampo(fila, campo)
    const resultado = fusionarCampo(campo, valorActual, metaActual, valorEntrante, metaEntrante)
    asignarCampo(fila, campo, resultado.valor)
    fieldMeta[campo] = resultado.meta
  }
  fila.field_meta = fieldMeta
}

const TABLA_POR_ENTITY_TYPE: Record<string, keyof GeoDexie> = {
  captura: 'capturas',
  asignacion: 'asignaciones',
  actividad: 'actividades',
  interrupcion: 'interrupciones',
  tipo_tramite: 'tiposTramite',
  tramite: 'tramites',
  paso_tramite: 'pasosTramite',
  iniciativa: 'iniciativas',
  evento_fijo: 'eventosFijos',
  bloque_agenda: 'bloquesAgenda',
  seguimiento: 'seguimientos',
  conflicto: 'conflictos',
  dispositivo: 'dispositivos',
  configuracion: 'configuraciones',
}

/** "_creada"/"_creado": sufijo genérico de creación. Excepción única:
 * "paso_completado" — no existe un "paso_tramite_creado" separado en el
 * vocabulario porque completar una etapa es lo único que instancia su
 * PasoTramite (dominio/tramites.ts trata la ausencia de fila como
 * "pendiente"). Debe coincidir con _indica_creacion_de_entidad en el
 * servidor (servicio.py). */
function indicaCreacionDeEntidad(eventType: string): boolean {
  return (
    eventType.endsWith('_creada') || eventType.endsWith('_creado') || eventType === 'paso_completado'
  )
}

/** Espejo de _aplicar_evento_creacion en el servidor: un evento de
 * creación recibido de otro dispositivo debe materializar la entidad
 * aquí también, o nunca aparecería en las pantallas de este dispositivo. */
async function materializarSiEsCreacion(db: GeoDexie, evento: EventoGEO): Promise<void> {
  if (!indicaCreacionDeEntidad(evento.event_type)) return
  const tabla = TABLA_POR_ENTITY_TYPE[evento.entity_type]
  if (!tabla) return
  const coleccion = tablaGenerica(db, tabla)
  const existente = await coleccion.get(evento.entity_id)
  if (existente) return
  const entidad = {
    id: evento.entity_id,
    version_id: evento.event_id,
    field_meta: {},
    eliminado: false,
    ...evento.payload,
  } as unknown as EntidadMutable
  await coleccion.add(entidad)
}

export interface ResultadoSincronizacion {
  enviados: number
  confirmados: number
  rechazados: number
  eventosRecibidos: number
  cambiosRecibidos: number
  serverSeq: number
}

export async function sincronizar(
  db: GeoDexie,
  adapter: SyncAdapter,
  deviceId: string,
  ahoraISO: string,
): Promise<ResultadoSincronizacion> {
  const pendientes = await db.outbox.where('estado').equals('pendiente').toArray()
  const eventos = pendientes.filter((p) => p.tipo === 'evento').map((p) => p.payload as EventoGEO)
  const cambios = pendientes.filter((p) => p.tipo === 'cambio').map((p) => p.payload as CambioGEO)

  let confirmados = 0
  let rechazados = 0

  if (pendientes.length > 0) {
    const resultadoPush = await conReintentos(() =>
      adapter.push({ deviceId, eventos, cambios }),
    )
    const confirmadosIds = new Set([...resultadoPush.aceptados, ...resultadoPush.duplicados])
    for (const id of confirmadosIds) {
      await db.outbox.delete(id)
      confirmados += 1
    }
    for (const rechazo of resultadoPush.rechazados) {
      await db.outbox.update(rechazo.id, { ultimo_error: rechazo.motivo, estado: 'pendiente' })
      rechazados += 1
    }
  }

  let syncState = await db.syncState.get(deviceId)
  let desde = syncState?.ultimo_server_seq_recibido ?? 0
  let eventosRecibidos = 0
  let cambiosRecibidos = 0
  let serverSeqFinal: number

  const repoEventos = new RepositorioEventos(db)

  for (;;) {
    const pagina = await conReintentos(() => adapter.pull(desde, LIMITE_PAGINA_PULL))
    for (const eventoRaw of pagina.eventos) {
      const evento = eventoRaw as EventoGEO
      try {
        await repoEventos.agregar(evento)
        eventosRecibidos += 1
      } catch {
        // Ya lo teníamos (eco tolerado): la idempotencia no depende del filtro del servidor.
      }
      await materializarSiEsCreacion(db, evento)
    }
    for (const cambioRaw of pagina.cambios) {
      const cambio = cambioRaw as CambioGEO
      const tabla = TABLA_POR_ENTITY_TYPE[cambio.entity_type]
      if (!tabla) continue
      const coleccion = tablaGenerica(db, tabla)
      const fila = await coleccion.get(cambio.entity_id)
      if (fila) {
        aplicarCambioLocal(fila, cambio)
        await coleccion.put(fila)
      }
      cambiosRecibidos += 1
    }
    desde = pagina.serverSeq
    serverSeqFinal = pagina.serverSeq
    if (!pagina.hayMas) break
  }

  syncState = {
    device_id: deviceId,
    ultimo_server_seq_recibido: serverSeqFinal,
    ultimo_client_sequence_confirmado: syncState?.ultimo_client_sequence_confirmado ?? 0,
    ultima_sync_ok_at: ahoraISO,
    ultimo_error: null,
  }
  await db.syncState.put(syncState)

  // Los conflictos son un efecto server-side de la fusión: no viajan como
  // evento ni como cambio, así que hay que pedirlos aparte para que el
  // dispositivo que perdió la fusión también los vea (CA-11).
  const conflictosRemotos = await conReintentos(() => adapter.conflictosAbiertos())
  for (const remoto of conflictosRemotos) {
    await db.conflictos.put({
      id: remoto.id,
      version_id: remoto.id,
      field_meta: {},
      eliminado: false,
      entity_type: remoto.entity_type,
      entity_id: remoto.entity_id,
      campo: remoto.campo,
      valor_ganador: remoto.valor_ganador,
      device_ganador: remoto.device_ganador,
      ts_ganador: remoto.ts_ganador,
      valor_perdedor: remoto.valor_perdedor,
      device_perdedor: remoto.device_perdedor,
      ts_perdedor: remoto.ts_perdedor,
      resuelto: remoto.resuelto,
    })
  }

  return {
    enviados: pendientes.length,
    confirmados,
    rechazados,
    eventosRecibidos,
    cambiosRecibidos,
    serverSeq: serverSeqFinal,
  }
}
