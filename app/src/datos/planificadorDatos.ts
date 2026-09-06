// Ensambla una EntradaPlanificador (sección 7.3) a partir de Dexie. Vive
// en src/datos porque toca la base local; el algoritmo en sí sigue
// siendo puro en src/dominio/planificador.ts.

import type { CandidataPlan, EntradaPlanificador } from '../dominio/planificador'
import type { GeoDexie } from './db'
import { obtenerConfiguracion } from './configuracion'

const JORNADA_POR_DEFECTO = {
  inicio: '07:00',
  fin: '16:00',
  almuerzoInicio: '12:00',
  almuerzoFin: '13:00',
}

function aHHMM(iso: string): string {
  return iso.slice(11, 16)
}

export async function construirEntradaPlanificador(
  db: GeoDexie,
  fecha: string,
  ahoraHHMM: string,
): Promise<EntradaPlanificador> {
  const configuracion = await obtenerConfiguracion(db)

  const jornadaFija = await db.eventosFijos
    .where('fecha')
    .equals(fecha)
    .filter((e) => e.tipo === 'jornada')
    .first()
  const jornada = jornadaFija
    ? {
        inicio: jornadaFija.inicio,
        fin: jornadaFija.fin,
        almuerzoInicio: JORNADA_POR_DEFECTO.almuerzoInicio,
        almuerzoFin: JORNADA_POR_DEFECTO.almuerzoFin,
      }
    : JORNADA_POR_DEFECTO

  const eventosFijosDelDia = await db.eventosFijos
    .where('fecha')
    .equals(fecha)
    .filter((e) => e.tipo !== 'jornada')
    .toArray()

  const actividadesDelDia = await db.actividades
    .filter((a) => a.iniciada_en.startsWith(fecha))
    .toArray()
  const intervalosEjecutados = actividadesDelDia
    .filter((a) => a.finalizada_en)
    .map((a) => ({ inicio: aHHMM(a.iniciada_en), fin: aHHMM(a.finalizada_en as string) }))
  const minutosEmergentesHoy = actividadesDelDia
    .filter((a) => a.asignacion_id === null && a.minutos_reales !== null)
    .reduce((total, a) => total + (a.minutos_reales ?? 0), 0)

  const asignacionesAbiertas = await db.asignaciones.where('estado').equals('programado').toArray()
  const candidatas: CandidataPlan[] = asignacionesAbiertas.map((a) => ({
    id: a.id,
    titulo: a.titulo,
    carril: a.carril,
    duracionMin: a.duracion_estimada_min,
    vencimiento: a.vencimiento,
    prioridad: a.prioridad,
    indivisible: a.indivisible,
    dependenciasCumplidas: a.dependencias.length === 0,
    iniciativaId: a.iniciativa_id,
  }))

  const iniciativas = await db.iniciativas.toArray()

  return {
    fecha,
    jornada,
    eventosFijos: eventosFijosDelDia.map((e) => ({ inicio: e.inicio, fin: e.fin })),
    bufferAbsorcionMin: configuracion.buffer_absorcion_min,
    minutosEmergentesHoy,
    intervalosEjecutados,
    candidatas,
    cuotasIniciativa: iniciativas.map((i) => ({
      iniciativaId: i.id,
      cuotaSemanalMin: i.cuota_semanal_min,
      minutosEjecutadosSemana: i.minutos_ejecutados_semana,
      deudaMin: i.deuda_min,
    })),
    ahora: ahoraHHMM,
  }
}
