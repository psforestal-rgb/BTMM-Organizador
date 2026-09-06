import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const SRC_DIR = path.resolve(AQUI, '..')
const DOMINIO_DIR = path.join(SRC_DIR, 'dominio')

function archivosTypeScript(dir: string): string[] {
  const resultado: string[] = []
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const rutaCompleta = path.join(dir, entrada.name)
    if (entrada.isDirectory()) {
      resultado.push(...archivosTypeScript(rutaCompleta))
    } else if (/\.tsx?$/.test(entrada.name) && !entrada.name.endsWith('.test.ts')) {
      resultado.push(rutaCompleta)
    }
  }
  return resultado
}

describe('invariante 5 — el dominio no conoce la hora del sistema', () => {
  it('src/dominio no contiene new Date() ni Date.now()', () => {
    const violaciones: string[] = []
    for (const archivo of archivosTypeScript(DOMINIO_DIR)) {
      const contenido = fs.readFileSync(archivo, 'utf-8')
      if (/\bnew\s+Date\s*\(/.test(contenido) || /\bDate\.now\s*\(/.test(contenido)) {
        violaciones.push(archivo)
      }
    }
    expect(violaciones).toEqual([])
  })
})

describe('ADR 0005 — dirección de dependencias del dominio', () => {
  it('src/dominio no importa Dexie, fetch ni src/ui', () => {
    const prohibidos = [/from ['"]dexie['"]/, /from ['"]\.\.\/ui/, /from ['"]dexie-react-hooks['"]/]
    const violaciones: string[] = []
    for (const archivo of archivosTypeScript(DOMINIO_DIR)) {
      const contenido = fs.readFileSync(archivo, 'utf-8')
      if (prohibidos.some((patron) => patron.test(contenido))) {
        violaciones.push(archivo)
      }
    }
    expect(violaciones).toEqual([])
  })
})

describe('CA-03 (cliente) — el repositorio de eventos no permite modificar ni borrar', () => {
  it('RepositorioEventos no expone actualizar/eliminar/update/delete/put', async () => {
    const { RepositorioEventos } = await import('../datos/eventos')
    const metodos = Object.getOwnPropertyNames(RepositorioEventos.prototype)
    const prohibidos = metodos.filter((nombre) =>
      /actualizar|eliminar|update|delete|put/i.test(nombre),
    )
    expect(prohibidos).toEqual([])
  })
})
