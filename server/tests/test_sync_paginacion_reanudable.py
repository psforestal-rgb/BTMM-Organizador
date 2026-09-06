"""CA-11: paginación de /sync/pull sin huecos ni duplicados, y reanudable
desde el último server_seq recibido."""

from geo.sync import servicio
from geo.sync.schemas import EventoIn, PushRequest


def _empujar_n_eventos(db_session, n: int) -> None:
    eventos = [
        EventoIn(
            event_id=f"eeeeeeee-0000-4000-8000-{i:012d}",
            entity_type="captura",
            entity_id=f"cccccccc-0000-4000-8000-{i:012d}",
            event_type="captura_creada",
            occurred_at="2026-09-08T08:00:00-06:00",
            recorded_at="2026-09-08T08:00:00-06:00",
            device_id="DISPOSITIVO-A",
            client_sequence=i + 1,
            payload={
                "texto": f"captura {i}",
                "estado": "capturado",
                "device_id": "DISPOSITIVO-A",
                "creado_en": "2026-09-08T08:00:00-06:00",
            },
        )
        for i in range(n)
    ]
    servicio.push(db_session, PushRequest(device_id="DISPOSITIVO-A", eventos=eventos))


def test_pull_paginado_reanuda_sin_huecos_ni_duplicados(db_session):
    _empujar_n_eventos(db_session, 25)

    vistos: list[str] = []
    desde = 0
    paginas = 0
    while True:
        pagina = servicio.pull(db_session, "DISPOSITIVO-B", desde, limite=7)
        paginas += 1
        vistos.extend(e.event_id for e in pagina.eventos)
        if not pagina.hay_mas:
            break
        desde = pagina.server_seq  # el cliente real usa este campo, no los items
        assert paginas < 20  # cota de seguridad contra bucles infinitos

    assert len(vistos) == 25
    assert len(set(vistos)) == 25  # sin duplicados
    assert paginas == 4  # ceil(25/7)


def test_pull_interrumpido_a_mitad_de_pagina_no_pierde_ni_duplica(db_session):
    """Simula un corte tras la primera página: la siguiente sincronización
    reanuda desde el último server_seq recibido, sin huecos ni duplicados."""
    _empujar_n_eventos(db_session, 12)

    primera_pagina = servicio.pull(db_session, "DISPOSITIVO-B", 0, limite=5)
    assert len(primera_pagina.eventos) == 5
    assert primera_pagina.hay_mas is True

    # "Corte de red": el cliente se queda solo con lo ya confirmado de la
    # primera página y reintenta desde ahí.
    ultimo_confirmado = primera_pagina.server_seq

    resto: list[str] = [e.event_id for e in primera_pagina.eventos]
    desde = ultimo_confirmado
    while True:
        pagina = servicio.pull(db_session, "DISPOSITIVO-B", desde, limite=5)
        resto.extend(e.event_id for e in pagina.eventos)
        if not pagina.hay_mas:
            break
        desde = pagina.server_seq

    assert len(resto) == 12
    assert len(set(resto)) == 12


def test_server_seq_de_la_pagina_no_es_el_contador_global(db_session):
    """Regresión: server_seq en la respuesta de /sync/pull debe ser el
    mayor server_seq efectivamente entregado en ESA página, nunca el
    contador global del servidor — de lo contrario un cliente que pagina
    con un límite menor al total salta directo al final y pierde las
    páginas intermedias en su siguiente `desde`."""
    _empujar_n_eventos(db_session, 205)  # supera el límite real de 200 del cliente

    primera_pagina = servicio.pull(db_session, "DISPOSITIVO-B", 0, limite=200)
    assert len(primera_pagina.eventos) == 200
    assert primera_pagina.hay_mas is True
    assert primera_pagina.server_seq == 200  # no 205 (el contador global)

    segunda_pagina = servicio.pull(
        db_session, "DISPOSITIVO-B", primera_pagina.server_seq, limite=200
    )
    assert len(segunda_pagina.eventos) == 5
    assert segunda_pagina.hay_mas is False
