// Utilidades puras de horas de reloj "HH:MM" <-> minutos desde
// medianoche. Sin Date: estas horas son de un único día de jornada, no
// marcas temporales absolutas.

export function aMinutos(horaHHMM: string): number {
  const coincidencia = /^(\d{1,2}):(\d{2})$/.exec(horaHHMM)
  if (!coincidencia) throw new Error(`Hora inválida, se esperaba HH:MM: "${horaHHMM}"`)
  const horas = Number(coincidencia[1])
  const minutos = Number(coincidencia[2])
  return horas * 60 + minutos
}

export function aHHMM(minutos: number): string {
  const min = Math.round(minutos)
  const horas = Math.floor(min / 60)
  const resto = min % 60
  return `${String(horas).padStart(2, '0')}:${String(resto).padStart(2, '0')}`
}

export interface Intervalo {
  inicio: number
  fin: number
}

/** Resta una lista de intervalos ocupados de un intervalo base, en
 * minutos. Determinista: no depende del orden de `ocupados`. */
export function restarIntervalos(base: Intervalo, ocupados: readonly Intervalo[]): Intervalo[] {
  const ordenados = [...ocupados]
    .filter((o) => o.fin > base.inicio && o.inicio < base.fin)
    .map((o) => ({ inicio: Math.max(o.inicio, base.inicio), fin: Math.min(o.fin, base.fin) }))
    .sort((a, b) => a.inicio - b.inicio || a.fin - b.fin)

  const fusionados: Intervalo[] = []
  for (const intervalo of ordenados) {
    const ultimo = fusionados[fusionados.length - 1]
    if (ultimo && intervalo.inicio <= ultimo.fin) {
      ultimo.fin = Math.max(ultimo.fin, intervalo.fin)
    } else {
      fusionados.push({ ...intervalo })
    }
  }

  const libres: Intervalo[] = []
  let cursor = base.inicio
  for (const ocupado of fusionados) {
    if (ocupado.inicio > cursor) libres.push({ inicio: cursor, fin: ocupado.inicio })
    cursor = Math.max(cursor, ocupado.fin)
  }
  if (cursor < base.fin) libres.push({ inicio: cursor, fin: base.fin })
  return libres
}

export function duracion(intervalo: Intervalo): number {
  return Math.max(0, intervalo.fin - intervalo.inicio)
}
