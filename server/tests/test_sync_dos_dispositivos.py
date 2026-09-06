"""CA-11: dos dispositivos independientes crean y modifican datos
distintos sin conexión y convergen al sincronizar, con fusión por campo
determinista y exactamente un conflicto sobre el campo crítico
disputado. Reproduce la mecánica central del escenario canónico
(sección 13) a nivel de servicio de sincronización."""

from sqlalchemy import select

from geo.datos.modelos import Asignacion, Conflicto
from geo.sync import servicio
from geo.sync.schemas import CambioIn, EventoIn, PushRequest

INFORME_ID = "22222222-2222-4222-8222-222222222222"


def _crear_informe_en_a(db_session):
    servicio.push(
        db_session,
        PushRequest(
            device_id="DISPOSITIVO-A",
            eventos=[
                EventoIn(
                    event_id="11111111-1111-4111-8111-111111111111",
                    entity_type="asignacion",
                    entity_id=INFORME_ID,
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
                        "indivisible": False,
                        "dependencias": [],
                    },
                )
            ],
        ),
    )


def test_dos_dispositivos_convergen_con_un_conflicto_en_prioridad(db_session):
    # 08:00 — A crea el informe y lo sincroniza de inmediato (equivalente
    # a "A las 08:05, A sincroniza; B sincroniza y ve la asignación").
    _crear_informe_en_a(db_session)

    # B (otro dispositivo, mismo servidor en esta prueba de servicio)
    # queda desconectado y, sin ver el cambio del otro, edita dos campos.
    resultado_b = servicio.push(
        db_session,
        PushRequest(
            device_id="DISPOSITIVO-B",
            cambios=[
                CambioIn(
                    change_id="33333333-3333-4333-8333-333333333333",
                    entity_type="asignacion",
                    entity_id=INFORME_ID,
                    device_id="DISPOSITIVO-B",
                    client_sequence=1,
                    occurred_at="2026-09-08T09:15:00-06:00",
                    campos={"prioridad": "critica", "duracion_estimada_min": 120},
                    campo_ts={
                        "prioridad": "2026-09-08T09:15:00-06:00",
                        "duracion_estimada_min": "2026-09-08T09:15:00-06:00",
                    },
                )
            ],
        ),
    )
    assert resultado_b.aceptados == ["33333333-3333-4333-8333-333333333333"]

    # A, también desconectado, edita solo prioridad, más tarde que B.
    resultado_a = servicio.push(
        db_session,
        PushRequest(
            device_id="DISPOSITIVO-A",
            cambios=[
                CambioIn(
                    change_id="44444444-4444-4444-8444-444444444444",
                    entity_type="asignacion",
                    entity_id=INFORME_ID,
                    device_id="DISPOSITIVO-A",
                    client_sequence=2,
                    occurred_at="2026-09-08T09:20:00-06:00",
                    campos={"prioridad": "media"},
                    campo_ts={"prioridad": "2026-09-08T09:20:00-06:00"},
                )
            ],
        ),
    )
    assert resultado_a.aceptados == ["44444444-4444-4444-8444-444444444444"]

    informe = db_session.get(Asignacion, INFORME_ID)
    # Gana "media" (A, 09:20) sobre "critica" (B, 09:15) por marca temporal mayor.
    assert informe.prioridad == "media"
    # duracion_estimada_min es un campo distinto, solo B lo tocó: se aplica
    # directo, sin competencia y sin conflicto.
    assert informe.duracion_estimada_min == 120

    conflictos = db_session.execute(select(Conflicto)).scalars().all()
    assert len(conflictos) == 1
    conflicto = conflictos[0]
    assert conflicto.campo == "prioridad"
    assert conflicto.valor_ganador == "media"
    assert conflicto.valor_perdedor == "critica"
    assert conflicto.device_perdedor == "DISPOSITIVO-B"
    assert conflicto.resuelto is False


def test_el_orden_de_llegada_no_cambia_el_resultado_final(db_session):
    """La misma fusión, pero con el cambio de A llegando primero: el
    estado final y el conflicto deben ser idénticos (ADR 0002)."""
    _crear_informe_en_a(db_session)

    servicio.push(
        db_session,
        PushRequest(
            device_id="DISPOSITIVO-A",
            cambios=[
                CambioIn(
                    change_id="a-primero",
                    entity_type="asignacion",
                    entity_id=INFORME_ID,
                    device_id="DISPOSITIVO-A",
                    client_sequence=2,
                    occurred_at="2026-09-08T09:20:00-06:00",
                    campos={"prioridad": "media"},
                    campo_ts={"prioridad": "2026-09-08T09:20:00-06:00"},
                )
            ],
        ),
    )
    servicio.push(
        db_session,
        PushRequest(
            device_id="DISPOSITIVO-B",
            cambios=[
                CambioIn(
                    change_id="b-segundo",
                    entity_type="asignacion",
                    entity_id=INFORME_ID,
                    device_id="DISPOSITIVO-B",
                    client_sequence=1,
                    occurred_at="2026-09-08T09:15:00-06:00",
                    campos={"prioridad": "critica"},
                    campo_ts={"prioridad": "2026-09-08T09:15:00-06:00"},
                )
            ],
        ),
    )

    informe = db_session.get(Asignacion, INFORME_ID)
    assert informe.prioridad == "media"
    conflictos = db_session.execute(select(Conflicto)).scalars().all()
    assert len(conflictos) == 1
    assert conflictos[0].valor_ganador == "media"
    assert conflictos[0].valor_perdedor == "critica"
