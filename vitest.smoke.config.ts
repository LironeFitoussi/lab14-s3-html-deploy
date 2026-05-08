import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/smoke/**/*.smoke.test.ts'],
    environment: 'node',
    globals: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    reporters: ['default'],
  },
});
