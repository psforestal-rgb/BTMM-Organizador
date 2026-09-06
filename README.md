# BTMM-Organizador — GEO

**GEO** (Sistema Personal de Gestión Operativa, Planificación Adaptativa y
Memoria Externa) es una PWA offline-first para un funcionario con trabajo
de campo, conectividad intermitente y alta tasa de interrupciones. Este
repositorio, `BTMM-Organizador`, contiene su implementación.

**Estado: prototipo alfa (v0.1.0-alpha).** No usar con datos personales
reales. Ver `docs/PENDIENTES_HUMANO.md` para lo que falta validar antes
de cualquier uso productivo, y `docs/CONCEPTO.md` para el concepto
funcional completo.

## Qué demuestra este prototipo

1. Ningún compromiso desaparece: toda salida de una vista exige una
   decisión registrada como evento (bitácora append-only).
2. La jornada disponible no es la jornada programable: el planificador
   reserva una capacidad de absorción real para lo imprevisto.
3. Dos dispositivos desconectados convergen sin perder evidencia:
   sincronización con fusión por campo y conflictos visibles.

Ver el escenario de prueba que ejercita las tres cosas a la vez en
`app/e2e/escenario-canonico.spec.ts`.

## Arranque rápido — cliente

```bash
cd app
npm install
npm run dev          # http://localhost:5173
```

Verificación completa:

```bash
cd app
npm run typecheck && npm run lint && npm test -- --run && npm run build
npx playwright test  # requiere `npx playwright install chromium` la primera vez
```

## Arranque rápido — servidor

```bash
cd server
python3.12 -m venv .venv
./.venv/bin/pip install -r requirements-dev.txt
./.venv/bin/uvicorn geo.api.main:app --reload   # http://localhost:8000/health
```

Verificación completa:

```bash
cd server
./.venv/bin/ruff check geo tests
./.venv/bin/python -m pytest -q --cov=geo --cov-report=term-missing
```

## Estructura

Ver `CLAUDE.md` para el mapa completo del repositorio, el stack fijo y
los ocho invariantes no negociables del sistema.

## Documentación

- `docs/CONCEPTO.md` — especificación funcional
- `docs/PLAN.md` — plan de fases
- `docs/PROGRESO.md` — estado actual (se reescribe en cada cierre de fase)
- `docs/INFORME_FINAL.md` — evidencia de los doce criterios de aceptación
- `docs/PENDIENTES_HUMANO.md` — lo que requiere validación de una persona
- `docs/adr/` — decisiones arquitectónicas
- `docs/requisitos/CA-01.md` … `CA-12.md` — criterios de aceptación
