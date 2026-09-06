// CA-11, prueba adicional de la sección 13: interrumpir un pull paginado
// devolviendo un error en la segunda página, y comprobar que la
// siguiente sincronización reanuda desde el punto de control sin huecos
// ni duplicados. Servidor real (mismo webServer que el escenario
// canónico); solo la respuesta de la SEGUNDA página se corta a nivel de
// red con page.route(), nunca con un doble de SyncAdapter.

import { expect, test, type Route } from '@playwright/test'

const API_BASE = 'http://127.0.0.1:8000'
// outbox.ts pide de a LIMITE_PAGINA_PULL=200 por página; se siembran más
// de 200 eventos para que el pull real (sin tocar la app) necesite dos
// páginas, igual que pasaría en producción con una bitácora grande.
const TOTAL_EVENTOS_SEMBRADOS = 205

test('reanuda tras un corte de red a mitad de la paginación de /sync/pull', async ({ page, context, request }) => {
  await context.addInitScript((id) => localStorage.setItem('geo.device_id', id), 'DISPOSITIVO-LOCAL')

  // Semilla: otro dispositivo empuja 12 capturas, para forzar varias
  // páginas de pull con el límite reducido que usa este test.
  const eventosSemilla = Array.from({ length: TOTAL_EVENTOS_SEMBRADOS }, (_, i) => ({
    event_id: `aaaaaaaa-0000-4000-8000-${String(i).padStart(12, '0')}`,
    entity_type: 'captura',
    entity_id: `bbbbbbbb-0000-4000-8000-${String(i).padStart(12, '0')}`,
    event_type: 'captura_creada',
    occurred_at: '2026-09-08T08:00:00-06:00',
    recorded_at: '2026-09-08T08:00:00-06:00',
    device_id: 'DISPOSITIVO-SEMILLA',
    client_sequence: i + 1,
    payload: {
      texto: `captura semilla ${i}`,
      estado: 'capturado',
      device_id: 'DISPOSITIVO-SEMILLA',
      creado_en: '2026-09-08T08:00:00-06:00',
    },
  }))
  const respuestaPush = await request.post(`${API_BASE}/sync/push`, {
    data: { device_id: 'DISPOSITIVO-SEMILLA', eventos: eventosSemilla, cambios: [] },
  })
  expect(respuestaPush.ok()).toBe(true)

  let solicitudesConDesdePositivo = 0
  await page.route('**/sync/pull*', (route: Route) => {
    const url = new URL(route.request().url())
    const desde = Number(url.searchParams.get('desde') ?? '0')
    if (desde > 0 && solicitudesConDesdePositivo < 4) {
      solicitudesConDesdePositivo += 1
      return route.abort('connectionreset')
    }
    return route.continue()
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Bitácora', exact: true }).click()

  // Primer intento: la página 1 (desde=0) se aplica, pero la página 2
  // (desde>0) falla las 4 veces que el outbox reintenta -> sincronizar()
  // termina en error, visible en la UI, sin perder lo ya aplicado.
  await page.getByRole('button', { name: 'Sincronizar ahora' }).click()
  await expect(page.getByRole('button', { name: 'Sincronizar ahora' })).toBeEnabled({ timeout: 15_000 })
  await expect(page.getByText(/Sin conexión o error/)).toBeVisible()

  // El servidor de este webServer es compartido por todo el proceso de
  // Playwright (otros archivos de prueba también le empujan eventos), así
  // que se filtra por el prefijo propio de esta semilla en vez de contar
  // el total de la tabla local.
  async function idsDeLaSemillaEnDexie(): Promise<string[]> {
    return page.evaluate(async () => {
      const req = indexedDB.open('geo')
      return new Promise<string[]>((resolve) => {
        req.onsuccess = () => {
          const db = req.result
          const tx = db.transaction('eventos', 'readonly')
          const todos = tx.objectStore('eventos').getAll()
          todos.onsuccess = () =>
            resolve(
              todos.result
                .map((e: { event_id: string }) => e.event_id)
                .filter((id: string) => id.startsWith('aaaaaaaa-0000-4000-8000-')),
            )
        }
      })
    })
  }

  const idsTrasFallo = await idsDeLaSemillaEnDexie()
  expect(idsTrasFallo.length).toBeGreaterThan(0)
  expect(idsTrasFallo.length).toBeLessThan(TOTAL_EVENTOS_SEMBRADOS)

  // Segunda sincronización: la "red" ya está disponible para desde>0
  // (el contador de fallos ya llegó a 4) y debe reanudar desde el punto
  // de control, sin huecos ni duplicados.
  await page.getByRole('button', { name: 'Sincronizar ahora' }).click()
  await expect(page.getByRole('button', { name: 'Sincronizar ahora' })).toBeEnabled({ timeout: 15_000 })

  const idsUnicos = await idsDeLaSemillaEnDexie()
  expect(idsUnicos).toHaveLength(TOTAL_EVENTOS_SEMBRADOS)
  expect(new Set(idsUnicos).size).toBe(TOTAL_EVENTOS_SEMBRADOS) // sin duplicados
})
