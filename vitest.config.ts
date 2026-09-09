import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'packages/*/test/**/*.test.ts',
      'fetcher/test/**/*.test.ts',
      'app/test/**/*.test.ts',
      'test/**/*.test.ts',
    ],
  },
});
