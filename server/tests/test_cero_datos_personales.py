"""Invariante 8: cero datos personales reales en todo el repositorio."""

import pathlib
import re

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent.parent

DIRECTORIOS_EXCLUIDOS = {
    "node_modules", ".git", ".venv", "dist", "dev-dist", "coverage",
    "playwright-report", "test-results", "__pycache__", ".pytest_cache",
    ".ruff_cache", "htmlcov",
}
EXTENSIONES_TEXTO = {
    ".py", ".ts", ".tsx", ".js", ".json", ".md", ".yml", ".yaml", ".css", ".html",
}
ARCHIVOS_EXCLUIDOS = {"package-lock.json"}

UUID_PATTERN = re.compile(
    r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b"
)

PATRONES_PROHIBIDOS = {
    "cedula_cr": re.compile(r"\b\d{1,2}-\d{4}-\d{4}\b"),
    "telefono_cr": re.compile(r"\b[2678]\d{3}-\d{4}\b"),
    "correo": re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b"),
}

# El propio nombre de dominio del proyecto o de Anthropic no son datos
# personales; se permiten explícitamente en trailers de commit, no en el
# árbol de trabajo, así que esta lista queda vacía a propósito.
EXCEPCIONES_LITERALES: set[str] = set()


def _archivos_a_revisar():
    for ruta in REPO_ROOT.rglob("*"):
        if not ruta.is_file():
            continue
        if any(parte in DIRECTORIOS_EXCLUIDOS for parte in ruta.parts):
            continue
        if ruta.suffix not in EXTENSIONES_TEXTO:
            continue
        if ruta.name in ARCHIVOS_EXCLUIDOS:
            continue
        yield ruta


def test_repositorio_sin_datos_personales_reales():
    violaciones = []
    for archivo in _archivos_a_revisar():
        try:
            contenido = archivo.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        # Los UUID (usados como identificadores opacos en toda la
        # especificación) contienen tramos numéricos con guiones que de
        # otro modo coincidirían con los patrones de cédula/teléfono.
        contenido = UUID_PATTERN.sub("00000000-0000-0000-0000-000000000000", contenido)
        for nombre_patron, patron in PATRONES_PROHIBIDOS.items():
            for coincidencia in patron.finditer(contenido):
                texto = coincidencia.group(0)
                if texto in EXCEPCIONES_LITERALES:
                    continue
                violaciones.append(f"{archivo}: patrón '{nombre_patron}' -> {texto}")
    assert not violaciones, "\n".join(violaciones)
