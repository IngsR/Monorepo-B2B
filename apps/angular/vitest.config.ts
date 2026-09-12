import { defineConfig } from 'vitest/config';

/**
 * Unit test configuration for the Angular client.
 *
 * Scope is deliberately narrow: the domain rules and the mock API's enforcement
 * of them. The UI is verified by driving the real production bundle in a browser
 * (see `tools/preview.mjs` and `tools/qa-*.mjs`), which catches template and
 * routing breakage that a component unit test would not.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    reporters: ['default'],
  },
});
