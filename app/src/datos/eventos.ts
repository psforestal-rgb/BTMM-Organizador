// Repositorio de eventos: deliberadamente expone solo `agregar` y
// lecturas. No existe `actualizar` ni `eliminar` — esa ausencia es la
// prueba de CA-03 en el cliente (invariante 1).

import type { GeoDexie } from './db'
import type { EventoGEO } from '../dominio/tipos'

export class RepositorioEventos {
  private readonly db: GeoDexie

  constructor(db: GeoDexie) {
    this.db = db
  }

  async agregar(evento: EventoGEO): Promise<void> {
    await this.db.eventos.add(evento)
  }

  async porEntidad(entityId: string): Promise<EventoGEO[]> {
    return this.db.eventos.where('entity_id').equals(entityId).sortBy('recorded_at')
  }

  async todos(): Promise<EventoGEO[]> {
    return this.db.eventos.toArray()
  }

  async contar(): Promise<number> {
    return this.db.eventos.count()
  }

  async maximoClientSequence(deviceId: string): Promise<number> {
    const eventos = await this.db.eventos.where('event_id').notEqual('').toArray()
    return eventos
      .filter((evento) => evento.device_id === deviceId)
      .reduce((max, evento) => Math.max(max, evento.client_sequence), 0)
  }
}
