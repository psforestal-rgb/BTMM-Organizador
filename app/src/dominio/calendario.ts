// Motor puro de días hábiles (sección 7.1). Sin Date, sin zona horaria:
// las fechas son cadenas YYYY-MM-DD y toda la aritmética es entera, para
// que el resultado no dependa del huso horario del proceso que lo corre.
// Zona de referencia conceptual: America/Costa_Rica (la traduce el
// puerto Reloj, no este motor).

import feriadosData from './datos/feriados_cr.json'

interface FeriadoCR {
  fecha: string
  nombre: string
  pago: boolean
  trasladable: boolean
  fecha_efectiva: string
}

interface FeriadosArchivo {
  fuente: string
  feriados: FeriadoCR[]
}

const ARCHIVO = feriadosData as FeriadosArchivo

const FERIADOS_EFECTIVOS: ReadonlySet<string> = new Set(
  ARCHIVO.feriados.map((feriado) => feriado.fecha_efectiva),
)

interface FechaPartes {
  anio: number
  mes: number
  dia: number
}

function parsearFecha(fecha: string): FechaPartes {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha)
  if (!coincidencia) {
    throw new Error(`Fecha inválida, se esperaba YYYY-MM-DD: "${fecha}"`)
  }
  return {
    anio: Number(coincidencia[1]),
    mes: Number(coincidencia[2]),
    dia: Number(coincidencia[3]),
  }
}

function formatearFecha(partes: FechaPartes): string {
  const mm = String(partes.mes).padStart(2, '0')
  const dd = String(partes.dia).padStart(2, '0')
  return `${partes.anio}-${mm}-${dd}`
}

function esBisiesto(anio: number): boolean {
  return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0
}

const DIAS_POR_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

function diasEnMes(anio: number, mes: number): number {
  if (mes === 2 && esBisiesto(anio)) return 29
  const dias = DIAS_POR_MES[mes - 1]
  if (dias === undefined) throw new Error(`Mes inválido: ${mes}`)
  return dias
}

/** Algoritmo de Sakamoto: 0 = domingo … 6 = sábado. Aritmética entera pura. */
function diaDeSemana(fecha: string): number {
  const { anio, mes, dia } = parsearFecha(fecha)
  const desplazamientos = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4]
  const anioAjustado = mes < 3 ? anio - 1 : anio
  const desplazamiento = desplazamientos[mes - 1]
  if (desplazamiento === undefined) throw new Error(`Mes inválido: ${mes}`)
  return (
    (anioAjustado +
      Math.floor(anioAjustado / 4) -
      Math.floor(anioAjustado / 100) +
      Math.floor(anioAjustado / 400) +
      desplazamiento +
      dia) %
    7
  )
}

/** 0 = domingo … 6 = sábado. Expuesto para calcular límites de semana. */
export function diaDeSemanaISO(fecha: string): number {
  return diaDeSemana(fecha)
}

export function sumarDiasCalendario(fecha: string, n: number): string {
  let cursor = fecha
  if (n >= 0) {
    for (let i = 0; i < n; i += 1) cursor = diaSiguiente(cursor)
  } else {
    for (let i = 0; i < -n; i += 1) cursor = diaAnterior(cursor)
  }
  return cursor
}

/** Domingo de la semana ISO (lunes a domingo) que contiene `fecha`. */
export function finDeSemana(fecha: string): string {
  const diaSemana = diaDeSemanaISO(fecha)
  const diasHastaDomingo = diaSemana === 0 ? 0 : 7 - diaSemana
  return sumarDiasCalendario(fecha, diasHastaDomingo)
}

export function diaSiguiente(fecha: string): string {
  const { anio, mes, dia } = parsearFecha(fecha)
  if (dia < diasEnMes(anio, mes)) return formatearFecha({ anio, mes, dia: dia + 1 })
  if (mes < 12) return formatearFecha({ anio, mes: mes + 1, dia: 1 })
  return formatearFecha({ anio: anio + 1, mes: 1, dia: 1 })
}

export function diaAnterior(fecha: string): string {
  const { anio, mes, dia } = parsearFecha(fecha)
  if (dia > 1) return formatearFecha({ anio, mes, dia: dia - 1 })
  if (mes > 1) return formatearFecha({ anio, mes: mes - 1, dia: diasEnMes(anio, mes - 1) })
  return formatearFecha({ anio: anio - 1, mes: 12, dia: 31 })
}

export function esHabil(fecha: string): boolean {
  const diaSemana = diaDeSemana(fecha)
  const esFinDeSemana = diaSemana === 0 || diaSemana === 6
  return !esFinDeSemana && !FERIADOS_EFECTIVOS.has(fecha)
}

export function proximoHabil(fecha: string): string {
  let cursor = fecha
  while (!esHabil(cursor)) {
    cursor = diaSiguiente(cursor)
  }
  return cursor
}

export function sumarDiasHabiles(fecha: string, n: number): string {
  if (n === 0) return fecha
  const avanzar = n > 0
  let restante = Math.abs(n)
  let cursor = fecha
  while (restante > 0) {
    cursor = avanzar ? diaSiguiente(cursor) : diaAnterior(cursor)
    if (esHabil(cursor)) restante -= 1
  }
  return cursor
}

/** Días hábiles en el intervalo (desde, hasta] si hasta >= desde;
 * negativo (vencido) si hasta < desde. diasHabilesEntre(x, x) === 0. */
export function diasHabilesEntre(desde: string, hasta: string): number {
  if (desde === hasta) return 0
  if (hasta < desde) return -diasHabilesEntre(hasta, desde)
  let cuenta = 0
  let cursor = desde
  while (cursor < hasta) {
    cursor = diaSiguiente(cursor)
    if (esHabil(cursor)) cuenta += 1
  }
  return cuenta
}
