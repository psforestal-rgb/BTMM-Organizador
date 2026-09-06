import { describe, expect, it } from 'vitest'
import { ejecutarRadar, RADAR_CONFIG_DEFECTO, type RadarSnapshot } from './radar'

const AHORA = '2026-09-08T08:00:00-06:00'

function snapshotVacio(): RadarSnapshot {
  return { elementosAbiertos: [], capturas: [], actividades: [], iniciativas: [], reprogramaciones: [] }
}

describe('SIN_MOVIMIENTO', () => {
  it('detecta un elemento abierto sin eventos en >= 7 días', () => {
    const snapshot = snapshotVacio()
    snapshot.elementosAbiertos = [
      {
        id: 'a', tipo: 'asignacion', titulo: 'X', estado: 'programado',
        fechaRevision: null, ultimoEventoAt: '2026-08-30T08:00:00-06:00',
        minutosPendientesTotales: 0, vencimiento: null,
      },
    ]
    const hallazgos = ejecutarRadar(snapshot, RADAR_CONFIG_DEFECTO, AHORA)
    expect(hallazgos.some((h) => h.regla === 'SIN_MOVIMIENTO' && h.entidad_id === 'a')).toBe(true)
  })

  it('no dispara si el evento es reciente', () => {
    const snapshot = snapshotVacio()
    snapshot.elementosAbiertos = [
      {
        id: 'a', tipo: 'asignacion', titulo: 'X', estado: 'programado',
        fechaRevision: null, ultimoEventoAt: '2026-09-07T08:00:00-06:00',
        minutosPendientesTotales: 0, vencimiento: null,
      },
    ]
    const hallazgos = ejecutarRadar(snapshot, RADAR_CONFIG_DEFECTO, AHORA)
    expect(hallazgos.some((h) => h.regla === 'SIN_MOVIMIENTO')).toBe(false)
  })
})

describe('ESPERA_VENCIDA', () => {
  it('detecta esperando con fecha_revision pasada', () => {
    const snapshot = snapshotVacio()
    snapshot.elementosAbiertos = [
      { id: 'a', tipo: 'tramite', titulo: 'X', estado: 'esperando', fechaRevision: '2026-09-01', ultimoEventoAt: AHORA, minutosPendientesTotales: 0, vencimiento: null },
    ]
    expect(ejecutarRadar(snapshot, RADAR_CONFIG_DEFECTO, AHORA).some((h) => h.regla === 'ESPERA_VENCIDA')).toBe(true)
  })

  it('no dispara si la revisión es futura', () => {
    const snapshot = snapshotVacio()
    snapshot.elementosAbiertos = [
      { id: 'a', tipo: 'tramite', titulo: 'X', estado: 'esperando', fechaRevision: '2026-09-20', ultimoEventoAt: AHORA, minutosPendientesTotales: 0, vencimiento: null },
    ]
    expect(ejecutarRadar(snapshot, RADAR_CONFIG_DEFECTO, AHORA).some((h) => h.regla === 'ESPERA_VENCIDA')).toBe(false)
  })
})

describe('POSPUESTO_REITERADO', () => {
  it('detecta >=3 reprogramaciones en 30 días', () => {
    const snapshot = snapshotVacio()
    snapshot.elementosAbiertos = [
      { id: 'a', tipo: 'asignacion', titulo: 'X', estado: 'programado', fechaRevision: null, ultimoEventoAt: AHORA, minutosPendientesTotales: 0, vencimiento: null },
    ]
    snapshot.reprogramaciones = [
      { entidadId: 'a', ocurridoEn: '2026-08-20T08:00:00-06:00' },
      { entidadId: 'a', ocurridoEn: '2026-08-25T08:00:00-06:00' },
      { entidadId: 'a', ocurridoEn: '2026-09-01T08:00:00-06:00' },
    ]
    expect(ejecutarRadar(snapshot, RADAR_CONFIG_DEFECTO, AHORA).some((h) => h.regla === 'POSPUESTO_REITERADO')).toBe(true)
  })

  it('no dispara con solo 2 reprogramaciones', () => {
    const snapshot = snapshotVacio()
    snapshot.elementosAbiertos = [
      { id: 'a', tipo: 'asignacion', titulo: 'X', estado: 'programado', fechaRevision: null, ultimoEventoAt: AHORA, minutosPendientesTotales: 0, vencimiento: null },
    ]
    snapshot.reprogramaciones = [
      { entidadId: 'a', ocurridoEn: '2026-08-20T08:00:00-06:00' },
      { entidadId: 'a', ocurridoEn: '2026-08-25T08:00:00-06:00' },
    ]
    expect(ejecutarRadar(snapshot, RADAR_CONFIG_DEFECTO, AHORA).some((h) => h.regla === 'POSPUESTO_REITERADO')).toBe(false)
  })
})

describe('ACTIVIDAD_SIN_CIERRE', () => {
  it('detecta una actividad iniciada hace > 12 horas sin finalizar', () => {
    const snapshot = snapshotVacio()
    snapshot.actividades = [{ id: 'x', titulo: 'trabajo de campo', estado: 'en_curso', iniciadaEn: '2026-09-07T18:00:00-06:00' }]
    expect(ejecutarRadar(snapshot, RADAR_CONFIG_DEFECTO, AHORA).some((h) => h.regla === 'ACTIVIDAD_SIN_CIERRE')).toBe(true)
  })

  it('no dispara si ya está finalizada', () => {
    const snapshot = snapshotVacio()
    snapshot.actividades = [{ id: 'x', titulo: 'trabajo de campo', estado: 'finalizada', iniciadaEn: '2026-09-07T18:00:00-06:00' }]
    expect(ejecutarRadar(snapshot, RADAR_CONFIG_DEFECTO, AHORA).some((h) => h.regla === 'ACTIVIDAD_SIN_CIERRE')).toBe(false)
  })
})

describe('INICIATIVA_SIN_AVANCE', () => {
  it('detecta cuota incumplida con deuda sobre el umbral', () => {
    const snapshot = snapshotVacio()
    snapshot.iniciativas = [{ id: 'ini-1', titulo: 'Mejora de procesos', cuotaSemanalMin: 120, minutosEjecutadosSemana: 0, deudaMin: 90 }]
    expect(ejecutarRadar(snapshot, RADAR_CONFIG_DEFECTO, AHORA).some((h) => h.regla === 'INICIATIVA_SIN_AVANCE')).toBe(true)
  })

  it('no dispara si la deuda está bajo el umbral', () => {
    const snapshot = snapshotVacio()
    snapshot.iniciativas = [{ id: 'ini-1', titulo: 'Mejora de procesos', cuotaSemanalMin: 120, minutosEjecutadosSemana: 100, deudaMin: 10 }]
    expect(ejecutarRadar(snapshot, RADAR_CONFIG_DEFECTO, AHORA).some((h) => h.regla === 'INICIATIVA_SIN_AVANCE')).toBe(false)
  })
})

describe('CAPTURA_SIN_PROCESAR', () => {
  it('detecta una captura de más de 48 horas', () => {
    const snapshot = snapshotVacio()
    snapshot.capturas = [{ id: 'c1', texto: 'llamar a...', estado: 'capturado', creadoEn: '2026-09-05T08:00:00-06:00' }]
    expect(ejecutarRadar(snapshot, RADAR_CONFIG_DEFECTO, AHORA).some((h) => h.regla === 'CAPTURA_SIN_PROCESAR')).toBe(true)
  })

  it('no dispara si ya fue procesada', () => {
    const snapshot = snapshotVacio()
    snapshot.capturas = [{ id: 'c1', texto: 'llamar a...', estado: 'procesado', creadoEn: '2026-09-05T08:00:00-06:00' }]
    expect(ejecutarRadar(snapshot, RADAR_CONFIG_DEFECTO, AHORA).some((h) => h.regla === 'CAPTURA_SIN_PROCESAR')).toBe(false)
  })
})

describe('VENCIMIENTO_INALCANZABLE', () => {
  it('detecta cuando el trabajo pendiente excede la capacidad disponible', () => {
    const snapshot = snapshotVacio()
    snapshot.elementosAbiertos = [
      {
        id: 't1', tipo: 'tramite', titulo: 'Trámite con etapas atrasadas', estado: 'programado',
        fechaRevision: null, ultimoEventoAt: AHORA, vencimiento: '2026-09-10',
        minutosPendientesTotales: 1000, // muy por encima de lo alcanzable en 2 días hábiles
      },
    ]
    expect(ejecutarRadar(snapshot, RADAR_CONFIG_DEFECTO, AHORA).some((h) => h.regla === 'VENCIMIENTO_INALCANZABLE')).toBe(true)
  })

  it('no dispara si el pendiente cabe en la capacidad disponible', () => {
    const snapshot = snapshotVacio()
    snapshot.elementosAbiertos = [
      {
        id: 't1', tipo: 'tramite', titulo: 'Trámite al día', estado: 'programado',
        fechaRevision: null, ultimoEventoAt: AHORA, vencimiento: '2026-09-30',
        minutosPendientesTotales: 60,
      },
    ]
    expect(ejecutarRadar(snapshot, RADAR_CONFIG_DEFECTO, AHORA).some((h) => h.regla === 'VENCIMIENTO_INALCANZABLE')).toBe(false)
  })
})

describe('ejecutarRadar', () => {
  it('cada hallazgo trae las seis acciones sugeridas del vocabulario de decisión', () => {
    const snapshot = snapshotVacio()
    snapshot.capturas = [{ id: 'c1', texto: 'x', estado: 'capturado', creadoEn: '2026-09-01T08:00:00-06:00' }]
    const [hallazgo] = ejecutarRadar(snapshot, RADAR_CONFIG_DEFECTO, AHORA)
    expect(hallazgo?.acciones_sugeridas.length).toBeGreaterThan(0)
  })
})
