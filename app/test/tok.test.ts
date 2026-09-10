import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sloucTahy, vyhodnotTiket, type Tah, type Tiket } from '@kontrola-tiketu/jadro';
import { createHash } from 'node:crypto';
import { nactiVysledky } from '../src/app/data/import.js';
import { stahniVysledky, ZAKLADNI_URL, type Sit } from '../src/app/data/stahovani.js';
import { shrnutiStazeni, zpracujStazene } from '../src/app/data/vysledkyZeServeru.js';

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
    cenaKc: null,
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

/**
 * Tatáž cesta, jen výsledky nepřijdou souborem, ale ze serveru. Balík na serveru je přesně
 * tentýž soubor, takže vyhodnocení musí vyjít stejně.
 */
describe('od serveru k vyhodnocení', () => {
  const bajty = new Uint8Array(readFileSync(new URL('fixtures/vysledky-2026-35-az-37.json', import.meta.url)));
  const hash = `sha256:${createHash('sha256').update(bajty).digest('hex')}`;
  const manifest = new TextEncoder().encode(
    JSON.stringify({ verzeManifestu: 1, kontrola: {}, baliky: [{ soubor: '2026.json', hash }] }),
  );
  const sit: Sit = async (url) =>
    url === `${ZAKLADNI_URL}manifest.json`
      ? { stav: 200, telo: manifest }
      : url === `${ZAKLADNI_URL}2026.json`
        ? { stav: 200, telo: bajty }
        : { stav: 404, telo: new Uint8Array() };

  it('stažený balík vyhodnotí tiket stejně jako soubor', async () => {
    const stazeno = await stahniVysledky(sit, new Map());
    if (stazeno.stav !== 'ok') throw new Error(stazeno.duvod);
    const zpracovano = zpracujStazene([], stazeno.nove);
    if (zpracovano.stav !== 'ok') throw new Error(zpracovano.duvod);

    const tahy = sloucTahy([], zpracovano.baliky.flatMap((b) => b.tahy));
    const sazby = zpracovano.baliky[0]!.sazbyExtra6;
    const vysledek = vyhodnotTiket(tiketEJ([47, 14, 27, 34, 1], [4, 1], null), tahy, sazby);
    expect(vysledek.celkemKc).toBe(5780);
    expect(shrnutiStazeni(zpracovano.pribylo, zpracovano.zmeneno)).toBe('Staženo: 6 nových tahů.');
  });

  it('podruhé už nic nestahuje a nic nepřibude', async () => {
    const stazeno = await stahniVysledky(sit, new Map([['2026.json', hash]]));
    expect(stazeno).toMatchObject({ stav: 'ok', nove: [] });
    expect(shrnutiStazeni(0, 0)).toBe('Výsledky jsou aktuální, nic nového.');
  });

  it('doplněná tabulka výher se pozná jako změna, ne jako nový tah', () => {
    const nactene = nactiVysledky(SOUBOR);
    if (nactene.stav !== 'ok') throw new Error(nactene.duvod);
    const bezTabulky = nactene.tahy.map((t) => (t.hra === 'eurojackpot' ? { ...t, poradi: [] } : t));
    const zpracovano = zpracujStazene(bezTabulky, [{ soubor: '2026.json', hash, text: SOUBOR }]);
    expect(zpracovano).toMatchObject({ stav: 'ok', pribylo: 0, zmeneno: 3 });
    expect(shrnutiStazeni(0, 3)).toBe('Staženo: 3 doplněné tahy.');
  });

  it('balík, který nejde přečíst, se neuloží ani zčásti', () => {
    const zpracovano = zpracujStazene([], [
      { soubor: '2025.json', hash, text: SOUBOR },
      { soubor: '2026.json', hash, text: '{"verzeFormatu": 99}' },
    ]);
    expect(zpracovano.stav).toBe('chyba');
  });
});
