import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Tiket zadaný jen ke kontrole nesmí skončit v úložišti. Záruka stojí na tom, že modul,
 * který ho drží, na úložiště vůbec nedosáhne — stejný přístup jako `sit.test.ts`.
 */
describe('tiket jen ke kontrole', () => {
  const kod = readFileSync(new URL('../src/app/data/docasnyTiket.ts', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  it('modul neimportuje úložiště ani stav aplikace', () => {
    const importy = [...kod.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
    expect(importy).toEqual(['@angular/core', '@kontrola-tiketu/jadro']);
    expect(kod).not.toMatch(/ULOZISTE|Stav|localStorage|sessionStorage|indexedDB|Preferences/);
  });
});
