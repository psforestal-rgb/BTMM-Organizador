// Única implementación de Reloj permitida en runtime. Es la frontera
// donde new Date() es legítimo: el dominio nunca la llama directamente.

import type { Reloj } from './index'

const ZONA_REFERENCIA = 'America/Costa_Rica'

export class RelojSistema implements Reloj {
  ahora(): string {
    return new Date().toISOString()
  }

  hoy(): string {
    const formateador = new Intl.DateTimeFormat('en-CA', {
      timeZone: ZONA_REFERENCIA,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    return formateador.format(new Date())
  }
}
