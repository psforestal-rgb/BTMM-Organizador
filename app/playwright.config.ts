import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      // --host 127.0.0.1 explícito: sin él, Vite resuelve el string
      // "localhost" con el orden de direcciones del sistema operativo, que
      // no está garantizado igual entre entornos. En el runner de GitHub
      // Actions se comprobó (vía DEBUG=pw:webserver) que el proceso
      // arranca y queda escuchando, pero el chequeo de salud de Playwright
      // contra 127.0.0.1 nunca recibe respuesta — consistente con un bind
      // que quedó solo en ::1. Aquí sí se reprodujo con éxito, pero eso no
      // prueba que el bind sea el mismo en ambos entornos.
      command: 'npm run preview -- --port 4173 --host 127.0.0.1',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: false,
      timeout: 120_000,
      // Sin esto, Playwright silencia la salida del proceso y un timeout
      // de "config.webServer" no deja rastro de cuál servidor falló ni
      // por qué (visto en CI: mismo comando, mismo entorno, cero pistas).
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      // Servidor real para el escenario canónico (CA-11/CA-12): base de
      // datos propia y efímera, migrada desde cero en cada corrida.
      command:
        'rm -f geo_e2e.db && ./.venv/bin/alembic upgrade head && ./.venv/bin/uvicorn geo.api.main:app --host 127.0.0.1 --port 8000',
      cwd: '../server',
      env: { GEO_DATABASE_URL: 'sqlite:///./geo_e2e.db' },
      url: 'http://127.0.0.1:8000/health',
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // PLAYWRIGHT_CHROMIUM_PATH es solo para entornos de desarrollo con un
        // Chromium preinstalado en una ruta fija; en CI queda sin definir y
        // Playwright resuelve el binario instalado por `playwright install`.
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
          : {},
      },
    },
  ],
})
