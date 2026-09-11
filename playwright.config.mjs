import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  retries: 1,
  webServer: {
    command: 'python3 -m http.server 4174',
    port: 4174,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://127.0.0.1:4174',
    locale: 'zh-CN',
    channel: 'chrome',
  },
});
