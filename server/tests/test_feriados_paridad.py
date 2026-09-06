"""Sección 7.1: la copia de feriados_cr.json en el cliente debe ser
byte a byte idéntica a la del servidor."""

import hashlib
import pathlib

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
ARCHIVO_SERVIDOR = REPO_ROOT / "server" / "data" / "feriados_cr.json"
ARCHIVO_CLIENTE = REPO_ROOT / "app" / "src" / "dominio" / "datos" / "feriados_cr.json"


def _sha256(ruta: pathlib.Path) -> str:
    return hashlib.sha256(ruta.read_bytes()).hexdigest()


def test_feriados_cr_identico_en_cliente_y_servidor():
    assert ARCHIVO_SERVIDOR.exists(), f"falta {ARCHIVO_SERVIDOR}"
    assert ARCHIVO_CLIENTE.exists(), f"falta {ARCHIVO_CLIENTE}"
    assert _sha256(ARCHIVO_SERVIDOR) == _sha256(ARCHIVO_CLIENTE)


def test_feriados_cr_marca_fuente_pendiente_de_validacion():
    import json

    datos = json.loads(ARCHIVO_SERVIDOR.read_text(encoding="utf-8"))
    assert datos["fuente"].startswith("PENDIENTE_VALIDACION_HUMANA")
