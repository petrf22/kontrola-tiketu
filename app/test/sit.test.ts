import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Náhrada za záruku, kterou dřív dávala absence oprávnění INTERNET.
 *
 * Aplikace dnes na síť smí, ale jen pro stažení veřejných výsledků. Věta, která to má držet,
 * zní: **síť sahá jediný modul a ten o tiketech neví.** Tenhle test z ní dělá něco
 * vymahatelného — stejně jako `packages/jadro/test/bezIO.test.ts` drží jádro bez I/O.
 */

const SRC = new URL('../src/', import.meta.url).pathname;
const SITOVY_MODUL = 'app/data/stahovani.ts';

/** Všechno, čím webview nebo Capacitor umí poslat něco ven. */
const SITOVE_API = [
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /\bCapacitorHttp\b/,
  /\bHttpClient\b/,
  /provideHttpClient/,
  /\bWebSocket\b/,
  /\bEventSource\b/,
  /sendBeacon/,
  /\bnew\s+Image\s*\(/,
];

function zdrojaky(adresar = SRC): { jmeno: string; kod: string }[] {
  return readdirSync(adresar).flatMap((j) => {
    const cesta = join(adresar, j);
    if (statSync(cesta).isDirectory()) return zdrojaky(cesta);
    if (!/\.(ts|html)$/.test(j)) return [];
    const obsah = readFileSync(cesta, 'utf8');
    // Komentáře se nekontrolují — o síti mluví právě proto, že se tam nepoužívá.
    const kod = obsah.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    return [{ jmeno: relative(SRC, cesta), kod }];
  });
}

describe('síť sahá jediný modul', () => {
  const soubory = zdrojaky();

  it('má co kontrolovat, jinak by test nic nedokazoval', () => {
    expect(soubory.length).toBeGreaterThan(15);
    expect(soubory.map((s) => s.jmeno)).toContain(SITOVY_MODUL);
  });

  it('síťová API se nevyskytují nikde jinde', () => {
    for (const { jmeno, kod } of soubory) {
      if (jmeno === SITOVY_MODUL) continue;
      for (const vzor of SITOVE_API) {
        expect(kod, `${jmeno} používá ${vzor}`).not.toMatch(vzor);
      }
    }
  });

  it('síťový modul nezná tikety, stav ani úložiště', () => {
    const kod = soubory.find((s) => s.jmeno === SITOVY_MODUL)!.kod;
    const importy = [...kod.matchAll(/^import\s[\s\S]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
    // Jen Capacitor a adresa. Žádné jádro (Tiket), žádný stav, žádné úložiště — nemá jak
    // se k tiketům dostat.
    expect(importy).toEqual(['@capacitor/core', './adresa-backendu.js']);
    expect(kod).not.toMatch(/\bTiket\b/);
  });

  it('dotaz nenese parametry ani podmíněné hlavičky', () => {
    const kod = soubory.find((s) => s.jmeno === SITOVY_MODUL)!.kod;
    expect(kod).not.toMatch(/URLSearchParams|\bparams\s*:/);
    expect(kod).not.toMatch(/If-None-Match|If-Modified-Since|Cookie/i);
    expect(kod).not.toMatch(/method\s*:\s*['"](POST|PUT|PATCH|DELETE)/i);
  });

  it('adresa backendu je v aplikaci jen na jednom místě', () => {
    const vyskyty = soubory.filter((s) => s.kod.includes('/v1/')).map((s) => s.jmeno).sort();
    expect(vyskyty).toEqual(['app/data/adresa-backendu.ts', 'app/data/adresa-backendu.vyvoj.ts']);
  });

  it('sestavení pro telefon nenahrazuje adresu lokální vývojovou', () => {
    const angular = JSON.parse(readFileSync(new URL('../angular.json', import.meta.url), 'utf8'));
    const projekt = Object.values(angular.projects)[0] as {
      architect: { build: { defaultConfiguration: string; configurations: Record<string, { fileReplacements?: unknown[] }> } };
    };
    const build = projekt.architect.build;
    expect(build.defaultConfiguration).toBe('production');
    expect(build.configurations['production']!.fileReplacements).toBeUndefined();
    expect(readFileSync(join(SRC, 'app/data/adresa-backendu.ts'), 'utf8')).toMatch(/'https:\/\//);
  });
});
