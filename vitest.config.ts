import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Read version from package.json for test environment
import { readFileSync } from 'node:fs';
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
  plugins: [react()],
  define: {
    // Inject app version for tests (matches vite.config.ts)
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    /**
     * Vitest's default is 5000ms, which is not enough headroom here. The
     * container tests in `pages/Assessment.test.tsx` drive React + a debounced
     * save + a Dexie write through fake-indexeddb, and one of them deliberately
     * uses a 4000ms `waitFor` to observe a persisted row. A 4000ms wait inside a
     * 5000ms budget leaves 1000ms for everything else, so under CPU contention
     * (a dev server and a browser running alongside) those tests intermittently
     * reported "Test timed out in 5000ms" rather than a real failure.
     *
     * Raising the ceiling keeps the ordering that `src/test/setup.ts` relies on:
     * `asyncUtilTimeout` (3000) stays well below this, so a failing `waitFor`
     * still surfaces as an assertion difference instead of a timeout.
     */
    testTimeout: 15000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.test.{ts,tsx}',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/App.tsx',
        'src/theme/**',
        'src/**/index.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
