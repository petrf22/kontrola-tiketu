import { describe, expect, it } from 'vitest';
import {
  DNY_LOSOVANI,
  porovnejEuromiliony,
  urciPoradiEuromiliony,
  vyhodnotSloupecEuromiliony,
  type PoradiEuromiliony,
  type SloupecEuromiliony,
  type TahEuromiliony,
} from '../src/index.js';
import {
  EM_2026_09_01,
  EM_2026_09_08,
  EM_2026_09_12,
  VSECHNY_TAHY_EM,
} from './fixtures/euromiliony.js';

/**
 * Sestaví sloupec, který v daném tahu trefí přesně `hlavni` čísel z prvního osudí a `druhe`
 * (0 nebo 1) z druhého. Zbytek doplní čísly, která vylosovaná nebyla.
 */
function sloupecSeShodou(tah: TahEuromiliony, hlavni: number, druhe: number): SloupecEuromiliony {
  const netazena = (max: number, tazena: readonly number[]) =>
    Array.from({ length: max }, (_, i) => i + 1).filter((c) => !tazena.includes(c));

  return {
    hra: 'euromiliony',
    cisla: [...tah.cisla.slice(0, hlavni), ...netazena(35, tah.cisla).slice(0, 7 - hlavni)],
    druheOsudi: druhe === 1 ? [tah.druheOsudi] : [netazena(5, [tah.druheOsudi])[0]!],
  };
}

/** `7+1` → [7, 1], `7` → [7, 0]. Listina u shody bez druhého osudí `+0` nepíše. */
function shodaZPopisu(popis: string): [number, number] {
  const [h, d] = popis.split('+');
  return [Number(h), d === undefined ? 0 : Number(d)];
}

describe('urciPoradiEuromiliony', () => {
  it('mapuje všech deset výherních kombinací podle herního plánu', () => {
    const ocekavano: ReadonlyArray<[number, number, PoradiEuromiliony]> = [
      [7, 1, 'I'],
      [7, 0, 'II'],
      [6, 1, 'III'],
      [6, 0, 'IV'],
      [5, 1, 'V'],
      [5, 0, 'VI'],
      [4, 1, 'VII'],
      [4, 0, 'VIII'],
      [3, 1, 'IX'],
      [2, 1, 'X'],
    ];
    for (const [h, d, poradi] of ocekavano) {
      expect(urciPoradiEuromiliony(h, d), `${h}+${d}`).toBe(poradi);
    }
  });

  it('3+0, 2+0 a 1+1 nevyhrávají', () => {
    const nevyherni: ReadonlyArray<[number, number]> = [
      [3, 0], [2, 0], [1, 1], [1, 0], [0, 1], [0, 0],
    ];
    for (const [h, d] of nevyherni) {
      expect(urciPoradiEuromiliony(h, d), `${h}+${d}`).toBeNull();
    }
  });

  it('pokrývá všechny kombinace 0–7 čísel a 0–1 z druhého osudí', () => {
    let vyhernich = 0;
    for (let h = 0; h <= 7; h++) {
      for (let d = 0; d <= 1; d++) {
        if (urciPoradiEuromiliony(h, d) !== null) vyhernich++;
      }
    }
    expect(vyhernich).toBe(10);
  });
});

describe('porovnejEuromiliony', () => {
  it('vrací shodná čísla vzestupně a shodu v druhém osudí zvlášť', () => {
    // 2026-09-08: 18 17 28 3 2 12 22 | 5
    const sloupec: SloupecEuromiliony = {
      hra: 'euromiliony',
      cisla: [22, 1, 18, 4, 3, 6, 7],
      druheOsudi: [5],
    };
    const shoda = porovnejEuromiliony(sloupec, EM_2026_09_08);
    expect(shoda.hlavniCisla).toEqual([3, 18, 22]);
    expect(shoda.druheCisla).toEqual([5]);
    expect(shoda.hlavni).toBe(3);
    expect(shoda.druhe).toBe(1);
  });

  it('číslo z druhého osudí shodné s číslem z prvního se počítá jen do druhého osudí', () => {
    // 2026-09-12: 6 17 9 34 3 12 29 | 2 — dvojka mezi čísly prvního osudí není.
    const sloupec: SloupecEuromiliony = {
      hra: 'euromiliony',
      cisla: [2, 1, 4, 5, 7, 8, 10],
      druheOsudi: [2],
    };
    const shoda = porovnejEuromiliony(sloupec, EM_2026_09_12);
    expect(shoda.hlavni).toBe(0);
    expect(shoda.druhe).toBe(1);
  });
});

describe('vyhodnotSloupecEuromiliony proti oficiální tabulce výher', () => {
  for (const tah of VSECHNY_TAHY_EM) {
    it(`tah ${tah.datum} sedí ve všech deseti pořadích`, () => {
      for (const radek of tah.poradi) {
        const [h, d] = shodaZPopisu(radek.popis);
        const vysledek = vyhodnotSloupecEuromiliony(sloupecSeShodou(tah, h, d), tah);
        expect(vysledek.poradi, `${tah.datum} ${radek.popis}`).toBe(radek.klic);
        expect(vysledek.vyseVyhryKc, `${tah.datum} ${radek.popis}`).toBe(radek.vyseVyhryKc);
      }
    });
  }

  it('konkrétní kontrola: 6+1 v tahu 8. 9. 2026 dává 22 047 Kč', () => {
    const sloupec: SloupecEuromiliony = {
      hra: 'euromiliony',
      cisla: [18, 17, 28, 3, 2, 12, 1],
      druheOsudi: [5],
    };
    const vysledek = vyhodnotSloupecEuromiliony(sloupec, EM_2026_09_08);
    expect(vysledek.poradi).toBe('III');
    expect(vysledek.vyseVyhryKc).toBe(22047);
  });

  it('stejná shoda dá v jiném tahu jinou částku — částky nesmí být v kódu', () => {
    const petPlusJedna = (tah: TahEuromiliony) =>
      vyhodnotSloupecEuromiliony(sloupecSeShodou(tah, 5, 1), tah).vyseVyhryKc;
    expect(petPlusJedna(EM_2026_09_01)).toBe(4913);
    expect(petPlusJedna(EM_2026_09_08)).toBe(3100);
    expect(petPlusJedna(EM_2026_09_12)).toBe(1527);
  });

  it('3+0 nevyhrává, i když 3+1 ano', () => {
    const tah = EM_2026_09_08;
    expect(vyhodnotSloupecEuromiliony(sloupecSeShodou(tah, 3, 0), tah).poradi).toBeNull();
    expect(vyhodnotSloupecEuromiliony(sloupecSeShodou(tah, 3, 1), tah).vyseVyhryKc).toBe(108);
  });
});

describe('fixtury odpovídají výherní listině', () => {
  it('každý tah má deset pořadí, sedm čísel a pětimístnou Eurošanci', () => {
    for (const tah of VSECHNY_TAHY_EM) {
      expect(tah.poradi, tah.datum).toHaveLength(10);
      expect(tah.cisla, tah.datum).toHaveLength(7);
      expect(tah.druheOsudi, tah.datum).toBeGreaterThanOrEqual(1);
      expect(tah.druheOsudi, tah.datum).toBeLessThanOrEqual(5);
      expect(tah.eurosance, tah.datum).toMatch(/^[0-9]{5}$/);
    }
  });

  it('losuje se v úterý a v sobotu, jak nabízí formulář tiketu', () => {
    const dny = new Set(VSECHNY_TAHY_EM.map((t) => t.den));
    expect(dny).toEqual(new Set(DNY_LOSOVANI.euromiliony));
  });
});
