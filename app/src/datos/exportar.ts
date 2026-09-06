// Exportación local desde Dexie, sin red (sección 6: "el cliente además
// exporta desde Dexie sin red, porque la portabilidad no puede depender
// de conectividad").

import type { EventoGEO } from '../dominio/tipos'
import type { GeoDexie } from './db'

const COLUMNAS = [
  'event_id',
  'entity_type',
  'entity_id',
  'event_type',
  'occurred_at',
  'recorded_at',
  'device_id',
] as const

async function eventosOrdenados(db: GeoDexie): Promise<EventoGEO[]> {
  const eventos = await db.eventos.toArray()
  return eventos.sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))
}

export async function exportarBitacoraJSON(db: GeoDexie): Promise<string> {
  return JSON.stringify(await eventosOrdenados(db), null, 2)
}

function escaparCSV(valor: unknown): string {
  const texto = String(valor ?? '')
  if (/[",\n]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`
  return texto
}

export async function exportarBitacoraCSV(db: GeoDexie): Promise<string> {
  const eventos = await eventosOrdenados(db)
  const filas = eventos.map((e) => COLUMNAS.map((c) => escaparCSV(e[c])).join(','))
  return [COLUMNAS.join(','), ...filas].join('\n')
}

export async function contarEventos(db: GeoDexie): Promise<number> {
  return db.eventos.count()
}
