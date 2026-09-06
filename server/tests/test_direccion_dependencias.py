"""Invariante 5/ADR 0005: geo.dominio no importa geo.datos ni geo.api, y
no llama a datetime.now()/date.today()."""

import ast
import pathlib

SERVER_ROOT = pathlib.Path(__file__).resolve().parent.parent
DOMINIO_DIR = SERVER_ROOT / "geo" / "dominio"

PROHIBIDOS = {"geo.datos", "geo.api", "sqlalchemy", "sqlite3", "fastapi"}


def _archivos_python():
    return sorted(DOMINIO_DIR.rglob("*.py"))


def test_dominio_no_importa_infraestructura():
    violaciones = []
    for archivo in _archivos_python():
        arbol = ast.parse(archivo.read_text(encoding="utf-8"), filename=str(archivo))
        for nodo in ast.walk(arbol):
            modulos = []
            if isinstance(nodo, ast.Import):
                modulos = [alias.name for alias in nodo.names]
            elif isinstance(nodo, ast.ImportFrom) and nodo.module:
                modulos = [nodo.module]
            for modulo in modulos:
                if any(modulo == p or modulo.startswith(p + ".") for p in PROHIBIDOS):
                    violaciones.append(f"{archivo}: import prohibido de '{modulo}'")
    assert not violaciones, "\n".join(violaciones)


def test_dominio_no_llama_reloj_de_sistema():
    violaciones = []
    for archivo in _archivos_python():
        codigo = archivo.read_text(encoding="utf-8")
        arbol = ast.parse(codigo, filename=str(archivo))
        for nodo in ast.walk(arbol):
            if isinstance(nodo, ast.Call):
                objetivo = nodo.func
                nombre = None
                if isinstance(objetivo, ast.Attribute):
                    nombre = objetivo.attr
                elif isinstance(objetivo, ast.Name):
                    nombre = objetivo.id
                if nombre in {"now", "today", "utcnow"}:
                    violaciones.append(f"{archivo}:{nodo.lineno}: llamada prohibida a {nombre}()")
    assert not violaciones, "\n".join(violaciones)
