// CA-01: la PWA es instalable y, tras la primera carga, funciona sin red
// al 100% — app shell, datos y navegación entre las cuatro superficies.
// Verificado con context.setOffline(true), como exige la especificación.

import { expect, test } from '@playwright/test'

test('funciona completamente offline tras la primera carga', async ({ page, context }) => {
  // Primera carga en línea: el service worker cachea el app shell.
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Hoy' })).toBeVisible()
  await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true))

  await context.setOffline(true)
  await page.reload()

  // El shell sigue cargando y las cuatro superficies siguen navegables sin red.
  await expect(page.getByRole('heading', { name: 'Hoy' })).toBeVisible()

  await page.getByRole('button', { name: 'Capturar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Capturar' })).toBeVisible()
  await page.getByLabel('Texto de la captura').fill('nota tomada completamente sin red')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('nota tomada completamente sin red')).toBeVisible()

  await page.getByRole('button', { name: 'Radar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Radar' })).toBeVisible()

  await page.getByRole('button', { name: 'Bitácora', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Bitácora' })).toBeVisible()
  await expect(page.getByText('sin conexión')).toBeVisible()
})
