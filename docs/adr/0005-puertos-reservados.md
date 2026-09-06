# 0005 — Puertos reservados para IA, clima y datos protegidos

## Contexto

El sistema anticipa integraciones futuras (clasificación por IA,
pronóstico del tiempo para campo, tokenización de datos protegidos) que
no deben incrustarse en el dominio desde el día uno.

## Decisión

Se definen las interfaces `Reloj`, `AIProvider`, `WeatherProvider`,
`ProtectedDataProvider` y `SyncAdapter` en `app/src/puertos` desde la
Fase 0, con implementaciones nulas (`disponible() -> false`) para todas
salvo `Reloj` y `SyncAdapterRest`. El planificador v0.1 no importa
`WeatherProvider` en absoluto. Una prueba de dirección de dependencias
verifica que `dominio/` no importa ninguna implementación concreta.

## Consecuencias

Costo de indirección hoy (una interfaz sin usuario real) a cambio de que
integrar IA o clima en el futuro no toque el dominio ya probado.

## Alternativas descartadas

Añadir las integraciones cuando existan: descartado porque la experiencia
previa (ver contexto del prompt) muestra que sin el puerto reservado la
integración termina incrustada en el dominio y se vuelve cara de
desacoplar.
