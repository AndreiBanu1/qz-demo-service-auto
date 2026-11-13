import { defineConfig, devices } from '@playwright/test';

// Playwright starts the web server before globalSetup runs, so the empty-database
// reset lives in the command itself (it must happen before the migrations).
const command = [
  'rm -rf .wrangler/e2e',
  'npm run build',
  'wrangler d1 migrations apply turbo-garaj-demo --local --persist-to .wrangler/e2e',
  'wrangler dev --ip 127.0.0.1 --port 8787 --persist-to .wrangler/e2e --env-file .dev.vars.e2e',
].join(' && ');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:8787',
    ...devices['Desktop Chrome'],
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  },
  projects: [{ name: 'mobile-chromium' }],
  webServer: {
    command,
    url: 'http://127.0.0.1:8787/api/session',
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
