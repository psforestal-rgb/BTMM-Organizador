"""CA-07: crear un tipo de trámite y completar una etapa deben
materializar sus entidades en el servidor igual que cualquier otra
creación, aunque sus event_type no terminen en el sufijo "_creada"
original (tipo_tramite_creado/tramite_creado son masculinos, y
paso_completado no tiene un "_creado" separado — ver
_indica_creacion_de_entidad en geo/sync/servicio.py)."""

from geo.datos.modelos import PasoTramite, TipoTramite
from geo.sync import servicio
from geo.sync.schemas import EventoIn, PushRequest

TIPO_ID = "55555555-5555-4555-8555-555555555555"
TRAMITE_ID = "66666666-6666-4666-8666-666666666666"


def test_tipo_tramite_creado_materializa_la_entidad(db_session):
    servicio.push(
        db_session,
        PushRequest(
            device_id="DISPOSITIVO-A",
            eventos=[
                EventoIn(
                    event_id="77777777-7777-4777-8777-777777777777",
                    entity_type="tipo_tramite",
                    entity_id=TIPO_ID,
                    event_type="tipo_tramite_creado",
                    occurred_at="2026-09-08T08:00:00-06:00",
                    recorded_at="2026-09-08T08:00:00-06:00",
                    device_id="DISPOSITIVO-A",
                    client_sequence=1,
                    payload={
                        "nombre": "Permiso de construcción",
                        "version": 1,
                        "etapas": [
                            {
                                "id": "e1",
                                "nombre": "Recepción",
                                "orden": 1,
                                "condiciones": [],
                                "dependencias": [],
                                "plazo_dias_habiles": 2,
                                "producto": "acuse",
                            }
                        ],
                    },
                )
            ],
        ),
    )

    tipo = db_session.get(TipoTramite, TIPO_ID)
    assert tipo is not None
    assert tipo.nombre == "Permiso de construcción"
    assert tipo.etapas[0]["id"] == "e1"


def test_paso_completado_materializa_el_paso_tramite(db_session):
    servicio.push(
        db_session,
        PushRequest(
            device_id="DISPOSITIVO-A",
            eventos=[
                EventoIn(
                    event_id="88888888-8888-4888-8888-888888888888",
                    entity_type="paso_tramite",
                    entity_id="99999999-9999-4999-8999-999999999999",
                    event_type="paso_completado",
                    occurred_at="2026-09-08T08:00:00-06:00",
                    recorded_at="2026-09-08T08:00:00-06:00",
                    device_id="DISPOSITIVO-A",
                    client_sequence=1,
                    payload={
                        "tramite_id": TRAMITE_ID,
                        "etapa_id": "e1",
                        "estado": "completado",
                        "completado_en": "2026-09-08T08:00:00-06:00",
                    },
                )
            ],
        ),
    )

    paso = db_session.get(PasoTramite, "99999999-9999-4999-8999-999999999999")
    assert paso is not None
    assert paso.tramite_id == TRAMITE_ID
    assert paso.estado == "completado"


def test_reenvio_del_mismo_evento_no_duplica_el_paso(db_session):
    evento = EventoIn(
        event_id="88888888-8888-4888-8888-888888888888",
        entity_type="paso_tramite",
        entity_id="99999999-9999-4999-8999-999999999999",
        event_type="paso_completado",
        occurred_at="2026-09-08T08:00:00-06:00",
        recorded_at="2026-09-08T08:00:00-06:00",
        device_id="DISPOSITIVO-A",
        client_sequence=1,
        payload={
            "tramite_id": TRAMITE_ID,
            "etapa_id": "e1",
            "estado": "completado",
            "completado_en": "2026-09-08T08:00:00-06:00",
        },
    )
    servicio.push(db_session, PushRequest(device_id="DISPOSITIVO-A", eventos=[evento]))
    resultado = servicio.push(db_session, PushRequest(device_id="DISPOSITIVO-A", eventos=[evento]))

    assert resultado.duplicados == ["88888888-8888-4888-8888-888888888888"]
