import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Smysl téhle knihovny je, že jde otestovat bez zařízení. Kdyby se do ní dostal import
 * z ML Kitu nebo Capacitoru, byla by z ní obyčejná část aplikace a všechno tohle testování
 * by šlo stranou. Ať to hlídá test, ne dobrá vůle.
 */
const SRC = new URL('../src/', import.meta.url);

const ZAKAZANE = [
  /from\s+['"]node:/,
  /require\s*\(/,
  /\bfetch\s*\(/,
  /localStorage/,
  /\bdocument\b/,
  /\bwindow\b/,
  /@angular/,
  /@capacitor/,
  /mlkit/i,
];

function zdrojaky(): { jmeno: string; obsah: string }[] {
  return readdirSync(SRC)
    .filter((j) => j.endsWith('.ts'))
    .map((jmeno) => ({ jmeno, obsah: readFileSync(new URL(jmeno, SRC), 'utf8') }));
}

describe('OCR knihovna je čistá', () => {
  it('má nějaké zdrojáky, jinak by test nic nedokazoval', () => {
    expect(zdrojaky().length).toBeGreaterThan(3);
  });

  it('neobsahuje I/O, síť, DOM ani vazbu na ML Kit či Capacitor', () => {
    for (const { jmeno, obsah } of zdrojaky()) {
      const kod = obsah.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      for (const vzor of ZAKAZANE) {
        expect(kod, `${jmeno} porušuje ${vzor}`).not.toMatch(vzor);
      }
    }
  });

  it('závisí jen na jádru', () => {
    const balik = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { dependencies?: Record<string, string> };
    expect(Object.keys(balik.dependencies ?? {})).toEqual(['@kontrola-tiketu/jadro']);
  });
});
