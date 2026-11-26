import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/**/tests/**/*.test.ts', 'apps/web/tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.next/**', '**/.expo/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['packages/shared/src/**/*.ts'],
      exclude: ['packages/shared/src/i18n/locales/**', 'packages/shared/src/types.ts'],
      thresholds: {
        statements: 80,
        branches: 65,
        functions: 75,
        lines: 85,
      },
    },
  },
});
