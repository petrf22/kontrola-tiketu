import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { rozpisCenyTiketu, vyhodnotTiket, type Hra } from '@kontrola-tiketu/jadro';
import { naTiket, prectiTiket } from '@kontrola-tiketu/ocr';
import { tiketEJ } from '../knihovny/ocr/test/pomocnici.js';
import { ROVNE } from '../knihovny/ocr/test/tiketyZFotek.js';
import { nactiVysledky } from '../src/app/data/import.js';

/**
 * Skutečné tikety uživatele (fotky z 2. 10. 2026) a výhra, kterou za ně vyplatila prodejna.
 * Přepis fotky → čtení tiketu → vyhodnocení proti výsledkům ze serveru. Čísla jsou skutečná
 * se svolením uživatele (4. 10. 2026); výhra je napsaná rukou na tiketu, cena vytištěná.
 */
const balik = nactiVysledky(readFileSync(new URL('fixtures/vysledky-2026-38-az-40.json', import.meta.url), 'utf8'));
if (balik.stav !== 'ok') throw new Error('Fixtura výsledků se nenačetla.');

const REKLAMA = [['EXTRA ŠANCE NA VÝHRU S ALLWYN KLUBEM.'], ['NAVÍC JOKER NÁSOBÍ VÝHRY NA KOLE ŠTĚSTÍ.']];
const CARA = ['------------------------------------------------'];

const TIKETY: [string, Hra, string[][], number, number][] = [
  ['Sportka 6× se Šancí', 'sportka', [['sportka'], ['allwyn'], ...REKLAMA, ['SLOSOVÁNÍ: 6 (ST,PÁ,NE) 16.09.2026-27.09.2026'], CARA,
    ['1:  02 08 27 34 43 46  NT'], ['2:  13 15 22 37 46 47  NT'], ['3:  04 10 16 25 42 47  NT'], CARA,
    ['Šance:  229087', 'ANO'], ['14.09.2026  720 Kč', '11:21:14'], CARA], 720, 752],
  ['Eurojackpot 4× s Extra 6', 'eurojackpot', [['EUROJACKPOT'], ...REKLAMA, ['SLOSOVÁNÍ: 4 (ÚT,PÁ)', '15.09.2026-25.09.2026'], CARA,
    ['1: 01 06 07 35 49', '01 12 NT'], ['2: 01 28 38 42 47', '08 12 NT'], CARA,
    ['Extra 6:', '895373', 'ANO'], ['14.09.2026  640 Kč', '11:20:36'], CARA], 640, 60],
  ['Euromiliony 4× s Eurošancí', 'euromiliony', [['Euromiliony'], ...REKLAMA, ['SLOSOVÁNÍ: 4', '15.09.2026-26.09.2026'], CARA,
    ['1: 01 07 15 22 23 25 29  -  05 NT'], ['2: 02 11 12 15 19 27 33  -  03 NT'], CARA,
    ['Eurošance:', '18546', 'ANO'], ['14.09.2026  360 Kč', '11:20:53'], CARA], 360, 60],
  ['Eurojackpot 25. 9.', 'eurojackpot', [['EUROJACKPOT'], ...REKLAMA, ['SLOSOVÁNÍ: 1 (PÁ)', '25.09.2026'], CARA,
    ['1: 29 31 33 42 46', '05 08 NT'], ['2: 06 10 34 39 43', '02 09 NT'], ['3: 01 25 37 41 42', '06 10 NT'],
    ['4: 12 31 38 41 49', '05 07 NT'], ['5: 07 12 24 40 42', '01 03 NT'], ['6: 01 02 11 23 24', '08 12 NT'], CARA,
    ['Extra 6:', '567500', 'ANO'], ['23.09.2026  400 Kč', '16:58:55'], CARA], 400, 0],
  ['Eurojackpot 29. 9., obnovení sázky', 'eurojackpot', [['EUROJACKPOT'], ...REKLAMA, ['OBNOVENÍ SÁZKY'], ['SLOSOVÁNÍ: 1 (ÚT)', '29.09.2026'], CARA,
    ['1: 17 25 27 32 41', '06 08'], ['2: 07 11 24 33 42', '02 08'], ['3: 04 08 09 32 45', '04 05'],
    ['4: 09 12 27 33 39', '03 08'], ['5: 24 29 35 36 44', '04 09'], ['6: 01 02 09 10 13', '06 07'], CARA,
    ['Extra 6:', '729429', 'ANO'], ['29.09.2026  400 Kč', '16:05:37'], CARA], 400, 60],
  ['Eurojackpot 29. 9., koncové číslo Extra 6', 'eurojackpot', [['EUROJACKPOT'], ...REKLAMA, ['SLOSOVÁNÍ: 1 (ÚT)', '29.09.2026'], CARA,
    ['1: 17 31 38 42 45', '05 07 NT'], ['2: 03 17 32 35 38', '04 07 NT'], ['3: 03 14 16 26 40', '05 07 NT'],
    ['4: 17 20 28 41 43', '02 07 NT'], ['5: 04 09 11 17 39', '01 10 NT'], ['6: 03 06 24 48 50', '09 10 NT'], CARA,
    ['Extra 6:', '154550', 'ANO'], ['29.09.2026  400 Kč', '16:06:00'], CARA], 400, 60],
  ['Eurojackpot 29. 9. bez výhry', 'eurojackpot', [['EUROJACKPOT'], ...REKLAMA, ['SLOSOVÁNÍ: 1 (ÚT)', '29.09.2026'], CARA,
    ['1: 08 15 24 29 43', '01 12 NT'], ['2: 02 04 20 37 40', '04 05 NT'], ['3: 05 11 13 30 42', '06 12 NT'],
    ['4: 04 16 21 28 42', '05 07 NT'], ['5: 04 08 14 16 26', '09 12 NT'], ['6: 06 08 10 14 50', '02 07 NT'], CARA,
    ['Extra 6:', '164272', 'ANO'], ['29.09.2026  400 Kč', '14:52:37'], CARA], 400, 0],
];

describe('skutečné tikety uživatele s vyplacenou výhrou', () => {
  for (const [nazev, hra, radky, cenaKc, vyhraKc] of TIKETY) {
    it(`${nazev}: cena ${cenaKc} Kč, výhra ${vyhraKc} Kč`, () => {
      const tiket = naTiket(prectiTiket(tiketEJ(radky), hra, ROVNE), { id: nazev });
      expect(tiket.cenaKc).toBe(cenaKc);
      expect(rozpisCenyTiketu(tiket, balik.ceny)?.celkemKc).toBe(cenaKc);
      const vysledek = vyhodnotTiket(tiket, balik.tahy, balik.sazbyExtra6, balik.sazbyEurosance, balik.ceny);
      expect(vysledek.soucetJisty).toBe(true);
      expect(vysledek.celkemKc).toBe(vyhraKc);
    });
  }
});
