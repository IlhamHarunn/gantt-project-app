import { defineConfig } from '@playwright/test'

/**
 * Konfigurasi e2e: menjalankan build produksi lewat `vite preview`
 * dan mengujinya dengan browser Edge yang sudah terpasang di sistem.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5199',
    // Default memakai Microsoft Edge yang sudah terpasang di Windows.
    // Bila tidak ada: npx playwright install chromium && PW_CHANNEL=chromium npm run test:e2e
    channel: process.env.PW_CHANNEL ?? 'msedge',
    headless: true,
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: 'npm run preview -- --port 5199 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:5199',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
