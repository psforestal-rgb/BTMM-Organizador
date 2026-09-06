import { describe, expect, it } from 'vitest'
import {
  diaAnterior,
  diaSiguiente,
  diasHabilesEntre,
  esHabil,
  proximoHabil,
  sumarDiasHabiles,
} from './calendario'

describe('esHabil', () => {
  it('2026-09-08 (martes) es hábil', () => {
    expect(esHabil('2026-09-08')).toBe(true)
  })

  it('sábados y domingos no son hábiles', () => {
    expect(esHabil('2026-09-05')).toBe(false) // sábado
    expect(esHabil('2026-09-06')).toBe(false) // domingo
  })

  it('un feriado sin traslado no es hábil en su propia fecha', () => {
    expect(esHabil('2026-09-15')).toBe(false) // Independencia
  })

  it('un feriado trasladable no es hábil ni en su fecha original ni en la efectiva', () => {
    expect(esHabil('2026-04-11')).toBe(false) // sábado original (ya no hábil por ser fin de semana)
    expect(esHabil('2026-04-13')).toBe(false) // lunes, fecha_efectiva del traslado
    expect(esHabil('2026-04-14')).toBe(true) // martes siguiente, ya hábil
  })
})

describe('proximoHabil', () => {
  it('devuelve la misma fecha si ya es hábil', () => {
    expect(proximoHabil('2026-09-08')).toBe('2026-09-08')
  })

  it('salta fin de semana y feriado hasta el próximo hábil', () => {
    expect(proximoHabil('2026-09-13')).toBe('2026-09-14') // domingo -> lunes
    expect(proximoHabil('2026-09-15')).toBe('2026-09-16') // feriado -> día siguiente
  })
})

describe('sumarDiasHabiles', () => {
  it('n=0 devuelve la misma fecha', () => {
    expect(sumarDiasHabiles('2026-09-08', 0)).toBe('2026-09-08')
  })

  it('avanza n días hábiles positivos saltando fin de semana', () => {
    // martes 2026-09-08 + 5 hábiles: mié,jue,vie,lun,mar -> 2026-09-15 es feriado, se salta
    expect(sumarDiasHabiles('2026-09-08', 1)).toBe('2026-09-09')
    expect(sumarDiasHabiles('2026-09-08', 5)).toBe('2026-09-16')
  })

  it('retrocede n días hábiles negativos', () => {
    expect(sumarDiasHabiles('2026-09-08', -1)).toBe('2026-09-07')
    expect(sumarDiasHabiles('2026-09-08', -3)).toBe('2026-09-03')
  })
})

describe('diasHabilesEntre', () => {
  it('la misma fecha da 0', () => {
    expect(diasHabilesEntre('2026-09-08', '2026-09-08')).toBe(0)
  })

  it('cuenta días hábiles en (desde, hasta]', () => {
    expect(diasHabilesEntre('2026-09-08', '2026-09-09')).toBe(1)
    // 08(mar) -> 09,10,11,14,16 hábiles hasta el 16 (15 es feriado)
    expect(diasHabilesEntre('2026-09-08', '2026-09-16')).toBe(5)
  })

  it('es negativo cuando hasta < desde (ya vencido)', () => {
    expect(diasHabilesEntre('2026-09-09', '2026-09-08')).toBe(-1)
  })
})

describe('diaSiguiente / diaAnterior', () => {
  it('cruza límite de mes y de año correctamente', () => {
    expect(diaSiguiente('2026-01-31')).toBe('2026-02-01')
    expect(diaSiguiente('2026-12-31')).toBe('2027-01-01')
    expect(diaAnterior('2026-03-01')).toBe('2026-02-28')
    expect(diaAnterior('2027-01-01')).toBe('2026-12-31')
  })

  it('respeta años bisiestos', () => {
    expect(diaSiguiente('2028-02-28')).toBe('2028-02-29')
    expect(diaSiguiente('2026-02-28')).toBe('2026-03-01')
  })
})
