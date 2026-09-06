// ADR 0002: misma tabla de verdad que server/tests/test_fusion_paridad.py.
// Cualquier divergencia entre esta prueba y la de Python es un bug en una
// de las dos implementaciones, no una libertad de diseño.

import { describe, expect, it } from 'vitest'
import casos from './fusion_casos.json'
import { fusionarCampo, type MetaCampo } from './fusion'

interface CasoPrueba {
  nombre: string
  campo: string
  valor_actual: unknown
  meta_actual: MetaCampo
  valor_entrante: unknown
  meta_entrante: MetaCampo
  esperado: {
    valor: unknown
    meta: MetaCampo
    conflicto: null | {
      campo: string
      valor_ganador: unknown
      device_ganador: string
      valor_perdedor: unknown
      device_perdedor: string
    }
  }
}

describe('fusionarCampo — tabla de verdad compartida con Python', () => {
  const tabla = casos as CasoPrueba[]
  expect(tabla.length).toBeGreaterThanOrEqual(5)

  it.each(tabla)('$nombre', (caso) => {
    const resultado = fusionarCampo(
      caso.campo,
      caso.valor_actual,
      caso.meta_actual,
      caso.valor_entrante,
      caso.meta_entrante,
    )

    expect(resultado.valor).toEqual(caso.esperado.valor)
    expect(resultado.meta).toEqual(caso.esperado.meta)

    if (caso.esperado.conflicto === null) {
      expect(resultado.conflicto).toBeNull()
    } else {
      expect(resultado.conflicto?.campo).toBe(caso.esperado.conflicto.campo)
      expect(resultado.conflicto?.valor_ganador).toEqual(caso.esperado.conflicto.valor_ganador)
      expect(resultado.conflicto?.device_ganador).toBe(caso.esperado.conflicto.device_ganador)
      expect(resultado.conflicto?.valor_perdedor).toEqual(caso.esperado.conflicto.valor_perdedor)
      expect(resultado.conflicto?.device_perdedor).toBe(caso.esperado.conflicto.device_perdedor)
    }
  })
})
