import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// A later task adds a third "workers" project (@cloudflare/vitest-pool-workers).
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
    ],
  },
});
