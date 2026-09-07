"""Orquestación de sincronización (sección 6). A diferencia de
geo.dominio y de fusion.py, este módulo sí toca SQLAlchemy y el reloj de
sistema real: es infraestructura de servidor, no dominio puro."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from geo.datos.modelos import (
    ENTIDADES_MUTABLES,
    CambioRegistro,
    Conflicto,
    EstadoDispositivoSync,
    Evento,
    SecuenciaGlobal,
)

from .fusion import MetaCampo, fusionar_campo
from .schemas import CambioIn, EventoIn, PullResponse, PushRequest, PushResponse, StatusResponse


class EntidadNoExisteError(Exception):
    pass


def _ahora_servidor() -> str:
    return datetime.now(UTC).isoformat()


def _siguiente_server_seq(db: Session) -> int:
    fila = db.get(SecuenciaGlobal, 1)
    if fila is None:
        fila = SecuenciaGlobal(id=1, valor=0)
        db.add(fila)
        db.flush()
    fila.valor += 1
    db.flush()
    return fila.valor


def _obtener_o_crear_estado_dispositivo(db: Session, device_id: str) -> EstadoDispositivoSync:
    fila = db.get(EstadoDispositivoSync, device_id)
    if fila is None:
        fila = EstadoDispositivoSync(
            device_id=device_id,
            ultimo_client_sequence=0,
            ultimo_server_seq_entregado=0,
            ultima_conexion_at=None,
        )
        db.add(fila)
        db.flush()
    return fila


def _evento_ya_recibido(db: Session, evento: EventoIn) -> bool:
    if db.get(Evento, evento.event_id) is not None:
        return True
    existente = db.execute(
        select(Evento).where(
            Evento.device_id == evento.device_id,
            Evento.client_sequence == evento.client_sequence,
        )
    ).scalar_one_or_none()
    return existente is not None


def _indica_creacion_de_entidad(event_type: str) -> bool:
    """"_creada"/"_creado": sufijo genérico de creación. Excepción única:
    "paso_completado" — no existe un "paso_tramite_creado" separado en el
    vocabulario porque completar una etapa es lo único que instancia su
    PasoTramite. Debe coincidir con indicaCreacionDeEntidad en el cliente
    (app/src/sync/outbox.ts)."""
    return (
        event_type.endswith("_creada")
        or event_type.endswith("_creado")
        or event_type == "paso_completado"
    )


def _aplicar_evento_creacion(db: Session, evento: EventoIn) -> None:
    """Si el event_type indica creación, instancia la entidad mutable
    correspondiente a partir de payload. Evita duplicar si la entidad ya
    existe (reenvío)."""
    if not _indica_creacion_de_entidad(evento.event_type):
        return
    clase = ENTIDADES_MUTABLES.get(evento.entity_type)
    if clase is None:
        return
    if db.get(clase, evento.entity_id) is not None:
        return
    columnas_validas = {c.name for c in clase.__table__.columns}
    valores = {k: v for k, v in evento.payload.items() if k in columnas_validas}
    fila = clase(
        id=evento.entity_id, version_id=str(uuid4()), field_meta={}, eliminado=False, **valores
    )
    db.add(fila)
    db.flush()


def _cambio_ya_recibido(db: Session, cambio: CambioIn) -> bool:
    if db.get(CambioRegistro, cambio.change_id) is not None:
        return True
    existente = db.execute(
        select(CambioRegistro).where(
            CambioRegistro.device_id == cambio.device_id,
            CambioRegistro.client_sequence == cambio.client_sequence,
        )
    ).scalar_one_or_none()
    return existente is not None


def _aplicar_cambio(db: Session, cambio: CambioIn) -> list[Conflicto]:
    """Aplica un cambio de campos sobre la entidad mutable. Un campo sin
    field_meta previo se acepta directo (nada con qué compararlo); un
    campo con field_meta previo pasa por fusionar_campo, que puede
    producir un conflicto si el campo es crítico y los valores difieren."""
    clase = ENTIDADES_MUTABLES.get(cambio.entity_type)
    if clase is None:
        raise EntidadNoExisteError(f"tipo de entidad desconocido: {cambio.entity_type}")
    fila = db.get(clase, cambio.entity_id)
    if fila is None:
        raise EntidadNoExisteError(
            f"la entidad {cambio.entity_type}/{cambio.entity_id} no existe todavía"
        )

    field_meta = dict(fila.field_meta or {})
    conflictos_generados: list[Conflicto] = []

    for campo, valor_entrante in cambio.campos.items():
        ts_entrante = cambio.campo_ts.get(campo, cambio.occurred_at)
        meta_entrante = MetaCampo(updated_at=ts_entrante, device_id=cambio.device_id)
        meta_actual_dict = field_meta.get(campo)

        if meta_actual_dict is None:
            setattr(fila, campo, valor_entrante)
            field_meta[campo] = {"updated_at": ts_entrante, "device_id": cambio.device_id}
            continue

        meta_actual = MetaCampo(
            updated_at=meta_actual_dict["updated_at"], device_id=meta_actual_dict["device_id"]
        )
        valor_actual = getattr(fila, campo)
        resultado = fusionar_campo(campo, valor_actual, meta_actual, valor_entrante, meta_entrante)
        setattr(fila, campo, resultado.valor)
        field_meta[campo] = {
            "updated_at": resultado.meta.updated_at,
            "device_id": resultado.meta.device_id,
        }
        if resultado.conflicto is not None:
            c = resultado.conflicto
            conflictos_generados.append(
                Conflicto(
                    id=str(uuid4()),
                    version_id=str(uuid4()),
                    field_meta={},
                    eliminado=False,
                    entity_type=cambio.entity_type,
                    entity_id=cambio.entity_id,
                    campo=c.campo,
                    valor_ganador=c.valor_ganador,
                    device_ganador=c.device_ganador,
                    ts_ganador=c.ts_ganador,
                    valor_perdedor=c.valor_perdedor,
                    device_perdedor=c.device_perdedor,
                    ts_perdedor=c.ts_perdedor,
                    resuelto=False,
                )
            )

    fila.field_meta = field_meta
    fila.version_id = str(uuid4())
    for conflicto in conflictos_generados:
        db.add(conflicto)
    db.flush()
    return conflictos_generados


def push(db: Session, request: PushRequest) -> PushResponse:
    aceptados: list[str] = []
    duplicados: list[str] = []
    rechazados: list[dict[str, str]] = []

    estado = _obtener_o_crear_estado_dispositivo(db, request.device_id)

    for evento in request.eventos:
        if _evento_ya_recibido(db, evento):
            duplicados.append(evento.event_id)
            continue
        server_seq = _siguiente_server_seq(db)
        db.add(
            Evento(
                event_id=evento.event_id,
                entity_type=evento.entity_type,
                entity_id=evento.entity_id,
                event_type=evento.event_type,
                occurred_at=evento.occurred_at,
                recorded_at=evento.recorded_at,
                device_id=evento.device_id,
                client_sequence=evento.client_sequence,
                base_version=evento.base_version,
                payload=evento.payload,
                server_seq=server_seq,
            )
        )
        db.flush()
        _aplicar_evento_creacion(db, evento)
        aceptados.append(evento.event_id)
        estado.ultimo_client_sequence = max(estado.ultimo_client_sequence, evento.client_sequence)

    for cambio in request.cambios:
        if _cambio_ya_recibido(db, cambio):
            duplicados.append(cambio.change_id)
            continue
        try:
            _aplicar_cambio(db, cambio)
        except EntidadNoExisteError as error:
            rechazados.append({"id": cambio.change_id, "motivo": str(error)})
            continue
        server_seq = _siguiente_server_seq(db)
        db.add(
            CambioRegistro(
                change_id=cambio.change_id,
                entity_type=cambio.entity_type,
                entity_id=cambio.entity_id,
                device_id=cambio.device_id,
                client_sequence=cambio.client_sequence,
                occurred_at=cambio.occurred_at,
                base_version=cambio.base_version,
                campos=cambio.campos,
                campo_ts=cambio.campo_ts,
                server_seq=server_seq,
            )
        )
        db.flush()
        aceptados.append(cambio.change_id)
        estado.ultimo_client_sequence = max(estado.ultimo_client_sequence, cambio.client_sequence)

    estado.ultima_conexion_at = _ahora_servidor()
    db.commit()

    server_seq_actual = db.get(SecuenciaGlobal, 1)
    return PushResponse(
        aceptados=aceptados,
        duplicados=duplicados,
        rechazados=rechazados,
        server_seq=server_seq_actual.valor if server_seq_actual else 0,
    )


def pull(db: Session, device_id: str, desde: int, limite: int) -> PullResponse:
    eventos_filas = db.execute(
        select(Evento)
        .where(
            Evento.server_seq > desde,
            Evento.device_id != device_id,
            Evento.server_seq.is_not(None),
        )
        .order_by(Evento.server_seq)
        .limit(limite + 1)
    ).scalars().all()
    cambios_filas = db.execute(
        select(CambioRegistro)
        .where(
            CambioRegistro.server_seq > desde,
            CambioRegistro.device_id != device_id,
            CambioRegistro.server_seq.is_not(None),
        )
        .order_by(CambioRegistro.server_seq)
        .limit(limite + 1)
    ).scalars().all()

    combinados: list[tuple[int, str, object]] = [
        (e.server_seq, "evento", e) for e in eventos_filas
    ] + [(c.server_seq, "cambio", c) for c in cambios_filas]
    combinados.sort(key=lambda item: item[0])

    hay_mas = len(combinados) > limite
    pagina = combinados[:limite]

    eventos_out = []
    cambios_out = []
    for _, tipo, fila in pagina:
        if tipo == "evento":
            eventos_out.append(
                {
                    "event_id": fila.event_id,
                    "entity_type": fila.entity_type,
                    "entity_id": fila.entity_id,
                    "event_type": fila.event_type,
                    "occurred_at": fila.occurred_at,
                    "recorded_at": fila.recorded_at,
                    "device_id": fila.device_id,
                    "client_sequence": fila.client_sequence,
                    "base_version": fila.base_version,
                    "payload": fila.payload,
                    "server_seq": fila.server_seq,
                }
            )
        else:
            cambios_out.append(
                {
                    "change_id": fila.change_id,
                    "entity_type": fila.entity_type,
                    "entity_id": fila.entity_id,
                    "device_id": fila.device_id,
                    "client_sequence": fila.client_sequence,
                    "occurred_at": fila.occurred_at,
                    "base_version": fila.base_version,
                    "campos": fila.campos,
                    "campo_ts": fila.campo_ts,
                    "server_seq": fila.server_seq,
                }
            )

    # server_seq aquí es el punto de control de ESTA página (el mayor
    # server_seq efectivamente entregado), no el contador global del
    # servidor: si se devolviera el global, un cliente que pagina con un
    # límite menor al total pendiente saltaría directo al final y
    # perdería las páginas intermedias en su próximo `desde`.
    server_seq_pagina = max((seq for seq, _, _ in pagina), default=desde)
    return PullResponse(
        eventos=eventos_out,
        cambios=cambios_out,
        server_seq=server_seq_pagina,
        hay_mas=hay_mas,
    )


def status(db: Session, device_id: str) -> StatusResponse:
    server_seq_actual = db.get(SecuenciaGlobal, 1)
    estado = db.get(EstadoDispositivoSync, device_id)
    conflictos_abiertos = db.execute(
        select(Conflicto).where(Conflicto.resuelto.is_(False))
    ).scalars().all()
    return StatusResponse(
        server_seq=server_seq_actual.valor if server_seq_actual else 0,
        ultimo_client_sequence=estado.ultimo_client_sequence if estado else 0,
        conflictos_abiertos=len(conflictos_abiertos),
        ultima_conexion_at=estado.ultima_conexion_at if estado else None,
    )
