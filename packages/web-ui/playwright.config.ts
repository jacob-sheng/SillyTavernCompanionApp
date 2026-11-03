import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', workers: 1, timeout: 60000,
  use: { baseURL: process.env.ST_TEST_URL ?? 'http://127.0.0.1:8190', viewport: { width: 390, height: 844 }, trace: 'retain-on-failure' },
  outputDir: '../../.cache/playwright-results',
  webServer: { command: 'node e2e/model-server.mjs', url: 'http://127.0.0.1:8192/v1/models', reuseExistingServer: !process.env.CI },
});
