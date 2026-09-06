import { describe, expect, it } from 'vitest'
import { aplicarDecisionCierre, transicionarEstado, TransicionInvalidaError } from './estados'

const HOY = '2026-09-08'

describe('transicionarEstado — esperando', () => {
  it('calcula fecha_revision por defecto a 5 días hábiles si no se aporta', () => {
    const resultado = transicionarEstado({ estadoNuevo: 'esperando', hoy: HOY })
    expect(resultado.fecha_revision).toBe('2026-09-16')
  })

  it('respeta una fecha_revision explícita', () => {
    const resultado = transicionarEstado({
      estadoNuevo: 'esperando',
      hoy: HOY,
      fechaRevision: '2026-10-01',
    })
    expect(resultado.fecha_revision).toBe('2026-10-01')
  })
})

describe('transicionarEstado — pospuesto', () => {
  it('exige fecha_pospuesto', () => {
    expect(() => transicionarEstado({ estadoNuevo: 'pospuesto', hoy: HOY })).toThrow(
      TransicionInvalidaError,
    )
  })

  it('acepta la transición con fecha', () => {
    const resultado = transicionarEstado({
      estadoNuevo: 'pospuesto',
      hoy: HOY,
      fechaPospuesto: '2026-09-20',
    })
    expect(resultado.fecha_pospuesto).toBe('2026-09-20')
  })
})

describe('transicionarEstado — bloqueado y cancelado', () => {
  it('exigen motivo', () => {
    expect(() => transicionarEstado({ estadoNuevo: 'bloqueado', hoy: HOY })).toThrow(
      TransicionInvalidaError,
    )
    expect(() => transicionarEstado({ estadoNuevo: 'cancelado', hoy: HOY })).toThrow(
      TransicionInvalidaError,
    )
  })

  it('aceptan la transición con motivo', () => {
    const resultado = transicionarEstado({
      estadoNuevo: 'bloqueado',
      hoy: HOY,
      motivo: 'sin permiso de acceso al sitio',
    })
    expect(resultado.motivo).toBe('sin permiso de acceso al sitio')
  })
})

describe('aplicarDecisionCierre — invariante 4 (sin descarte silencioso)', () => {
  it('rechaza cualquier entrada que no sea una de las seis decisiones', () => {
    expect(() => aplicarDecisionCierre(undefined, HOY)).toThrow(TransicionInvalidaError)
    expect(() => aplicarDecisionCierre(null, HOY)).toThrow(TransicionInvalidaError)
    expect(() => aplicarDecisionCierre({}, HOY)).toThrow(TransicionInvalidaError)
    expect(() => aplicarDecisionCierre({ tipo: 'ocultar' }, HOY)).toThrow(TransicionInvalidaError)
  })

  it('acepta las seis decisiones válidas', () => {
    expect(aplicarDecisionCierre({ tipo: 'continuar_manana' }, HOY).estado).toBe('programado')
    expect(aplicarDecisionCierre({ tipo: 'programar' }, HOY).estado).toBe('programado')
    expect(aplicarDecisionCierre({ tipo: 'esperar' }, HOY).estado).toBe('esperando')
    expect(aplicarDecisionCierre({ tipo: 'posponer', fecha: '2026-09-30' }, HOY).estado).toBe(
      'pospuesto',
    )
    expect(aplicarDecisionCierre({ tipo: 'cancelar', motivo: 'ya no aplica' }, HOY).estado).toBe(
      'cancelado',
    )
    expect(aplicarDecisionCierre({ tipo: 'hecho' }, HOY).estado).toBe('hecho')
  })

  it('posponer sin fecha sigue siendo rechazado incluso pasando por la decisión de cierre', () => {
    expect(() => aplicarDecisionCierre({ tipo: 'posponer' }, HOY)).toThrow(TransicionInvalidaError)
  })
})
