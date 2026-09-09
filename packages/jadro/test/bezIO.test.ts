import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Zadání žádá čistou knihovnu bez závislosti na UI a bez I/O. To je snadné dodržet dnes
 * a snadné omylem porušit za půl roku, tak ať to hlídá test, ne dobrá vůle.
 */
const SRC = new URL('../src/', import.meta.url);

const ZAKAZANE = [
  /from\s+['"]node:/,
  /from\s+['"]fs['"]/,
  /from\s+['"]path['"]/,
  /require\s*\(/,
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /localStorage/,
  /\bdocument\b/,
  /\bwindow\b/,
  /@angular/,
  /@capacitor/,
];

function zdrojaky(): { jmeno: string; obsah: string }[] {
  return readdirSync(SRC)
    .filter((j) => j.endsWith('.ts'))
    .map((jmeno) => ({ jmeno, obsah: readFileSync(new URL(jmeno, SRC), 'utf8') }));
}

describe('jádro je čistá knihovna', () => {
  it('má nějaké zdrojáky, jinak by test nic nedokazoval', () => {
    expect(zdrojaky().length).toBeGreaterThan(5);
  });

  it('neobsahuje I/O, síť, DOM ani vazbu na UI framework', () => {
    for (const { jmeno, obsah } of zdrojaky()) {
      // Komentáře nekontrolujeme — zmiňují I/O právě proto, že se tu nedělá.
      const kod = obsah.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      for (const vzor of ZAKAZANE) {
        expect(kod, `${jmeno} porušuje ${vzor}`).not.toMatch(vzor);
      }
    }
  });

  it('nemá běhové závislosti', () => {
    const balik = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { dependencies?: Record<string, string> };
    expect(balik.dependencies ?? {}).toEqual({});
  });
});
