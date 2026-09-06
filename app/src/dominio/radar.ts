// Radar anti-olvido (sección 7.5). Siete reglas puras, todas basadas
// exclusivamente en datos ya registrados: (snapshot, config, ahora) ->
// Hallazgo[]. `ahora` es la marca ISO ya resuelta por el puerto Reloj.

import configRadarJson from '../config/radar.json'
import { diasHabilesEntre } from './calendario'
import { diferenciaEnDias, diferenciaEnHoras } from './marcaTemporal'
import type { EstadoElemento } from './tipos'

export type SeveridadHallazgo = 'info' | 'atencion' | 'critico'

export interface Hallazgo {
  regla: string
  entidad_tipo: string
  entidad_id: string
  titulo: string
  severidad: SeveridadHallazgo
  explicacion: string
  evidencia: Array<{ campo: string; valor: unknown }>
  acciones_sugeridas: string[]
}

export interface ElementoAbierto {
  id: string
  tipo: 'asignacion' | 'tramite'
  titulo: string
  estado: EstadoElemento
  fechaRevision: string | null // YYYY-MM-DD, solo relevante si estado === 'esperando'
  ultimoEventoAt: string | null // ISO
  minutosPendientesTotales: number
  vencimiento: string | null // YYYY-MM-DD
}

export interface CapturaSnapshot {
  id: string
  texto: string
  estado: 'capturado' | 'procesado'
  creadoEn: string // ISO
}

export interface ActividadSnapshot {
  id: string
  titulo: string
  estado: 'en_curso' | 'interrumpida' | 'finalizada'
  iniciadaEn: string // ISO
}

export interface IniciativaSnapshot {
  id: string
  titulo: string
  cuotaSemanalMin: number
  minutosEjecutadosSemana: number
  deudaMin: number
}

export interface ReprogramacionRegistrada {
  entidadId: string
  ocurridoEn: string // ISO
}

export interface RadarSnapshot {
  elementosAbiertos: ElementoAbierto[]
  capturas: CapturaSnapshot[]
  actividades: ActividadSnapshot[]
  iniciativas: IniciativaSnapshot[]
  reprogramaciones: ReprogramacionRegistrada[]
}

export interface RadarConfig {
  sinMovimientoDias: number
  actividadSinCierreHoras: number
  capturaSinProcesarHoras: number
  pospuestoReiteradoMinEventos: number
  pospuestoReiteradoVentanaDias: number
  iniciativaSinAvanceDeudaUmbralMin: number
  capacidadProgramableEstimadaPorDiaMin: number
}

export const RADAR_CONFIG_DEFECTO: RadarConfig = configRadarJson as RadarConfig

const ESTADOS_CERRADOS: ReadonlySet<EstadoElemento> = new Set(['hecho', 'cancelado'])

function reglaSinMovimiento(snapshot: RadarSnapshot, config: RadarConfig, ahora: string): Hallazgo[] {
  return snapshot.elementosAbiertos
    .filter((el) => !ESTADOS_CERRADOS.has(el.estado))
    .filter((el) => el.ultimoEventoAt !== null && diferenciaEnDias(ahora, el.ultimoEventoAt) >= config.sinMovimientoDias)
    .map((el) => ({
      regla: 'SIN_MOVIMIENTO',
      entidad_tipo: el.tipo,
      entidad_id: el.id,
      titulo: el.titulo,
      severidad: 'atencion' as const,
      explicacion: `"${el.titulo}" no tiene eventos registrados en ${config.sinMovimientoDias} días o más.`,
      evidencia: [{ campo: 'ultimo_evento_at', valor: el.ultimoEventoAt }],
      acciones_sugeridas: ['programar', 'esperar', 'posponer', 'cancelar', 'hecho', 'continuar_manana'],
    }))
}

function reglaEsperaVencida(snapshot: RadarSnapshot, _config: RadarConfig, ahora: string): Hallazgo[] {
  const hoy = ahora.slice(0, 10)
  return snapshot.elementosAbiertos
    .filter((el) => el.estado === 'esperando')
    .filter((el) => el.fechaRevision === null || el.fechaRevision <= hoy)
    .map((el) => ({
      regla: 'ESPERA_VENCIDA',
      entidad_tipo: el.tipo,
      entidad_id: el.id,
      titulo: el.titulo,
      severidad: 'atencion' as const,
      explicacion:
        el.fechaRevision === null
          ? `"${el.titulo}" está en espera sin fecha de revisión.`
          : `La fecha de revisión de "${el.titulo}" (${el.fechaRevision}) ya pasó.`,
      evidencia: [{ campo: 'fecha_revision', valor: el.fechaRevision }],
      acciones_sugeridas: ['esperar', 'programar', 'posponer', 'cancelar', 'hecho', 'continuar_manana'],
    }))
}

function reglaPospuestoReiterado(snapshot: RadarSnapshot, config: RadarConfig, ahora: string): Hallazgo[] {
  const conteos = new Map<string, number>()
  for (const rep of snapshot.reprogramaciones) {
    if (diferenciaEnDias(ahora, rep.ocurridoEn) > config.pospuestoReiteradoVentanaDias) continue
    conteos.set(rep.entidadId, (conteos.get(rep.entidadId) ?? 0) + 1)
  }
  const hallazgos: Hallazgo[] = []
  for (const el of snapshot.elementosAbiertos) {
    const conteo = conteos.get(el.id) ?? 0
    if (conteo >= config.pospuestoReiteradoMinEventos) {
      hallazgos.push({
        regla: 'POSPUESTO_REITERADO',
        entidad_tipo: el.tipo,
        entidad_id: el.id,
        titulo: el.titulo,
        severidad: 'critico',
        explicacion: `"${el.titulo}" se ha reprogramado ${conteo} veces en los últimos ${config.pospuestoReiteradoVentanaDias} días.`,
        evidencia: [{ campo: 'reprogramaciones_en_ventana', valor: conteo }],
        acciones_sugeridas: ['programar', 'esperar', 'posponer', 'cancelar', 'hecho', 'continuar_manana'],
      })
    }
  }
  return hallazgos
}

function reglaActividadSinCierre(snapshot: RadarSnapshot, config: RadarConfig, ahora: string): Hallazgo[] {
  return snapshot.actividades
    .filter((a) => a.estado === 'en_curso' || a.estado === 'interrumpida')
    .filter((a) => diferenciaEnHoras(ahora, a.iniciadaEn) > config.actividadSinCierreHoras)
    .map((a) => ({
      regla: 'ACTIVIDAD_SIN_CIERRE',
      entidad_tipo: 'actividad',
      entidad_id: a.id,
      titulo: a.titulo,
      severidad: 'critico' as const,
      explicacion: `"${a.titulo}" se inició hace más de ${config.actividadSinCierreHoras} horas y no se ha finalizado.`,
      evidencia: [{ campo: 'iniciada_en', valor: a.iniciadaEn }],
      acciones_sugeridas: ['hecho', 'programar', 'posponer', 'cancelar', 'esperar', 'continuar_manana'],
    }))
}

function reglaIniciativaSinAvance(snapshot: RadarSnapshot, config: RadarConfig): Hallazgo[] {
  return snapshot.iniciativas
    .filter((ini) => ini.minutosEjecutadosSemana < ini.cuotaSemanalMin)
    .filter((ini) => ini.deudaMin > config.iniciativaSinAvanceDeudaUmbralMin)
    .map((ini) => ({
      regla: 'INICIATIVA_SIN_AVANCE',
      entidad_tipo: 'iniciativa',
      entidad_id: ini.id,
      titulo: ini.titulo,
      severidad: 'atencion' as const,
      explicacion: `La iniciativa "${ini.titulo}" acumula ${ini.deudaMin} min de deuda de progreso.`,
      evidencia: [
        { campo: 'deuda_min', valor: ini.deudaMin },
        { campo: 'minutos_ejecutados_semana', valor: ini.minutosEjecutadosSemana },
        { campo: 'cuota_semanal_min', valor: ini.cuotaSemanalMin },
      ],
      acciones_sugeridas: ['programar', 'continuar_manana'],
    }))
}

function reglaCapturaSinProcesar(snapshot: RadarSnapshot, config: RadarConfig, ahora: string): Hallazgo[] {
  return snapshot.capturas
    .filter((c) => c.estado === 'capturado')
    .filter((c) => diferenciaEnHoras(ahora, c.creadoEn) > config.capturaSinProcesarHoras)
    .map((c) => ({
      regla: 'CAPTURA_SIN_PROCESAR',
      entidad_tipo: 'captura',
      entidad_id: c.id,
      titulo: c.texto,
      severidad: 'info' as const,
      explicacion: `Esta captura lleva más de ${config.capturaSinProcesarHoras} horas sin procesarse.`,
      evidencia: [{ campo: 'creado_en', valor: c.creadoEn }],
      acciones_sugeridas: ['programar', 'esperar', 'posponer', 'cancelar', 'hecho', 'continuar_manana'],
    }))
}

function reglaVencimientoInalcanzable(snapshot: RadarSnapshot, config: RadarConfig, ahora: string): Hallazgo[] {
  const hoy = ahora.slice(0, 10)
  return snapshot.elementosAbiertos
    .filter((el) => !ESTADOS_CERRADOS.has(el.estado))
    .filter((el) => el.vencimiento !== null && el.minutosPendientesTotales > 0)
    .filter((el) => {
      const diasHastaVencimiento = Math.max(0, diasHabilesEntre(hoy, el.vencimiento as string))
      const capacidadDisponible = diasHastaVencimiento * config.capacidadProgramableEstimadaPorDiaMin
      return el.minutosPendientesTotales > capacidadDisponible
    })
    .map((el) => ({
      regla: 'VENCIMIENTO_INALCANZABLE',
      entidad_tipo: el.tipo,
      entidad_id: el.id,
      titulo: el.titulo,
      severidad: 'critico' as const,
      explicacion: `"${el.titulo}" necesita ${el.minutosPendientesTotales} min pendientes y no queda capacidad programable suficiente antes de su vencimiento (${el.vencimiento}).`,
      evidencia: [
        { campo: 'minutos_pendientes_totales', valor: el.minutosPendientesTotales },
        { campo: 'vencimiento', valor: el.vencimiento },
      ],
      acciones_sugeridas: ['programar', 'posponer', 'esperar', 'cancelar', 'hecho', 'continuar_manana'],
    }))
}

export function ejecutarRadar(
  snapshot: RadarSnapshot,
  config: RadarConfig = RADAR_CONFIG_DEFECTO,
  ahora: string,
): Hallazgo[] {
  return [
    ...reglaSinMovimiento(snapshot, config, ahora),
    ...reglaEsperaVencida(snapshot, config, ahora),
    ...reglaPospuestoReiterado(snapshot, config, ahora),
    ...reglaActividadSinCierre(snapshot, config, ahora),
    ...reglaIniciativaSinAvance(snapshot, config),
    ...reglaCapturaSinProcesar(snapshot, config, ahora),
    ...reglaVencimientoInalcanzable(snapshot, config, ahora),
  ]
}
