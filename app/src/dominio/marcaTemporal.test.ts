import { describe, expect, it } from 'vitest'
import { diferenciaEnDias, diferenciaEnHoras, epocaMs } from './marcaTemporal'

describe('epocaMs', () => {
  it('calcula la época de referencia 1970-01-01T00:00:00Z como 0', () => {
    expect(epocaMs('1970-01-01T00:00:00Z')).toBe(0)
  })

  it('coincide con Date.parse para una fecha conocida (validación cruzada, no implementación)', () => {
    const iso = '2026-09-08T08:00:00-06:00'
    expect(epocaMs(iso)).toBe(Date.parse(iso))
  })
})

describe('diferencias', () => {
  it('calcula horas y días entre dos marcas', () => {
    expect(diferenciaEnHoras('2026-09-08T20:00:00-06:00', '2026-09-08T08:00:00-06:00')).toBe(12)
    expect(diferenciaEnDias('2026-09-15T08:00:00-06:00', '2026-09-08T08:00:00-06:00')).toBe(7)
  })
})
