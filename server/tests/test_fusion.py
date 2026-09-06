from geo.sync.fusion import MetaCampo, fusionar_campo


def test_gana_la_marca_temporal_mayor():
    actual = MetaCampo(updated_at="2026-09-08T08:00:00-06:00", device_id="DISPOSITIVO-A")
    entrante = MetaCampo(updated_at="2026-09-08T09:00:00-06:00", device_id="DISPOSITIVO-B")
    resultado = fusionar_campo("prioridad", "media", actual, "critica", entrante)
    assert resultado.valor == "critica"
    assert resultado.meta.device_id == "DISPOSITIVO-B"


def test_empate_de_marca_temporal_se_resuelve_por_device_id():
    ts = "2026-09-08T09:20:00-06:00"
    actual = MetaCampo(updated_at=ts, device_id="DISPOSITIVO-A")
    entrante = MetaCampo(updated_at=ts, device_id="DISPOSITIVO-B")
    resultado = fusionar_campo("prioridad", "media", actual, "critica", entrante)
    # "DISPOSITIVO-B" > "DISPOSITIVO-A" lexicográficamente
    assert resultado.valor == "critica"
    assert resultado.meta.device_id == "DISPOSITIVO-B"


def test_es_simetrica_sin_importar_quien_evalua():
    ts_a = "2026-09-08T09:20:00-06:00"
    ts_b = "2026-09-08T09:20:00-06:00"
    meta_a = MetaCampo(updated_at=ts_a, device_id="DISPOSITIVO-A")
    meta_b = MetaCampo(updated_at=ts_b, device_id="DISPOSITIVO-B")

    resultado_desde_a = fusionar_campo("prioridad", "media", meta_a, "critica", meta_b)
    resultado_desde_b = fusionar_campo("prioridad", "critica", meta_b, "media", meta_a)
    assert resultado_desde_a.valor == resultado_desde_b.valor == "critica"


def test_campo_critico_con_valores_distintos_registra_conflicto():
    actual = MetaCampo(updated_at="2026-09-08T09:20:00-06:00", device_id="DISPOSITIVO-A")
    entrante = MetaCampo(updated_at="2026-09-08T08:00:00-06:00", device_id="DISPOSITIVO-B")
    resultado = fusionar_campo("prioridad", "media", actual, "critica", entrante)
    assert resultado.valor == "media"  # gana A por marca temporal mayor
    assert resultado.conflicto is not None
    assert resultado.conflicto.valor_ganador == "media"
    assert resultado.conflicto.valor_perdedor == "critica"
    assert resultado.conflicto.device_perdedor == "DISPOSITIVO-B"


def test_campo_no_critico_no_registra_conflicto_aunque_difiera():
    actual = MetaCampo(updated_at="2026-09-08T09:20:00-06:00", device_id="DISPOSITIVO-A")
    entrante = MetaCampo(updated_at="2026-09-08T08:00:00-06:00", device_id="DISPOSITIVO-B")
    resultado = fusionar_campo("contexto", "texto A", actual, "texto B", entrante)
    assert resultado.conflicto is None


def test_valores_iguales_no_generan_conflicto_aunque_el_campo_sea_critico():
    actual = MetaCampo(updated_at="2026-09-08T09:20:00-06:00", device_id="DISPOSITIVO-A")
    entrante = MetaCampo(updated_at="2026-09-08T08:00:00-06:00", device_id="DISPOSITIVO-B")
    resultado = fusionar_campo("prioridad", "media", actual, "media", entrante)
    assert resultado.conflicto is None


def test_duracion_estimada_min_distinto_campo_se_fusiona_independiente():
    # Valor de creación (más antiguo) contra la edición de B (más nueva):
    # cada campo se fusiona con su propia línea de tiempo, independiente
    # de lo que ocurra con el campo "prioridad" en el mismo evento.
    meta_creacion = MetaCampo(updated_at="2026-09-08T08:00:00-06:00", device_id="DISPOSITIVO-A")
    meta_edicion_b = MetaCampo(updated_at="2026-09-08T09:15:00-06:00", device_id="DISPOSITIVO-B")
    resultado = fusionar_campo("duracion_estimada_min", 90, meta_creacion, 120, meta_edicion_b)
    assert resultado.valor == 120
    assert resultado.conflicto is not None  # es campo crítico y los valores difieren
