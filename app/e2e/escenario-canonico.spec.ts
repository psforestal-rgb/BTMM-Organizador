// CA-12 — prueba de oro (sección 13). Reloj fijo, América/Costa_Rica,
// 2026-09-08, dos contextos de navegador independientes (DISPOSITIVO-A y
// DISPOSITIVO-B) contra un servidor FastAPI real (ver playwright.config.ts:
// webServer levanta uvicorn con una base de datos SQLite efímera propia).
// No hay mocks de red ni de sincronización: todo pasa por HTTP real.

import { expect, test, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const API_BASE = 'http://127.0.0.1:8000'

async function fijarHora(page: Page, iso: string) {
  await page.clock.setFixedTime(new Date(iso))
}

async function irA(page: Page, pestana: 'Hoy' | 'Capturar' | 'Radar' | 'Bitácora') {
  await page.getByRole('button', { name: pestana, exact: true }).click()
}

async function sincronizarAhora(page: Page) {
  await irA(page, 'Bitácora')
  await page.getByRole('button', { name: 'Sincronizar ahora' }).click()
  await expect(page.getByRole('button', { name: 'Sincronizar ahora' })).toBeEnabled({ timeout: 10_000 })
}

test.describe.configure({ mode: 'serial' })

test('escenario-canonico', async ({ browser }) => {
  const contextoA = await browser.newContext({ acceptDownloads: true })
  const contextoB = await browser.newContext({ acceptDownloads: true })

  // Cada "dispositivo" es su propio perfil de navegador: IndexedDB y
  // localStorage aislados entre sí, como en la vida real.
  await contextoA.addInitScript((id) => {
    localStorage.setItem('geo.device_id', id)
    // @ts-expect-error -- se simula un almacenamiento persistente concedido
    navigator.storage.persist = async () => true
    // @ts-expect-error -- idem
    navigator.storage.persisted = async () => true
  }, 'DISPOSITIVO-A')
  await contextoB.addInitScript((id) => {
    localStorage.setItem('geo.device_id', id)
    // @ts-expect-error -- se simula un almacenamiento persistente NO concedido
    navigator.storage.persist = async () => false
    // @ts-expect-error -- idem
    navigator.storage.persisted = async () => false
  }, 'DISPOSITIVO-B')

  const paginaA = await contextoA.newPage()
  const paginaB = await contextoB.newPage()

  const lotesEnviadosPorA: string[] = []
  paginaA.on('request', (req) => {
    if (req.method() === 'POST' && req.url().includes('/sync/push')) {
      const datos = req.postData()
      if (datos) lotesEnviadosPorA.push(datos)
    }
  })

  // --- 08:00 — A crea el informe y planifica la jornada ------------------
  await fijarHora(paginaA, '2026-09-08T08:00:00-06:00')
  await paginaA.goto('/')
  await irA(paginaA, 'Hoy')
  await paginaA.getByRole('button', { name: 'Nueva asignación' }).click()
  await paginaA.getByLabel('Título de la nueva asignación').fill('Informe técnico CASO-2026-001')
  await paginaA.getByLabel('Duración estimada en minutos').fill('90')
  await paginaA.getByLabel('Fecha de vencimiento').fill('2026-09-08')
  await paginaA.getByLabel('Prioridad').selectOption('3')
  await paginaA.getByRole('button', { name: 'Guardar asignación' }).click()
  await expect(paginaA.getByText('Informe técnico CASO-2026-001').first()).toBeVisible()
  // El plan coloca el informe (queda como bloque en curso a las 08:00).
  await expect(paginaA.getByText(/Informe técnico CASO-2026-001 \(08:00/)).toBeVisible()

  // --- 08:05 — A sincroniza; B sincroniza y ve la asignación --------------
  await fijarHora(paginaA, '2026-09-08T08:05:00-06:00')
  await sincronizarAhora(paginaA)

  await fijarHora(paginaB, '2026-09-08T08:05:30-06:00')
  await paginaB.goto('/')
  await sincronizarAhora(paginaB)
  await irA(paginaB, 'Hoy')
  await expect(paginaB.getByText('Informe técnico CASO-2026-001').first()).toBeVisible()

  // --- 08:20 B se desconecta; 08:30 A se desconecta -----------------------
  await contextoB.setOffline(true)
  await irA(paginaB, 'Bitácora')
  await expect(paginaB.getByText('sin conexión')).toBeVisible()

  await contextoA.setOffline(true)
  await irA(paginaA, 'Bitácora')
  await expect(paginaA.getByText('sin conexión')).toBeVisible()

  // --- 08:35 — A inicia la actividad del informe ---------------------------
  await fijarHora(paginaA, '2026-09-08T08:35:00-06:00')
  await irA(paginaA, 'Hoy')
  await paginaA.getByLabel('Bloque en curso').getByRole('button', { name: 'Iniciar' }).click()
  await expect(paginaA.getByRole('button', { name: 'Terminar' })).toBeVisible()

  // --- 08:45 — A interrumpe -------------------------------------------------
  await fijarHora(paginaA, '2026-09-08T08:45:00-06:00')
  await paginaA.getByRole('button', { name: 'Interrumpir' }).click()
  await paginaA.getByLabel('Marcador de reanudación').fill('me quedé comparando vértices 11-17')
  await paginaA.getByRole('button', { name: 'Confirmar interrupción' }).click()
  await expect(paginaA.getByText('me quedé comparando vértices 11-17').first()).toBeVisible()

  // --- 09:10 — A termina el emergente; se ofrece retomar -------------------
  await fijarHora(paginaA, '2026-09-08T09:10:00-06:00')
  await expect(paginaA.getByText('me quedé comparando vértices 11-17').first()).toBeVisible()
  const bufferAntes = await paginaA.getByText(/Buffer de absorción restante: 75 min/).count()
  expect(bufferAntes).toBeGreaterThan(0)
  await paginaA.getByRole('button', { name: 'Terminé el emergente' }).click()
  // El buffer restante bajó de 75 a 50 (los 25 min del emergente lo consumieron).
  await expect(paginaA.getByText(/Buffer de absorción restante: 50 min/)).toBeVisible()
  // El planificador desplaza el remanente del informe, que sigue mostrando el marcador.
  await expect(paginaA.getByText(/Retomando:\s*me quedé comparando vértices 11-17/).first()).toBeVisible()

  // --- 09:15 — B (desconectado) crea "Revisión GIS", y edita el informe ----
  await fijarHora(paginaB, '2026-09-08T09:15:00-06:00')
  await irA(paginaB, 'Hoy')
  await paginaB.getByRole('button', { name: 'Nueva asignación' }).click()
  await paginaB.getByLabel('Título de la nueva asignación').fill('Revisión GIS CASO-2026-002')
  await paginaB.getByLabel('Duración estimada en minutos').fill('45')
  await paginaB.getByLabel('Fecha de vencimiento').fill('2026-09-09')
  await paginaB.getByRole('button', { name: 'Guardar asignación' }).click()
  await expect(paginaB.getByText('Revisión GIS CASO-2026-002').first()).toBeVisible()

  await paginaB.getByLabel('Prioridad de Informe técnico CASO-2026-001').selectOption('4')
  await paginaB.getByLabel('Duración de Informe técnico CASO-2026-001').fill('120')

  // --- 09:20 — A (desconectado) cambia la prioridad a media -----------------
  await fijarHora(paginaA, '2026-09-08T09:20:00-06:00')
  await irA(paginaA, 'Hoy')
  await paginaA.getByLabel('Prioridad de Informe técnico CASO-2026-001').selectOption('2')

  // --- 09:40 — ambos recuperan la conexión y sincronizan --------------------
  await contextoA.setOffline(false)
  await contextoB.setOffline(false)
  await fijarHora(paginaA, '2026-09-08T09:40:00-06:00')
  await fijarHora(paginaB, '2026-09-08T09:40:00-06:00')
  await sincronizarAhora(paginaA)
  await sincronizarAhora(paginaB)
  // Una segunda ronda para que cada uno reciba lo que el otro empujó recién.
  await sincronizarAhora(paginaA)
  await sincronizarAhora(paginaB)

  // ===== Verificaciones finales (las ocho de la sección 13) =================

  // 1) La bitácora de A conserva íntegros inicio/interrupción/emergente/reanudación.
  await irA(paginaA, 'Bitácora')
  await expect(paginaA.getByText('actividad_reanudada')).toBeVisible()
  const textoBitacoraA = await paginaA.locator('body').innerText()
  for (const tipo of [
    'actividad_iniciada',
    'actividad_interrumpida',
    'emergente_registrado',
    'actividad_reanudada',
  ]) {
    expect(textoBitacoraA).toContain(tipo)
  }

  // 2) B ve la asignación creada en A y A ve la creada en B.
  await irA(paginaB, 'Hoy')
  await expect(paginaB.getByText('Informe técnico CASO-2026-001').first()).toBeVisible()
  await irA(paginaA, 'Hoy')
  await expect(paginaA.getByText('Revisión GIS CASO-2026-002').first()).toBeVisible()

  // 3) y 4) prioridad converge a "media" (2) y duración a 120 en ambos.
  await expect(paginaA.getByLabel('Prioridad de Informe técnico CASO-2026-001')).toHaveValue('2')
  await expect(paginaB.getByLabel('Prioridad de Informe técnico CASO-2026-001')).toHaveValue('2')
  await expect(paginaA.getByLabel('Duración de Informe técnico CASO-2026-001')).toHaveValue('120')
  await expect(paginaB.getByLabel('Duración de Informe técnico CASO-2026-001')).toHaveValue('120')

  // 5) Exactamente un conflicto abierto sobre prioridad, con "critica" (B) conservado.
  const respuestaConflictos = await paginaA.request.get(`${API_BASE}/sync/conflictos`)
  const conflictos = await respuestaConflictos.json()
  expect(conflictos).toHaveLength(1)
  expect(conflictos[0].campo).toBe('prioridad')
  expect(conflictos[0].valor_ganador).toBe(2)
  expect(conflictos[0].valor_perdedor).toBe(4)
  expect(conflictos[0].device_perdedor).toBe('DISPOSITIVO-B')
  await irA(paginaA, 'Bitácora')
  await expect(paginaA.getByText('Conflictos abiertos: 1')).toBeVisible()

  // 6) Reenviar el último lote de A: todo duplicado, ningún contador cambia.
  const estadoAntes = await paginaA.request.get(`${API_BASE}/sync/status?device_id=DISPOSITIVO-A`)
  const serverSeqAntes = (await estadoAntes.json()).server_seq
  const ultimoLote = lotesEnviadosPorA[lotesEnviadosPorA.length - 1]
  expect(ultimoLote).toBeTruthy()
  const respuestaReenvio = await paginaA.request.post(`${API_BASE}/sync/push`, {
    data: JSON.parse(ultimoLote as string),
  })
  const cuerpoReenvio = await respuestaReenvio.json()
  expect(cuerpoReenvio.aceptados).toEqual([])
  expect(cuerpoReenvio.rechazados).toEqual([])
  expect(cuerpoReenvio.duplicados.length).toBeGreaterThan(0)
  const estadoDespues = await paginaA.request.get(`${API_BASE}/sync/status?device_id=DISPOSITIVO-A`)
  expect((await estadoDespues.json()).server_seq).toBe(serverSeqAntes)

  // 7) HOY en A muestra el remanente del informe con su marcador de reanudación.
  await irA(paginaA, 'Hoy')
  await expect(paginaA.getByText(/Retomando:\s*me quedé comparando vértices 11-17/).first()).toBeVisible()

  // 8) La exportación (JSON y CSV) tiene tantas filas como eventos en la bitácora local.
  await irA(paginaA, 'Bitácora')
  // useLiveQuery resuelve de forma asíncrona: espera a que el conteo deje
  // de mostrar el valor por defecto (0) antes de leerlo.
  await expect(paginaA.locator('body')).toContainText(/[1-9]\d*\s+eventos?\s+registrados?/, {
    timeout: 5000,
  })
  const conteoTexto = await paginaA.locator('body').innerText()
  const coincidenciaConteo = /(\d+)\s+eventos? registrados?/.exec(conteoTexto)
  expect(coincidenciaConteo).not.toBeNull()
  const totalEventos = Number(coincidenciaConteo?.[1])
  expect(totalEventos).toBeGreaterThan(0)

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'geo-export-'))

  const [descargaJSON] = await Promise.all([
    paginaA.waitForEvent('download'),
    paginaA.getByRole('button', { name: 'Exportar JSON' }).click(),
  ])
  const rutaJSON = path.join(tmpDir, 'bitacora.json')
  await descargaJSON.saveAs(rutaJSON)
  const filasJSON = JSON.parse(fs.readFileSync(rutaJSON, 'utf-8'))
  expect(filasJSON).toHaveLength(totalEventos)

  const [descargaCSV] = await Promise.all([
    paginaA.waitForEvent('download'),
    paginaA.getByRole('button', { name: 'Exportar CSV' }).click(),
  ])
  const rutaCSV = path.join(tmpDir, 'bitacora.csv')
  await descargaCSV.saveAs(rutaCSV)
  const lineasCSV = fs.readFileSync(rutaCSV, 'utf-8').trim().split('\n')
  expect(lineasCSV.length - 1).toBe(totalEventos) // menos el encabezado

  // Indicador de almacenamiento persistente en ambos estados.
  await expect(paginaA.getByText('Almacenamiento persistente: concedido')).toBeVisible()
  await irA(paginaB, 'Bitácora')
  await expect(paginaB.getByText(/Almacenamiento persistente: no concedido/)).toBeVisible()

  await contextoA.close()
  await contextoB.close()
})
