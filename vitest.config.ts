import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';

// Plain URL (no node:url) so tsc type-checks this file without @types/node.
const migrationsDir = decodeURIComponent(new URL('./migrations', import.meta.url).pathname);

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'core', include: ['tests/core/**/*.test.ts'], environment: 'node' } },
      {
        plugins: [react()],
        test: {
          name: 'ui',
          include: ['tests/ui/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          setupFiles: ['tests/ui/setup.ts'],
        },
      },
      {
        // Runs inside workerd with a real local D1 (bindings come from wrangler.toml).
        plugins: [
          cloudflareTest(async () => ({
            wrangler: { configPath: './wrangler.toml' },
            miniflare: { bindings: {
                TEST_MIGRATIONS: await readD1Migrations(migrationsDir),
                // Test-only values so createDeps(env) works in the Worker entry tests.
                MAIL_MODE: 'memory',
                SITE_URL: 'http://127.0.0.1:8787',
                ADMIN_PASSWORD: 'test-admin',
                SESSION_SECRET: 'test-secret',
              }, },
          })),
        ],
        test: {
          name: 'workers',
          include: ['tests/worker/**/*.test.ts'],
          setupFiles: ['tests/worker/setup.ts'],
          // Test files share one local D1 and each test empties the tables first.
          fileParallelism: false,
        },
      },
    ],
  },
});
