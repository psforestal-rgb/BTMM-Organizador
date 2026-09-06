"""CA-03 / invariante 1: un evento nunca se modifica ni se borra."""

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from geo.datos.modelos import Evento


def _crear_evento(session: Session) -> None:
    session.add(
        Evento(
            event_id="11111111-1111-4111-8111-111111111111",
            entity_type="asignacion",
            entity_id="22222222-2222-4222-8222-222222222222",
            event_type="asignacion_creada",
            occurred_at="2026-09-08T08:00:00-06:00",
            recorded_at="2026-09-08T08:00:00-06:00",
            device_id="DISPOSITIVO-A",
            client_sequence=1,
            base_version=None,
            payload={"titulo": "CASO-2026-001"},
            server_seq=None,
        )
    )
    session.commit()


def test_update_sobre_evento_es_rechazado(db_session: Session):
    _crear_evento(db_session)

    with pytest.raises(IntegrityError, match="append-only"):
        db_session.execute(
            Evento.__table__.update()
            .where(Evento.event_id == "11111111-1111-4111-8111-111111111111")
            .values(payload={"titulo": "manipulado"})
        )
        db_session.commit()
    db_session.rollback()


def test_delete_sobre_evento_es_rechazado(db_session: Session):
    _crear_evento(db_session)

    with pytest.raises(IntegrityError, match="append-only"):
        db_session.execute(
            Evento.__table__.delete().where(
                Evento.event_id == "11111111-1111-4111-8111-111111111111"
            )
        )
        db_session.commit()
    db_session.rollback()
