import { describe, expect, it } from 'vitest'
import type { CandidataPlan, EntradaPlanificador } from './planificador'
import { replanificar } from './replanificacion'

const FECHA = '2026-09-08'
const JORNADA = { inicio: '07:00', fin: '16:00', almuerzoInicio: '12:00', almuerzoFin: '13:00' }

function entrada(candidatas: CandidataPlan[], intervalosEjecutados: EntradaPlanificador['intervalosEjecutados'] = []): EntradaPlanificador {
  return {
    fecha: FECHA,
    jornada: JORNADA,
    eventosFijos: [],
    intervalosEjecutados,
    candidatas,
    ahora: '08:00',
  }
}

describe('replanificar — CA-04 / sección 7.4', () => {
  it('reprograma el remanente del informe interrumpido con DESPLAZADA_POR_INTERRUPCION', () => {
    const informe: CandidataPlan = {
      id: 'informe',
      titulo: 'Informe técnico CASO-2026-001',
      carril: 'planificado',
      duracionMin: 90,
      vencimiento: FECHA,
      prioridad: 4,
      indivisible: false,
      dependenciasCumplidas: true,
    }
    // El informe se inició a las 08:35 y se interrumpió a las 08:45 (10 min
    // reales trabajados antes de la interrupción, ya presentes como
    // intervalo ejecutado 08:35-08:45).
    const entradaOriginal = entrada([informe], [{ inicio: '08:35', fin: '08:45' }])

    const salida = replanificar(
      entradaOriginal,
      {
        candidataInterrumpidaId: 'informe',
        inicioInterrupcion: '08:45',
        finInterrupcion: '09:10',
        marcadorReanudacion: 'me quedé comparando vértices 11-17',
        minutosEjecutadosDeLaCandidata: 10,
      },
      '09:10',
    )

    const bloquesInforme = salida.bloques.filter((b) => b.candidataId === 'informe')
    expect(bloquesInforme.length).toBeGreaterThan(0)
    for (const bloque of bloquesInforme) {
      expect(bloque.justificacion.codigo).toBe('DESPLAZADA_POR_INTERRUPCION')
      expect(bloque.justificacion.texto).toContain('08:45')
      expect(bloque.justificacion.texto).toContain('09:10')
      expect(bloque.marcadorReanudacion).toBe('me quedé comparando vértices 11-17')
    }
    const totalRemanente = bloquesInforme.reduce(
      (t, b) => t + (Number(b.fin.slice(0, 2)) * 60 + Number(b.fin.slice(3)) - (Number(b.inicio.slice(0, 2)) * 60 + Number(b.inicio.slice(3)))),
      0,
    )
    expect(totalRemanente).toBe(80) // 90 - 10 ya ejecutados

    // El buffer restante bajó porque los 25 min emergentes (08:45-09:10) lo consumieron.
    expect(salida.bufferRestanteMin).toBe(50)

    // Ni el intervalo ya ejecutado ni la interrupción se solapan con el remanente.
    for (const bloque of bloquesInforme) {
      expect(bloque.inicio >= '09:10').toBe(true)
    }
  })

  it('no reprograma nada si la candidata interrumpida no existe', () => {
    expect(() =>
      replanificar(
        entrada([]),
        {
          candidataInterrumpidaId: 'inexistente',
          inicioInterrupcion: '08:45',
          finInterrupcion: '09:10',
          marcadorReanudacion: 'x',
          minutosEjecutadosDeLaCandidata: 10,
        },
        '09:10',
      ),
    ).toThrow()
  })
})
