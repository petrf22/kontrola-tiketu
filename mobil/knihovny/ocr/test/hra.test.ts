import { describe, expect, it } from 'vitest';
import type { Hra } from '@kontrola-tiketu/jadro';
import { prectiKodDoplnkoveHry, rozpoznejHru, slozRadky } from '../src/index.js';
import { tiketEJ } from './pomocnici.js';
import { EUROJACKPOT_14_9, EUROMILIONY_14_9, ROVNE, SPORTKA_14_9 } from './tiketyZFotek.js';

const radky = (tiket: readonly string[][]) => slozRadky(tiketEJ(tiket), ROVNE).map((r) => r.text);

/** Tiket bez řádků, podle kterých se hra pozná — zbyde reklama, hlavička bez dnů a sloupce. */
const bez = (tiket: readonly string[][], ...vzory: RegExp[]) =>
  tiket.filter((casti) => !vzory.some((v) => v.test(casti.join(' '))));

const REKLAMA = 'EXTRA ŠANCE NA VÝHRU S ALLWYN KLUBEM.';

describe('rozpoznejHru — celé tikety ze 14. 9. 2026', () => {
  const pripady: [string, readonly string[][], Hra][] = [
    ['Eurojackpot', EUROJACKPOT_14_9, 'eurojackpot'],
    ['Sportka', SPORTKA_14_9, 'sportka'],
    ['Euromiliony', EUROMILIONY_14_9, 'euromiliony'],
  ];

  for (const [nazev, tiket, hra] of pripady) {
    it(`${nazev} bez čárového kódu`, () => {
      expect(rozpoznejHru(radky(tiket), null).hra).toBe(hra);
    });

    it(`${nazev} s čárovým kódem`, () => {
      expect(rozpoznejHru(radky(tiket), hra).hra).toBe(hra);
    });

    it(`${nazev} a kód jiné hry je rozpor, ne rozhodnutí`, () => {
      const jina = pripady.find(([, , h]) => h !== hra)![2];
      expect(rozpoznejHru(radky(tiket), jina).hra).toBeNull();
    });
  }

  it('řekne, podle čeho hru poznal', () => {
    expect(rozpoznejHru(radky(EUROMILIONY_14_9), 'euromiliony').podle).toEqual([
      'čárový kód',
      'popisek Eurošance',
      'název v logu',
      'pomlčka ve sloupci',
    ]);
  });
});

describe('rozpoznejHru — jednotlivé signály', () => {
  it('stačí samotný čárový kód', () => {
    expect(rozpoznejHru(['1: 01 02 03 04 05 06'], 'sportka')).toEqual({
      hra: 'sportka',
      podle: ['čárový kód'],
    });
  });

  it('stačí samotný popisek doplňkové hry', () => {
    expect(rozpoznejHru(['Extra 6:  123456  ANO'], null).hra).toBe('eurojackpot');
    expect(rozpoznejHru(['Šance:  654321  ANO'], null).hra).toBe('sportka');
    expect(rozpoznejHru(['Eurošance:  24680  ANO'], null).hra).toBe('euromiliony');
  });

  it('popisky snesou chybějící diakritiku a mezeru', () => {
    expect(rozpoznejHru(['SANCE: 654321'], null).hra).toBe('sportka');
    expect(rozpoznejHru(['EUROSANCE 24680'], null).hra).toBe('euromiliony');
    expect(rozpoznejHru(['Euro šance: 24680'], null).hra).toBe('euromiliony');
  });

  it('stačí samotné logo', () => {
    expect(rozpoznejHru(['EUROJACKPOT'], null).hra).toBe('eurojackpot');
    expect(rozpoznejHru(['EUR0JACKP.OT'], null).hra).toBe('eurojackpot');
    expect(rozpoznejHru(['sportka'], null).hra).toBe('sportka');
    expect(rozpoznejHru(['spVrtka'], null).hra).toBe('sportka');
    expect(rozpoznejHru(['Euromil!ony'], null).hra).toBe('euromiliony');
  });

  it('dny v hlavičce rozhodnou, jen když vyřadí všechny ostatní hry', () => {
    expect(rozpoznejHru(['SLOSOVÁNÍ: 4 (ÚT,PÁ) 15.09.2026'], null).hra).toBe('eurojackpot');
    expect(rozpoznejHru(['SLOSOVÁNÍ: 2 (NE) 20.09.2026'], null).hra).toBe('sportka');
    expect(rozpoznejHru(['SLOSOVÁNÍ: 2 (SO) 19.09.2026'], null).hra).toBe('euromiliony');
    // Pátek losuje Eurojackpot i Sportka.
    expect(rozpoznejHru(['SLOSOVÁNÍ: 2 (PÁ) 18.09.2026'], null).hra).toBeNull();
  });

  it('stačí pomlčka ve sloupci', () => {
    expect(rozpoznejHru(['1: 02 06 13 19 24 30 34  -  04 NT'], null).hra).toBe('euromiliony');
  });

  it('pomlčka v rozsahu dat hlavičky není pomlčka ve sloupci', () => {
    expect(rozpoznejHru(['SLOSOVÁNÍ: 4', '15.09.2026 - 26.09.2026'], null).hra).toBeNull();
  });
});

describe('rozpoznejHru — nehádá', () => {
  it('bez signálu vrátí null', () => {
    expect(rozpoznejHru([], null)).toEqual({ hra: null, podle: [] });
    expect(rozpoznejHru(['1: 03 11 24 36 48 02 09 NT'], null).hra).toBeNull();
  });

  it('tiket bez loga, popisku a kódu nechá hru na uživateli', () => {
    const holy = bez(EUROMILIONY_14_9, /Euromiliony/, /Eurošance/, /NT$/);
    expect(rozpoznejHru(radky(holy), null).hra).toBeNull();
  });

  it('reklama nahoře na všech tiketech sama žádnou hru nedá', () => {
    expect(rozpoznejHru([REKLAMA, 'NAVÍC JOKER NÁSOBÍ VÝHRY NA KOLE ŠTĚSTÍ.'], null)).toEqual({
      hra: null,
      podle: [],
    });
  });

  it('rozpor mezi logem a popiskem vrátí null', () => {
    expect(rozpoznejHru(['sportka', 'Extra 6:  123456  ANO'], null).hra).toBeNull();
  });

  it('Druhá šance není Šance Sportky', () => {
    expect(rozpoznejHru(['Druhá šance: 12345'], null).hra).toBeNull();
  });
});

describe('popisky doplňkové hry na skutečném rozvržení', () => {
  it('reklama nepřebije kód Šance pod ní', () => {
    expect(prectiKodDoplnkoveHry([REKLAMA, 'Šance:  654321  ANO'], 'sportka')).toBe('654321');
  });

  it('Eurošance se u Sportky nepřečte jako Šance', () => {
    expect(prectiKodDoplnkoveHry(['Eurošance:  246801  ANO'], 'sportka')).toBeNull();
    expect(prectiKodDoplnkoveHry(['Euro šance:  246801'], 'sportka')).toBeNull();
  });
});
