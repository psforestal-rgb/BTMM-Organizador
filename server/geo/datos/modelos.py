"""Modelos SQLAlchemy. Ningún módulo de geo.dominio puede importar este
archivo (ADR 0005, prueba de dirección de dependencias). Las marcas de
tiempo se guardan como TEXT ISO 8601 — el dominio decide su formato, no
el motor de base de datos."""

from __future__ import annotations

from sqlalchemy import JSON, Boolean, Integer, String, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Evento(Base):
    """Append-only. La inmutabilidad la garantiza la migración
    0002_append_only_triggers, no este modelo."""

    __tablename__ = "evento"
    __table_args__ = (
        UniqueConstraint("device_id", "client_sequence", name="uq_evento_device_seq"),
    )

    event_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    entity_type: Mapped[str] = mapped_column(String(50))
    entity_id: Mapped[str] = mapped_column(String(36))
    event_type: Mapped[str] = mapped_column(String(50))
    occurred_at: Mapped[str] = mapped_column(String(35))
    recorded_at: Mapped[str] = mapped_column(String(35))
    device_id: Mapped[str] = mapped_column(String(64))
    client_sequence: Mapped[int] = mapped_column(Integer)
    base_version: Mapped[str | None] = mapped_column(String(36), nullable=True)
    payload: Mapped[dict] = mapped_column(JSON)
    server_seq: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)


class EntidadMutableMixin:
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    version_id: Mapped[str] = mapped_column(String(36))
    field_meta: Mapped[dict] = mapped_column(JSON, default=dict)
    eliminado: Mapped[bool] = mapped_column(Boolean, default=False)


class Captura(EntidadMutableMixin, Base):
    __tablename__ = "captura"
    texto: Mapped[str] = mapped_column(String(2000))
    estado: Mapped[str] = mapped_column(String(20), default="capturado")
    device_id: Mapped[str] = mapped_column(String(64))
    creado_en: Mapped[str] = mapped_column(String(35))


class Asignacion(EntidadMutableMixin, Base):
    __tablename__ = "asignacion"
    titulo: Mapped[str] = mapped_column(String(200))
    carril: Mapped[str] = mapped_column(String(20))
    duracion_estimada_min: Mapped[int] = mapped_column(Integer)
    vencimiento: Mapped[str | None] = mapped_column(String(10), nullable=True)
    prioridad: Mapped[int] = mapped_column(Integer, default=2)
    indivisible: Mapped[bool] = mapped_column(Boolean, default=False)
    dependencias: Mapped[list] = mapped_column(JSON, default=list)
    contexto: Mapped[str | None] = mapped_column(String(500), nullable=True)
    iniciativa_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    tramite_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    estado: Mapped[str] = mapped_column(String(20), default="programado")
    fecha_revision: Mapped[str | None] = mapped_column(String(10), nullable=True)
    fecha_pospuesto: Mapped[str | None] = mapped_column(String(10), nullable=True)
    motivo: Mapped[str | None] = mapped_column(String(500), nullable=True)


class Actividad(EntidadMutableMixin, Base):
    __tablename__ = "actividad"
    asignacion_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    carril: Mapped[str] = mapped_column(String(20))
    estado: Mapped[str] = mapped_column(String(20), default="en_curso")
    marcador_reanudacion: Mapped[str | None] = mapped_column(String(500), nullable=True)
    iniciada_en: Mapped[str] = mapped_column(String(35))
    finalizada_en: Mapped[str | None] = mapped_column(String(35), nullable=True)
    minutos_reales: Mapped[int | None] = mapped_column(Integer, nullable=True)


class Interrupcion(EntidadMutableMixin, Base):
    __tablename__ = "interrupcion"
    actividad_id: Mapped[str] = mapped_column(String(36))
    marcador_reanudacion: Mapped[str] = mapped_column(String(500))
    inicio: Mapped[str] = mapped_column(String(35))
    fin: Mapped[str | None] = mapped_column(String(35), nullable=True)


class TipoTramite(EntidadMutableMixin, Base):
    __tablename__ = "tipo_tramite"
    nombre: Mapped[str] = mapped_column(String(200))
    version: Mapped[int] = mapped_column(Integer, default=1)
    etapas: Mapped[list] = mapped_column(JSON, default=list)


class Tramite(EntidadMutableMixin, Base):
    __tablename__ = "tramite"
    tipo_tramite_id: Mapped[str] = mapped_column(String(36))
    tipo_tramite_version: Mapped[int] = mapped_column(Integer)
    titulo: Mapped[str] = mapped_column(String(200))
    etapa_actual_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    fecha_inicio: Mapped[str] = mapped_column(String(10))


class PasoTramite(EntidadMutableMixin, Base):
    __tablename__ = "paso_tramite"
    tramite_id: Mapped[str] = mapped_column(String(36))
    etapa_id: Mapped[str] = mapped_column(String(64))
    estado: Mapped[str] = mapped_column(String(20), default="pendiente")
    completado_en: Mapped[str | None] = mapped_column(String(35), nullable=True)


class Iniciativa(EntidadMutableMixin, Base):
    __tablename__ = "iniciativa"
    titulo: Mapped[str] = mapped_column(String(200))
    cuota_semanal_min: Mapped[int] = mapped_column(Integer, default=60)
    minutos_ejecutados_semana: Mapped[int] = mapped_column(Integer, default=0)
    deuda_min: Mapped[int] = mapped_column(Integer, default=0)
    semana_referencia: Mapped[str] = mapped_column(String(8))


class EventoFijo(EntidadMutableMixin, Base):
    __tablename__ = "evento_fijo"
    titulo: Mapped[str] = mapped_column(String(200))
    fecha: Mapped[str] = mapped_column(String(10))
    inicio: Mapped[str] = mapped_column(String(5))
    fin: Mapped[str] = mapped_column(String(5))
    tipo: Mapped[str] = mapped_column(String(20), default="reunion")


class BloqueAgenda(EntidadMutableMixin, Base):
    __tablename__ = "bloque_agenda"
    fecha: Mapped[str] = mapped_column(String(10))
    candidata_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    inicio: Mapped[str] = mapped_column(String(5))
    fin: Mapped[str] = mapped_column(String(5))
    justificacion_codigo: Mapped[str] = mapped_column(String(40))
    justificacion_texto: Mapped[str] = mapped_column(String(500))


class Seguimiento(EntidadMutableMixin, Base):
    __tablename__ = "seguimiento"
    entidad_tipo: Mapped[str] = mapped_column(String(50))
    entidad_id: Mapped[str] = mapped_column(String(36))
    fecha_revision: Mapped[str] = mapped_column(String(10))
    notas: Mapped[str | None] = mapped_column(String(1000), nullable=True)


class Conflicto(EntidadMutableMixin, Base):
    __tablename__ = "conflicto"
    entity_type: Mapped[str] = mapped_column(String(50))
    entity_id: Mapped[str] = mapped_column(String(36))
    campo: Mapped[str] = mapped_column(String(50))
    valor_ganador: Mapped[str] = mapped_column(JSON)
    device_ganador: Mapped[str] = mapped_column(String(64))
    ts_ganador: Mapped[str] = mapped_column(String(35))
    valor_perdedor: Mapped[str] = mapped_column(JSON)
    device_perdedor: Mapped[str] = mapped_column(String(64))
    ts_perdedor: Mapped[str] = mapped_column(String(35))
    resuelto: Mapped[bool] = mapped_column(Boolean, default=False)


class Dispositivo(EntidadMutableMixin, Base):
    __tablename__ = "dispositivo"
    nombre: Mapped[str] = mapped_column(String(100))


class Configuracion(EntidadMutableMixin, Base):
    __tablename__ = "configuracion"
    buffer_absorcion_min: Mapped[int] = mapped_column(Integer, default=75)
    dias_revision_espera: Mapped[int] = mapped_column(Integer, default=5)


class EstadoDispositivoSync(Base):
    """Bookkeeping de sincronización por dispositivo (sección 5.5). No es
    una entidad sincronizable: vive solo en el servidor."""

    __tablename__ = "estado_dispositivo_sync"

    device_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    ultimo_client_sequence: Mapped[int] = mapped_column(Integer, default=0)
    ultimo_server_seq_entregado: Mapped[int] = mapped_column(Integer, default=0)
    ultima_conexion_at: Mapped[str | None] = mapped_column(String(35), nullable=True)


ENTIDADES_MUTABLES: dict[str, type[Base]] = {
    "captura": Captura,
    "asignacion": Asignacion,
    "actividad": Actividad,
    "interrupcion": Interrupcion,
    "tipo_tramite": TipoTramite,
    "tramite": Tramite,
    "paso_tramite": PasoTramite,
    "iniciativa": Iniciativa,
    "evento_fijo": EventoFijo,
    "bloque_agenda": BloqueAgenda,
    "seguimiento": Seguimiento,
    "conflicto": Conflicto,
    "dispositivo": Dispositivo,
    "configuracion": Configuracion,
}
