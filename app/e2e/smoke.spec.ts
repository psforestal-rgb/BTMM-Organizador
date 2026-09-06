import { expect, test } from '@playwright/test'

test('la app carga y muestra las cuatro pestañas de navegación', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/GEO/)
  for (const etiqueta of ['Hoy', 'Capturar', 'Radar', 'Bitácora']) {
    await expect(page.getByRole('button', { name: etiqueta, exact: true })).toBeVisible()
  }
})
