import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RelojSistema } from './relojSistema'

describe('RelojSistema', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('ahora() devuelve hora de pared de Costa Rica con desplazamiento -06:00, no UTC', () => {
    // Medianoche UTC del 8 de septiembre de 2026 son las 18:00 del día
    // anterior en Costa Rica (UTC-6, sin horario de verano).
    vi.setSystemTime(new Date('2026-09-08T00:00:00Z'))
    const reloj = new RelojSistema()
    expect(reloj.ahora()).toBe('2026-09-07T18:00:00-06:00')
  })

  it('hoy() es la fecha de Costa Rica derivada de ahora(), no la fecha UTC', () => {
    vi.setSystemTime(new Date('2026-09-08T02:00:00Z')) // 07-09 20:00 en Costa Rica
    const reloj = new RelojSistema()
    expect(reloj.hoy()).toBe('2026-09-07')
  })

  it('a mediodía UTC coinciden fecha UTC y fecha de Costa Rica (offset de 6h)', () => {
    vi.setSystemTime(new Date('2026-09-08T14:00:00Z')) // 08:00 en Costa Rica
    const reloj = new RelojSistema()
    expect(reloj.ahora()).toBe('2026-09-08T08:00:00-06:00')
    expect(reloj.hoy()).toBe('2026-09-08')
  })
})
