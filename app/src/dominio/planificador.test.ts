import { describe, expect, it } from 'vitest'
import {
  dividirEnPiezas,
  planificarDia,
  type CandidataPlan,
  type EntradaPlanificador,
} from './planificador'

const FECHA = '2026-09-08' // martes
const JORNADA = { inicio: '07:00', fin: '16:00', almuerzoInicio: '12:00', almuerzoFin: '13:00' }

function candidata(overrides: Partial<CandidataPlan> & { id: string }): CandidataPlan {
  return {
    titulo: overrides.id,
    carril: 'planificado',
    duracionMin: 60,
    vencimiento: null,
    prioridad: 2,
    indivisible: false,
    dependenciasCumplidas: true,
    ...overrides,
  }
}

function entradaBase(overrides: Partial<EntradaPlanificador> = {}): EntradaPlanificador {
  return {
    fecha: FECHA,
    jornada: JORNADA,
    eventosFijos: [],
    intervalosEjecutados: [],
    candidatas: [],
    ahora: '07:00',
    ...overrides,
  }
}

describe('dividirEnPiezas', () => {
  it('no fragmenta si la duración total es <= 90', () => {
    expect(dividirEnPiezas(90)).toEqual([90])
    expect(dividirEnPiezas(15)).toEqual([15])
  })

  it('fragmenta sin dejar migajas', () => {
    expect(dividirEnPiezas(100)).toEqual([50, 50])
    expect(dividirEnPiezas(180)).toEqual([90, 90])
    for (const total of [95, 100, 120, 150, 181, 200, 260]) {
      const piezas = dividirEnPiezas(total)
      expect(piezas.reduce((a, b) => a + b, 0)).toBe(total)
      for (const pieza of piezas) {
        expect(pieza).toBeGreaterThanOrEqual(25)
        expect(pieza).toBeLessThanOrEqual(90)
      }
    }
  })
})

describe('planificarDia — casos básicos', () => {
  it('coloca una candidata indivisible en el primer hueco disponible', () => {
    const salida = planificarDia(
      entradaBase({ candidatas: [candidata({ id: 'a', duracionMin: 90, indivisible: true })] }),
    )
    expect(salida.noProgramadas).toEqual([])
    expect(salida.bloques).toHaveLength(1)
    expect(salida.bloques[0]).toMatchObject({ candidataId: 'a', inicio: '07:00', fin: '08:30' })
  })

  it('nunca mueve los eventos fijos', () => {
    const salida = planificarDia(
      entradaBase({
        eventosFijos: [{ inicio: '09:00', fin: '10:00' }],
        candidatas: [candidata({ id: 'a', duracionMin: 180, indivisible: false })],
      }),
    )
    const solapaConReunion = salida.bloques.some(
      (b) => b.inicio < '10:00' && b.fin > '09:00',
    )
    expect(solapaConReunion).toBe(false)
  })

  it('respeta dependencias sin cumplir', () => {
    const salida = planificarDia(
      entradaBase({
        candidatas: [candidata({ id: 'a', dependenciasCumplidas: false })],
      }),
    )
    expect(salida.noProgramadas).toEqual([
      { candidataId: 'a', justificacion: expect.objectContaining({ codigo: 'BLOQUEADA_POR_DEPENDENCIA' }) },
    ])
  })

  it('una indivisible que no cabe en ningún hueco recibe NO_CABE_INDIVISIBLE', () => {
    const salida = planificarDia(
      entradaBase({
        jornada: { inicio: '07:00', fin: '08:00', almuerzoInicio: '12:00', almuerzoFin: '13:00' },
        candidatas: [candidata({ id: 'a', duracionMin: 120, indivisible: true })],
      }),
    )
    expect(salida.noProgramadas[0]?.justificacion.codigo).toBe('NO_CABE_INDIVISIBLE')
  })
})

describe('CA-05 — capacidad de absorción real', () => {
  it('nunca programa por encima de capacidad_total - buffer_restante', () => {
    // Jornada 07:00-16:00 sin almuerzo raro: libres = (07-12)+(13-16) = 5h+3h=8h=480min
    // buffer 75 -> programable = 405min. Colocamos una candidata de 400 (cabe)
    // y otra de 10 (400+10=410>405) que debe ser rechazada por el buffer.
    const salida = planificarDia(
      entradaBase({
        candidatas: [
          candidata({ id: 'grande', duracionMin: 400, indivisible: false, prioridad: 4 }),
          candidata({ id: 'chica', duracionMin: 10, indivisible: true, prioridad: 1 }),
        ],
      }),
    )
    expect(salida.capacidadTotalMin).toBe(480)
    expect(salida.bufferRestanteMin).toBe(75)
    expect(salida.capacidadProgramableMin).toBe(405)

    const minutosProgramados = salida.bloques.reduce(
      (t, b) => t + (Number(b.fin.slice(0, 2)) * 60 + Number(b.fin.slice(3))) - (Number(b.inicio.slice(0, 2)) * 60 + Number(b.inicio.slice(3))),
      0,
    )
    expect(minutosProgramados).toBeLessThanOrEqual(405)

    const rechazoChica = salida.noProgramadas.find((n) => n.candidataId === 'chica')
    expect(rechazoChica?.justificacion.codigo).toBe('PROTEGIDO_BUFFER_ABSORCION')
  })

  it('minutos emergentes ya registrados reducen el buffer restante y liberan capacidad', () => {
    const salida = planificarDia(
      entradaBase({ minutosEmergentesHoy: 75, candidatas: [] }),
    )
    expect(salida.bufferRestanteMin).toBe(0)
    expect(salida.capacidadProgramableMin).toBe(salida.capacidadTotalMin)
  })
})

describe('CA-06 — determinismo del planificador', () => {
  function candidatasVariadas(): CandidataPlan[] {
    return [
      candidata({ id: 'a', duracionMin: 60, vencimiento: FECHA, prioridad: 3 }),
      candidata({ id: 'b', duracionMin: 45, vencimiento: '2026-09-10', prioridad: 2 }),
      candidata({ id: 'c', duracionMin: 30, prioridad: 4 }),
      candidata({ id: 'd', duracionMin: 90, indivisible: true, prioridad: 1 }),
      candidata({ id: 'e', duracionMin: 25, prioridad: 2, iniciativaId: 'ini-1' }),
    ]
  }

  it('el mismo resultado (serializado) sale de 100 barajados del orden de entrada', () => {
    const base = JSON.stringify(
      planificarDia(entradaBase({ candidatas: candidatasVariadas() })),
    )
    for (let intento = 0; intento < 100; intento += 1) {
      const barajadas = [...candidatasVariadas()]
      for (let i = barajadas.length - 1; i > 0; i -= 1) {
        const j = Math.floor(((intento + 1) * (i + 7)) % (i + 1))
        const tmp = barajadas[i] as CandidataPlan
        barajadas[i] = barajadas[j] as CandidataPlan
        barajadas[j] = tmp
      }
      const salida = JSON.stringify(planificarDia(entradaBase({ candidatas: barajadas })))
      expect(salida).toBe(base)
    }
  })

  it('cada bloque y cada no-programada llevan un código del vocabulario cerrado', () => {
    const codigosValidos = new Set([
      'VENCE_HOY', 'HOLGURA_MINIMA', 'PRIORIDAD_ALTA', 'CUOTA_INICIATIVA',
      'CUOTA_DESPLAZADA_POR_URGENCIA', 'RELLENO_CAPACIDAD', 'FRAGMENTADA_LIMITE_90MIN',
      'PAUSA_TRAS_BLOQUE_INTENSO', 'DESPLAZADA_POR_INTERRUPCION', 'SIN_CAPACIDAD_PROGRAMABLE',
      'NO_CABE_INDIVISIBLE', 'BLOQUEADA_POR_DEPENDENCIA', 'FUERA_DE_JORNADA', 'PROTEGIDO_BUFFER_ABSORCION',
    ])
    const salida = planificarDia(entradaBase({ candidatas: candidatasVariadas() }))
    for (const bloque of salida.bloques) expect(codigosValidos.has(bloque.justificacion.codigo)).toBe(true)
    for (const np of salida.noProgramadas) expect(codigosValidos.has(np.justificacion.codigo)).toBe(true)
  })
})

describe('Fragmentación (sección 7.3)', () => {
  it('fragmenta una candidata divisible de 200 min en piezas <=90 con pausa tras bloque intenso', () => {
    const salida = planificarDia(
      entradaBase({
        jornada: { inicio: '07:00', fin: '19:00', almuerzoInicio: '12:00', almuerzoFin: '13:00' },
        bufferAbsorcionMin: 0,
        candidatas: [candidata({ id: 'larga', duracionMin: 200, indivisible: false })],
      }),
    )
    const bloquesLarga = salida.bloques.filter((b) => b.candidataId === 'larga')
    const total = bloquesLarga.reduce(
      (t, b) => t + (aMin(b.fin) - aMin(b.inicio)),
      0,
    )
    expect(total).toBe(200)
    for (const b of bloquesLarga) {
      const dur = aMin(b.fin) - aMin(b.inicio)
      expect(dur).toBeGreaterThanOrEqual(25)
      expect(dur).toBeLessThanOrEqual(90)
    }
    expect(bloquesLarga.length).toBeGreaterThan(1)
  })
})

function aMin(hhmm: string): number {
  const partes = hhmm.split(':').map(Number)
  return (partes[0] ?? 0) * 60 + (partes[1] ?? 0)
}

describe('CA-09 — cuotas de iniciativa y deuda de progreso', () => {
  it('reserva CUOTA_INICIATIVA cuando falta cuota semanal y quedan >=2 días hábiles', () => {
    const salida = planificarDia(
      entradaBase({
        candidatas: [],
        cuotasIniciativa: [
          { iniciativaId: 'ini-1', cuotaSemanalMin: 120, minutosEjecutadosSemana: 0, deudaMin: 0 },
        ],
      }),
    )
    expect(salida.reservasIniciativa).toHaveLength(1)
    expect(salida.reservasIniciativa[0]?.justificacion.codigo).toBe('CUOTA_INICIATIVA')
    expect(aMin(salida.reservasIniciativa[0]!.fin) - aMin(salida.reservasIniciativa[0]!.inicio)).toBe(60)
  })

  it('una urgencia que vence hoy puede desalojar la reserva y registra deuda', () => {
    const salida = planificarDia(
      entradaBase({
        jornada: { inicio: '07:00', fin: '08:00', almuerzoInicio: '12:00', almuerzoFin: '13:00' },
        bufferAbsorcionMin: 0,
        candidatas: [
          candidata({ id: 'urgente', duracionMin: 60, indivisible: true, vencimiento: FECHA, prioridad: 4 }),
        ],
        cuotasIniciativa: [
          { iniciativaId: 'ini-1', cuotaSemanalMin: 120, minutosEjecutadosSemana: 0, deudaMin: 0 },
        ],
      }),
    )
    const bloqueUrgente = salida.bloques.find((b) => b.candidataId === 'urgente')
    expect(bloqueUrgente?.justificacion.codigo).toBe('CUOTA_DESPLAZADA_POR_URGENCIA')
    expect(salida.deudasRegistradas).toEqual([{ iniciativaId: 'ini-1', minutos: 60 }])
    expect(salida.reservasIniciativa).toHaveLength(0)
  })
})
