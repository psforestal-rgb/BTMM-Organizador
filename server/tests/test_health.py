from fastapi.testclient import TestClient

from geo.api.main import app

client = TestClient(app)


def test_health_responde_ok():
    respuesta = client.get("/health")
    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["estado"] == "ok"
    assert "version" in cuerpo
