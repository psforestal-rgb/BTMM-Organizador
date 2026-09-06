"""ADR 0002: la copia de fusion_casos.json usada por Vitest debe ser
byte a byte idéntica a la canónica en docs/fixtures/."""

import hashlib
import pathlib

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
ARCHIVO_CANONICO = REPO_ROOT / "docs" / "fixtures" / "fusion_casos.json"
ARCHIVO_CLIENTE = REPO_ROOT / "app" / "src" / "sync" / "fusion_casos.json"


def _sha256(ruta: pathlib.Path) -> str:
    return hashlib.sha256(ruta.read_bytes()).hexdigest()


def test_fusion_casos_identico_en_docs_y_en_cliente():
    assert ARCHIVO_CANONICO.exists(), f"falta {ARCHIVO_CANONICO}"
    assert ARCHIVO_CLIENTE.exists(), f"falta {ARCHIVO_CLIENTE}"
    assert _sha256(ARCHIVO_CANONICO) == _sha256(ARCHIVO_CLIENTE)
