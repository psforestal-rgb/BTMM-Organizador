# Progreso — GEO v0.1.0-alpha

**Fase cerrada**: 2 (motores puros).

**Último commit**: (ver `git log --oneline -1` tras el commit de esta fase)

**Próximo paso**: Fase 3 — sincronización real (endpoints push/pull/status
en el servidor, fusión por campo en `server/geo/sync/fusion.py` y su
espejo en `app/src/sync/fusion.ts`, cola/outbox y reintentos en el
cliente, prueba de dos dispositivos).

**Motores puros ya implementados** en `app/src/dominio/`: `calendario.ts`
(días hábiles CR), `tiempo.ts` (huecos de agenda), `marcaTemporal.ts`
(aritmética ISO 8601 sin `Date`), `estados.ts` (transiciones + decisión de
cierre sin descarte silencioso), `planificador.ts` (greedy determinista,
buffer de absorción, fragmentación, cuotas de iniciativa),
`replanificacion.ts` (interrupciones), `radar.ts` (7 reglas). Nota:
CA-09 (cuotas) quedó resuelto dentro de `planificador.ts`, sin un archivo
`iniciativas.ts` separado — ajustar la referencia en
`docs/requisitos/CA-09.md` al escribir `INFORME_FINAL.md`.

**Comandos de verificación**:
```
cd app && npm run typecheck && npm run lint && npm test -- --run && npm run build
cd server && ./.venv/bin/python -m pytest -q --cov=geo --cov-report=term-missing
```
