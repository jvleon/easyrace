import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      // En local: Firefox no requiere dependencias del sistema adicionales
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      // Mobile Firefox para validar el modal de registro en móvil
      name: 'Mobile Firefox',
      use: { ...devices['Pixel 5'], browserName: 'firefox' },
    },
    // Descomenta cuando se instalen las librerías del sistema en WSL:
    // { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    // { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: 'pnpm run dev',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
