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
      command: 'npm run preview -- --port 4173',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: false,
      timeout: 60_000,
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
      timeout: 60_000,
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
