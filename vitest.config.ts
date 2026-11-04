import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.{test,spec}.ts'],
    // Every file gets its own jsdom environment, so the worker count drives peak
    // memory. Capping it keeps the suite from being OOM-killed on machines with
    // many cores but little free RAM ("Worker exited unexpectedly").
    maxWorkers: 6,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/tools/**/*.tool.ts', 'src/lib/**/*.ts'],
      exclude: ['src/lib/worker/**', '**/*.d.ts'],
    },
  },
});
