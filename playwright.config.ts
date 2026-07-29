import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
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
      VITE_PREORDER_DATA_MODE: 'fixture'
    },
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: !process.env.CI
  }
});
