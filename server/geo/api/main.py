import csv
import io

from fastapi import Depends, FastAPI, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from geo.datos.db import get_db
from geo.datos.modelos import Conflicto, Evento
from geo.sync import servicio
from geo.sync.schemas import (
    ConflictoOut,
    PullResponse,
    PushRequest,
    PushResponse,
    StatusResponse,
)

APP_VERSION = "0.1.0-alpha"

app = FastAPI(title="GEO API", version=APP_VERSION)


@app.get("/health")
def health() -> dict[str, str]:
    return {"estado": "ok", "version": APP_VERSION}


@app.post("/sync/push", response_model=PushResponse)
def sync_push(request: PushRequest, db: Session = Depends(get_db)) -> PushResponse:
    return servicio.push(db, request)


@app.get("/sync/pull", response_model=PullResponse)
def sync_pull(
    device_id: str,
    desde: int = 0,
    limite: int = Query(default=200, le=1000, gt=0),
    db: Session = Depends(get_db),
) -> PullResponse:
    return servicio.pull(db, device_id, desde, limite)


@app.get("/sync/status", response_model=StatusResponse)
def sync_status(device_id: str, db: Session = Depends(get_db)) -> StatusResponse:
    return servicio.status(db, device_id)


@app.get("/sync/conflictos", response_model=list[ConflictoOut])
def sync_conflictos(db: Session = Depends(get_db)) -> list[Conflicto]:
    return list(db.execute(select(Conflicto).where(Conflicto.resuelto.is_(False))).scalars().all())


@app.get("/export/bitacora")
def export_bitacora(
    formato: str = Query(default="json", pattern="^(json|csv)$"),
    desde: str | None = None,
    hasta: str | None = None,
    db: Session = Depends(get_db),
):
    consulta = select(Evento).order_by(Evento.occurred_at)
    if desde:
        consulta = consulta.where(Evento.occurred_at >= desde)
    if hasta:
        consulta = consulta.where(Evento.occurred_at <= hasta)
    eventos = db.execute(consulta).scalars().all()

    filas = [
        {
            "event_id": e.event_id,
            "entity_type": e.entity_type,
            "entity_id": e.entity_id,
            "event_type": e.event_type,
            "occurred_at": e.occurred_at,
            "recorded_at": e.recorded_at,
            "device_id": e.device_id,
        }
        for e in eventos
    ]

    if formato == "json":
        return filas

    buffer = io.StringIO()
    columnas = [
        "event_id", "entity_type", "entity_id", "event_type",
        "occurred_at", "recorded_at", "device_id",
    ]
    escritor = csv.DictWriter(buffer, fieldnames=columnas)
    escritor.writeheader()
    escritor.writerows(filas)
    return PlainTextResponse(content=buffer.getvalue(), media_type="text/csv")
