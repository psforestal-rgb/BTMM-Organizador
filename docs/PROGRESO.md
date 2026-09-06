# Progreso — GEO v0.1.0-alpha

**Fase cerrada**: 1 (núcleo de datos).

**Último commit**: (ver `git log --oneline -1` tras el commit de esta fase)

**Próximo paso**: Fase 2 — motores puros (calendario de días hábiles,
estados/espera, planificador greedy con buffer y justificaciones, radar
de 7 reglas, cuotas de iniciativa) en `app/src/dominio` con Vitest.

**Nota de sintaxis TS**: `tsconfig.app.json` tiene `erasableSyntaxOnly`;
no usar parameter properties (`constructor(private x)`) ni `enum` en
ningún archivo de `app/src` — usar asignación explícita en el
constructor y uniones de tipo string.

**Comandos de verificación**:
```
cd app && npm run typecheck && npm run lint && npm test -- --run && npm run build
cd server && ./.venv/bin/python -m pytest -q --cov=geo --cov-report=term-missing
```
