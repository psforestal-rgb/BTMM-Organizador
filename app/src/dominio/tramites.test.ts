import { describe, expect, it } from 'vitest'
import { proximaAccion } from './tramites'
import type { EtapaTramite } from './tipos'

const ETAPAS: EtapaTramite[] = [
  { id: 'e1', nombre: 'Recepción', orden: 1, condiciones: [], dependencias: [], plazo_dias_habiles: 2, producto: 'acuse' },
  { id: 'e2', nombre: 'Revisión técnica', orden: 2, condiciones: [], dependencias: ['e1'], plazo_dias_habiles: 3, producto: 'informe' },
  { id: 'e3', nombre: 'Resolución', orden: 3, condiciones: [], dependencias: ['e2'], plazo_dias_habiles: 1, producto: 'oficio' },
]

describe('proximaAccion — CA-07', () => {
  it('la primera etapa pendiente es la próxima acción cuando nada se ha completado', () => {
    const resultado = proximaAccion(ETAPAS, [], '2026-09-08')
    expect(resultado?.etapaId).toBe('e1')
    expect(resultado?.bloqueadaPorDependencia).toBe(false)
    expect(resultado?.fechaLimite).toBe('2026-09-10')
  })

  it('avanza a la siguiente etapa una vez completada la anterior', () => {
    const resultado = proximaAccion(ETAPAS, [{ etapaId: 'e1', estado: 'completado' }], '2026-09-08')
    expect(resultado?.etapaId).toBe('e2')
    expect(resultado?.bloqueadaPorDependencia).toBe(false)
  })

  it('marca bloqueada por dependencia si la etapa previa no está completa', () => {
    // e2 nunca puede ser "próxima acción real" sin e1, pero si se marca
    // e1 pendiente explícitamente la función igual reporta el bloqueo.
    const resultado = proximaAccion(
      [ETAPAS[1] as EtapaTramite],
      [],
      '2026-09-08',
    )
    expect(resultado?.bloqueadaPorDependencia).toBe(true)
    expect(resultado?.fechaLimite).toBeNull()
  })

  it('no hay próxima acción cuando todas las etapas están completas', () => {
    const resultado = proximaAccion(
      ETAPAS,
      ETAPAS.map((e) => ({ etapaId: e.id, estado: 'completado' as const })),
      '2026-09-08',
    )
    expect(resultado).toBeNull()
  })

  it('es determinista sin importar el orden de entrada de las etapas', () => {
    const desordenadas = [ETAPAS[2], ETAPAS[0], ETAPAS[1]] as EtapaTramite[]
    const a = proximaAccion(ETAPAS, [], '2026-09-08')
    const b = proximaAccion(desordenadas, [], '2026-09-08')
    expect(a).toEqual(b)
  })
})
