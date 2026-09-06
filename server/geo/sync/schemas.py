from typing import Any

from pydantic import BaseModel


class EventoIn(BaseModel):
    event_id: str
    entity_type: str
    entity_id: str
    event_type: str
    occurred_at: str
    recorded_at: str
    device_id: str
    client_sequence: int
    base_version: str | None = None
    payload: dict[str, Any] = {}


class EventoOut(EventoIn):
    server_seq: int | None = None


class CambioIn(BaseModel):
    change_id: str
    entity_type: str
    entity_id: str
    device_id: str
    client_sequence: int
    occurred_at: str
    base_version: str | None = None
    campos: dict[str, Any]
    campo_ts: dict[str, str]


class CambioOut(CambioIn):
    server_seq: int | None = None


class PushRequest(BaseModel):
    device_id: str
    eventos: list[EventoIn] = []
    cambios: list[CambioIn] = []


class RechazoItem(BaseModel):
    id: str
    motivo: str


class PushResponse(BaseModel):
    aceptados: list[str]
    duplicados: list[str]
    rechazados: list[RechazoItem]
    server_seq: int


class PullResponse(BaseModel):
    eventos: list[EventoOut]
    cambios: list[CambioOut]
    server_seq: int
    hay_mas: bool


class StatusResponse(BaseModel):
    server_seq: int
    ultimo_client_sequence: int
    conflictos_abiertos: int
    ultima_conexion_at: str | None


class ConflictoOut(BaseModel):
    id: str
    entity_type: str
    entity_id: str
    campo: str
    valor_ganador: Any
    device_ganador: str
    ts_ganador: str
    valor_perdedor: Any
    device_perdedor: str
    ts_perdedor: str
    resuelto: bool
