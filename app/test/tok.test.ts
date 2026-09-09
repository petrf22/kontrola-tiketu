import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sloucTahy, vyhodnotTiket, type Tah, type Tiket } from '@kontrola-tiketu/jadro';
import { nactiVysledky } from '../src/app/data/import.js';

/**
 * Celý tok aplikace na jednom místě: soubor od fetcheru → sloučení s tím, co už je uložené
 * → vyhodnocení tiketu. Přesně tohle dělá služba Stav, jen bez Angularu, takže se to dá
 * ověřit deterministicky a bez prohlížeče.
 *
 * Soubor je skutečný výstup fetcheru, ne ručně psaný — jinak by test neověřoval nic o tom,
 * jestli spolu obě strany doopravdy mluví.
 */
const SOUBOR = readFileSync(
  new URL('fixtures/vysledky-2026-35-az-37.json', import.meta.url),
  'utf8',
);

function tiketEJ(cisla: number[], eurocisla: number[], extra6: string | null): Tiket {
  return {
    id: 'test',
    hra: 'eurojackpot',
    sloupce: [{ hra: 'eurojackpot', cisla, eurocisla }],
    slosovani: { prvni: '2026-09-08', pocet: 1, dny: null },
    kodDoplnkoveHry: extra6,
    vlozeno: '2026-09-07T10:00:00Z',
  };
}

describe('od souboru k vyhodnocení', () => {
  const nactene = nactiVysledky(SOUBOR);
  const tahy: readonly Tah[] = nactene.stav === 'ok' ? nactene.tahy : [];
  const sazby = nactene.stav === 'ok' ? nactene.sazbyExtra6 : [];

  it('soubor od fetcheru se načte', () => {
    expect(nactene.stav).toBe('ok');
    expect(tahy.length).toBeGreaterThan(0);
    expect(sazby.length).toBeGreaterThan(0);
  });

  it('plná trefa dá I. pořadí s částkou z listiny', () => {
    // Tah 8. 9. 2026: 47 14 27 34 36, euročísla 4 3. Listina uvádí v I. pořadí nula
    // výherců i nula korun, takže se tu ověřuje i to, že se částka bere z listiny.
    const vysledek = vyhodnotTiket(tiketEJ([47, 14, 27, 34, 36], [4, 3], null), tahy, sazby);
    const vyhry = vysledek.slosovani[0]?.vyhry ?? [];
    expect(vyhry).toHaveLength(1);
    expect(vyhry[0]?.poradi).toBe('I');
    expect(vyhry[0]?.castkaKc).toBe(0);
  });

  it('výherní sloupec dá částku, kterou publikoval Allwyn', () => {
    // Čtyři hlavní a jedno euročíslo = V. pořadí, listina uvádí 5 780 Kč.
    const vysledek = vyhodnotTiket(tiketEJ([47, 14, 27, 34, 1], [4, 1], null), tahy, sazby);
    expect(vysledek.celkemKc).toBe(5780);
    expect(vysledek.soucetJisty).toBe(true);
  });

  it('Extra 6 se připočte a u první výhry se přizná výhrada', () => {
    const vysledek = vyhodnotTiket(tiketEJ([1, 2, 3, 4, 5], [11, 12], '912799'), tahy, sazby);
    const doplnkova = vysledek.slosovani[0]?.vyhry.find((v) => v.zdroj === 'doplnkova-hra');
    expect(doplnkova?.poradi).toBe('sestecisli');
    expect(doplnkova?.castkaKc).toBe(1_000_000);
    expect(doplnkova?.vyhrada).toBe('delene-prvni-poradi');
    expect(vysledek.soucetJisty).toBe(false);
  });

  it('bez naimportovaných výsledků se nula netváří jako prohra', () => {
    const vysledek = vyhodnotTiket(tiketEJ([47, 14, 27, 34, 36], [4, 3], null), [], sazby);
    expect(vysledek.celkemKc).toBe(0);
    expect(vysledek.chybejicichSlosovani).toBe(1);
    expect(vysledek.soucetJisty).toBe(false);
  });

  it('opakovaný import téhož souboru nic nezdvojí', () => {
    const jednou = sloucTahy([], tahy);
    const dvakrát = sloucTahy(jednou, tahy);
    expect(dvakrát).toHaveLength(jednou.length);
  });
});
