"""CA-11 / invariante 3: reenviar el mismo lote no cambia el estado ni
produce error, solo duplicados."""

from sqlalchemy import func, select

from geo.datos.modelos import Evento
from geo.sync import servicio
from geo.sync.schemas import EventoIn, PushRequest


def _lote():
    return PushRequest(
        device_id="DISPOSITIVO-A",
        eventos=[
            EventoIn(
                event_id="11111111-1111-4111-8111-111111111111",
                entity_type="asignacion",
                entity_id="22222222-2222-4222-8222-222222222222",
                event_type="asignacion_creada",
                occurred_at="2026-09-08T08:00:00-06:00",
                recorded_at="2026-09-08T08:00:00-06:00",
                device_id="DISPOSITIVO-A",
                client_sequence=1,
                payload={
                    "titulo": "Informe técnico CASO-2026-001",
                    "carril": "planificado",
                    "duracion_estimada_min": 90,
                    "prioridad": 3,
                    "estado": "programado",
                },
            )
        ],
    )


def test_reenviar_el_mismo_lote_devuelve_duplicados_sin_cambiar_estado(db_session):
    primera = servicio.push(db_session, _lote())
    assert primera.aceptados == ["11111111-1111-4111-8111-111111111111"]
    assert primera.duplicados == []

    segunda = servicio.push(db_session, _lote())
    assert segunda.aceptados == []
    assert segunda.duplicados == ["11111111-1111-4111-8111-111111111111"]
    assert segunda.server_seq == primera.server_seq  # no se incrementó el contador global

    conteo_eventos = db_session.execute(select(func.count()).select_from(Evento)).scalar_one()
    assert conteo_eventos == 1
