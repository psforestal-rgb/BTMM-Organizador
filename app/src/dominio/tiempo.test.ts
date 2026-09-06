import { describe, expect, it } from 'vitest'
import { aHHMM, aMinutos, restarIntervalos } from './tiempo'

describe('aMinutos / aHHMM', () => {
  it('convierten en ambos sentidos', () => {
    expect(aMinutos('07:00')).toBe(420)
    expect(aMinutos('13:05')).toBe(785)
    expect(aHHMM(420)).toBe('07:00')
    expect(aHHMM(785)).toBe('13:05')
  })
})

describe('restarIntervalos', () => {
  it('resta un almuerzo y una reunión de la jornada', () => {
    const jornada = { inicio: aMinutos('07:00'), fin: aMinutos('16:00') }
    const ocupados = [
      { inicio: aMinutos('12:00'), fin: aMinutos('13:00') },
      { inicio: aMinutos('09:00'), fin: aMinutos('09:30') },
    ]
    const libres = restarIntervalos(jornada, ocupados)
    expect(libres.map((i) => [aHHMM(i.inicio), aHHMM(i.fin)])).toEqual([
      ['07:00', '09:00'],
      ['09:30', '12:00'],
      ['13:00', '16:00'],
    ])
  })

  it('fusiona ocupados solapados o contiguos', () => {
    const jornada = { inicio: 0, fin: 100 }
    const libres = restarIntervalos(jornada, [
      { inicio: 10, fin: 30 },
      { inicio: 25, fin: 40 },
      { inicio: 40, fin: 50 },
    ])
    expect(libres).toEqual([
      { inicio: 0, fin: 10 },
      { inicio: 50, fin: 100 },
    ])
  })

  it('no depende del orden de los ocupados (determinismo)', () => {
    const jornada = { inicio: 0, fin: 100 }
    const a = restarIntervalos(jornada, [
      { inicio: 10, fin: 20 },
      { inicio: 50, fin: 60 },
    ])
    const b = restarIntervalos(jornada, [
      { inicio: 50, fin: 60 },
      { inicio: 10, fin: 20 },
    ])
    expect(a).toEqual(b)
  })
})
