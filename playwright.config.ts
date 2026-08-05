import { defineConfig, devices } from '@playwright/test';

const handoffMode = process.env.MOXI_E2E_MODE === 'toast_handoff';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 15_000
  },
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4174',
    trace: 'retain-on-failure'
  },
  projects: [
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 390, height: 844 }
      }
    },
    {
      name: 'tablet-portrait-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } }
    },
    {
      name: 'tablet-landscape-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 } }
    },
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } }
    }
  ],
  webServer: {
    command: 'pnpm dev --host 127.0.0.1 --port 4174',
    env: {
      ...process.env,
      VITE_APP_STAGE: 'preview',
      VITE_PREORDER_DATA_MODE: 'fixture',
      VITE_PREORDER_EXPERIENCE_MODE: handoffMode ? 'toast_handoff' : 'first_party',
      VITE_PREORDER_CHECKOUT_URL: 'https://www.toasttab.com/local/order/dough-monster'
    },
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false
  }
});
