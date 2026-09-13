import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Testy aplikace i knihoven, které běží v Node bez Angularu. Knihovny nejsou npm balíky —
// aliasy odpovídají `paths` v tsconfig.json.
export default defineConfig({
  resolve: {
    alias: {
      '@kontrola-tiketu/jadro': fileURLToPath(new URL('knihovny/jadro/src/index.ts', import.meta.url)),
      '@kontrola-tiketu/ocr': fileURLToPath(new URL('knihovny/ocr/src/index.ts', import.meta.url)),
    },
  },
  test: {
    include: ['test/**/*.test.ts', 'knihovny/*/test/**/*.test.ts'],
  },
});
