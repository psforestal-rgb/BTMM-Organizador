"""ADR 0002: fusion.py y fusion.ts deben producir exactamente el mismo
resultado. Esta prueba corre la tabla de verdad compartida
docs/fixtures/fusion_casos.json contra la implementación de Python; la
prueba equivalente en Vitest (app/src/sync/fusion.test.ts) corre la
misma tabla contra la implementación de TypeScript."""

import json
import pathlib

from geo.sync.fusion import MetaCampo, fusionar_campo

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
FIXTURE = REPO_ROOT / "docs" / "fixtures" / "fusion_casos.json"


def _casos():
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def test_tabla_de_verdad_compartida():
    casos = _casos()
    assert len(casos) >= 5
    for caso in casos:
        meta_actual = MetaCampo(**caso["meta_actual"])
        meta_entrante = MetaCampo(**caso["meta_entrante"])
        resultado = fusionar_campo(
            caso["campo"], caso["valor_actual"], meta_actual, caso["valor_entrante"], meta_entrante
        )
        esperado = caso["esperado"]

        assert resultado.valor == esperado["valor"], caso["nombre"]
        assert resultado.meta.updated_at == esperado["meta"]["updated_at"], caso["nombre"]
        assert resultado.meta.device_id == esperado["meta"]["device_id"], caso["nombre"]

        if esperado["conflicto"] is None:
            assert resultado.conflicto is None, caso["nombre"]
        else:
            assert resultado.conflicto is not None, caso["nombre"]
            assert resultado.conflicto.campo == esperado["conflicto"]["campo"]
            assert resultado.conflicto.valor_ganador == esperado["conflicto"]["valor_ganador"]
            assert resultado.conflicto.device_ganador == esperado["conflicto"]["device_ganador"]
            assert resultado.conflicto.valor_perdedor == esperado["conflicto"]["valor_perdedor"]
            assert resultado.conflicto.device_perdedor == esperado["conflicto"]["device_perdedor"]
