"""Prueba de integración cliente-servidor: los cuatro extremos de
sincronización más exportación, a través de HTTP real (FastAPI
TestClient), no llamando a geo.sync.servicio directamente."""


def test_health(cliente_http):
    respuesta = cliente_http.get("/health")
    assert respuesta.status_code == 200


def test_push_pull_status_export_a_traves_de_http(cliente_http):
    lote = {
        "device_id": "DISPOSITIVO-A",
        "eventos": [
            {
                "event_id": "11111111-1111-4111-8111-111111111111",
                "entity_type": "captura",
                "entity_id": "22222222-2222-4222-8222-222222222222",
                "event_type": "captura_creada",
                "occurred_at": "2026-09-08T08:00:00-06:00",
                "recorded_at": "2026-09-08T08:00:00-06:00",
                "device_id": "DISPOSITIVO-A",
                "client_sequence": 1,
                "payload": {
                    "texto": "captura de prueba",
                    "estado": "capturado",
                    "device_id": "DISPOSITIVO-A",
                    "creado_en": "2026-09-08T08:00:00-06:00",
                },
            }
        ],
        "cambios": [],
    }

    respuesta_push = cliente_http.post("/sync/push", json=lote)
    assert respuesta_push.status_code == 200
    cuerpo_push = respuesta_push.json()
    assert cuerpo_push["aceptados"] == ["11111111-1111-4111-8111-111111111111"]
    assert cuerpo_push["rechazados"] == []

    # Reenviar el mismo lote: 200, sin error, clasificado como duplicado.
    respuesta_repetida = cliente_http.post("/sync/push", json=lote)
    assert respuesta_repetida.status_code == 200
    assert respuesta_repetida.json()["duplicados"] == ["11111111-1111-4111-8111-111111111111"]

    respuesta_pull = cliente_http.get(
        "/sync/pull", params={"device_id": "DISPOSITIVO-B", "desde": 0}
    )
    assert respuesta_pull.status_code == 200
    cuerpo_pull = respuesta_pull.json()
    assert len(cuerpo_pull["eventos"]) == 1
    assert cuerpo_pull["eventos"][0]["event_id"] == "11111111-1111-4111-8111-111111111111"
    assert cuerpo_pull["hay_mas"] is False

    # DISPOSITIVO-A no debe ver su propio evento reflejado en su propio pull.
    respuesta_pull_propio = cliente_http.get(
        "/sync/pull", params={"device_id": "DISPOSITIVO-A", "desde": 0}
    )
    assert respuesta_pull_propio.json()["eventos"] == []

    respuesta_status = cliente_http.get("/sync/status", params={"device_id": "DISPOSITIVO-A"})
    assert respuesta_status.status_code == 200
    assert respuesta_status.json()["ultimo_client_sequence"] == 1

    respuesta_export = cliente_http.get("/export/bitacora", params={"formato": "json"})
    assert respuesta_export.status_code == 200
    assert len(respuesta_export.json()) == 1

    respuesta_export_csv = cliente_http.get("/export/bitacora", params={"formato": "csv"})
    assert respuesta_export_csv.status_code == 200
    assert "captura_creada" in respuesta_export_csv.text
