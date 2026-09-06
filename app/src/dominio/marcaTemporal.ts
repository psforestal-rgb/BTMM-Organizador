// Aritmética pura sobre marcas de tiempo ISO 8601 con desplazamiento
// explícito. Deliberadamente no instancia el objeto Date del lenguaje: el
// radar necesita comparar "ahora" (inyectado por el puerto Reloj) contra
// marcas registradas, y el invariante 5 se verifica por búsqueda textual
// en todo el árbol de src/dominio — así que la conversión a época se hace
// con el algoritmo entero de Howard Hinnant (days_from_civil).

interface MarcaISO {
  anio: number
  mes: number
  dia: number
  horas: number
  minutos: number
  segundos: number
  desplazamientoMin: number
}

const PATRON_ISO =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/

function parsearMarcaISO(marca: string): MarcaISO {
  const coincidencia = PATRON_ISO.exec(marca)
  if (!coincidencia) {
    throw new Error(`Marca temporal inválida, se esperaba ISO 8601 con desplazamiento: "${marca}"`)
  }
  const [, anio, mes, dia, horas, minutos, segundos, desplazamiento] = coincidencia
  let desplazamientoMin = 0
  if (desplazamiento !== 'Z') {
    const signo = desplazamiento?.startsWith('-') ? -1 : 1
    const [h, m] = (desplazamiento ?? '+00:00').slice(1).split(':').map(Number)
    desplazamientoMin = signo * ((h ?? 0) * 60 + (m ?? 0))
  }
  return {
    anio: Number(anio),
    mes: Number(mes),
    dia: Number(dia),
    horas: Number(horas),
    minutos: Number(minutos),
    segundos: Number(segundos),
    desplazamientoMin,
  }
}

/** Howard Hinnant, days_from_civil: días desde 1970-01-01 (UTC), entero puro. */
function diasDesdeEpoca(anioEntrada: number, mes: number, dia: number): number {
  const anio = mes <= 2 ? anioEntrada - 1 : anioEntrada
  const era = Math.floor((anio >= 0 ? anio : anio - 399) / 400)
  const yoe = anio - era * 400
  const doy = Math.floor((153 * (mes + (mes > 2 ? -3 : 9)) + 2) / 5) + dia - 1
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy
  return era * 146097 + doe - 719468
}

export function epocaMs(marcaISO: string): number {
  const m = parsearMarcaISO(marcaISO)
  const diasUtc = diasDesdeEpoca(m.anio, m.mes, m.dia)
  const segundosLocales = diasUtc * 86400 + m.horas * 3600 + m.minutos * 60 + m.segundos
  const segundosUtc = segundosLocales - m.desplazamientoMin * 60
  return segundosUtc * 1000
}

export function diferenciaEnMs(a: string, b: string): number {
  return epocaMs(a) - epocaMs(b)
}

export function diferenciaEnHoras(a: string, b: string): number {
  return diferenciaEnMs(a, b) / (1000 * 60 * 60)
}

export function diferenciaEnDias(a: string, b: string): number {
  return diferenciaEnMs(a, b) / (1000 * 60 * 60 * 24)
}
