import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { rozpisCenyTiketu, type Hra } from '@kontrola-tiketu/jadro';
import { naTiket, prectiTiket } from '@kontrola-tiketu/ocr';
import { tiketEJ } from '../knihovny/ocr/test/pomocnici.js';
import { EUROJACKPOT_14_9, EUROMILIONY_14_9, ROVNE, SPORTKA_14_9 } from '../knihovny/ocr/test/tiketyZFotek.js';
import { nactiVysledky } from '../src/app/data/import.js';

/**
 * Cena podle ceníku proti ceně vytištěné na skutečných tiketech ze 14. 9. 2026: přepis fotky
 * → čtení tiketu → ceník z balíku backendu. Ceny jsou z papíru, nic se nevymýšlí.
 */
const balik = nactiVysledky(readFileSync(new URL('fixtures/vysledky-2026-35-az-37.json', import.meta.url), 'utf8'));
const ceny = balik.stav === 'ok' ? balik.ceny : [];

describe('cena tiketu z fotky sedí s ceníkem', () => {
  const pripady: [string, readonly string[][], Hra, number, string][] = [
    ['Eurojackpot', EUROJACKPOT_14_9, 'eurojackpot', 640, '(2 × 60 + 40) × 4'],
    ['Sportka', SPORTKA_14_9, 'sportka', 720, '(3 × 30 + 30) × 6'],
    ['Euromiliony', EUROMILIONY_14_9, 'euromiliony', 360, '(2 × 30 + 30) × 4'],
  ];

  for (const [nazev, radky, hra, vytistena, vzorec] of pripady) {
    it(`${nazev}: ${vzorec} = ${vytistena} Kč`, () => {
      const tiket = naTiket(prectiTiket(tiketEJ(radky), hra, ROVNE), { id: nazev });
      expect(tiket.cenaKc).toBe(vytistena);
      expect(rozpisCenyTiketu(tiket, ceny)?.celkemKc).toBe(vytistena);
    });
  }
});
