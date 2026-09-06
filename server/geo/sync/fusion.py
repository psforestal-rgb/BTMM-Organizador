"""Fusión por campo (sección 5.4, ADR 0002). Puro: sin SQLAlchemy, sin
IO. Debe coincidir exactamente con app/src/sync/fusion.ts — cualquier
divergencia entre ambos es un bug, no una libertad de implementación."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

CAMPOS_CRITICOS = frozenset(
    {"estado", "vencimiento", "prioridad", "fecha_revision", "duracion_estimada_min"}
)


@dataclass(frozen=True)
class MetaCampo:
    updated_at: str
    device_id: str


@dataclass(frozen=True)
class Conflicto:
    campo: str
    valor_ganador: Any
    device_ganador: str
    ts_ganador: str
    valor_perdedor: Any
    device_perdedor: str
    ts_perdedor: str


@dataclass(frozen=True)
class ResultadoFusionCampo:
    valor: Any
    meta: MetaCampo
    conflicto: Conflicto | None


def _gana(candidata: MetaCampo, actual: MetaCampo) -> bool:
    """True si `candidata` debe reemplazar a `actual`. Determinista y
    simétrica: mismo resultado sin importar qué dispositivo evalúe."""
    if candidata.updated_at != actual.updated_at:
        return candidata.updated_at > actual.updated_at
    return candidata.device_id > actual.device_id


def fusionar_campo(
    nombre_campo: str,
    valor_actual: Any,
    meta_actual: MetaCampo,
    valor_entrante: Any,
    meta_entrante: MetaCampo,
) -> ResultadoFusionCampo:
    """Fusiona un único campo que ya tenía un valor previo (con su
    field_meta). Para un campo sin valor previo no se llama esta función:
    el valor entrante se acepta directamente, sin comparación posible."""
    if _gana(meta_entrante, meta_actual):
        valor_ganador, meta_ganadora = valor_entrante, meta_entrante
        valor_perdedor, meta_perdedora = valor_actual, meta_actual
    else:
        valor_ganador, meta_ganadora = valor_actual, meta_actual
        valor_perdedor, meta_perdedora = valor_entrante, meta_entrante

    conflicto = None
    if nombre_campo in CAMPOS_CRITICOS and valor_perdedor != valor_ganador:
        conflicto = Conflicto(
            campo=nombre_campo,
            valor_ganador=valor_ganador,
            device_ganador=meta_ganadora.device_id,
            ts_ganador=meta_ganadora.updated_at,
            valor_perdedor=valor_perdedor,
            device_perdedor=meta_perdedora.device_id,
            ts_perdedor=meta_perdedora.updated_at,
        )

    return ResultadoFusionCampo(valor=valor_ganador, meta=meta_ganadora, conflicto=conflicto)
