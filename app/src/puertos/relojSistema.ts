// Única implementación de Reloj permitida en runtime. Es la frontera
// donde new Date() es legítimo: el dominio nunca la llama directamente.
//
// ahora() debe devolver la hora de pared de America/Costa_Rica con su
// desplazamiento explícito (p. ej. "2026-09-08T08:00:00-06:00"), no UTC
// con "Z": el resto de la aplicación extrae fecha/hora locales de esta
// cadena por subcadena (ver app/src/datos/planificadorDatos.ts), y esa
// extracción solo es correcta si la cadena ya está en hora de Costa Rica.

import type { Reloj } from './index'

const ZONA_REFERENCIA = 'America/Costa_Rica'

function partesEnZona(fecha: Date, zona: string): Record<string, string> {
  const formateador = new Intl.DateTimeFormat('en-US', {
    timeZone: zona,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  return Object.fromEntries(formateador.formatToParts(fecha).map((p) => [p.type, p.value]))
}

function desplazamientoMinutos(fecha: Date, zona: string): number {
  const p = partesEnZona(fecha, zona)
  const comoSiFueraUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second),
  )
  return Math.round((comoSiFueraUtc - fecha.getTime()) / 60000)
}

function formatearISOConDesplazamiento(fecha: Date, zona: string): string {
  const p = partesEnZona(fecha, zona)
  const desplazamientoMin = desplazamientoMinutos(fecha, zona)
  const signo = desplazamientoMin >= 0 ? '+' : '-'
  const abs = Math.abs(desplazamientoMin)
  const hh = String(Math.floor(abs / 60)).padStart(2, '0')
  const mm = String(abs % 60).padStart(2, '0')
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${signo}${hh}:${mm}`
}

export class RelojSistema implements Reloj {
  ahora(): string {
    return formatearISOConDesplazamiento(new Date(), ZONA_REFERENCIA)
  }

  hoy(): string {
    return this.ahora().slice(0, 10)
  }
}
