import { describe, expect, it } from 'vitest';
import {
  porovnejEurojackpot,
  urciPoradiEurojackpot,
  vyhodnotSloupecEurojackpot,
  type PoradiEurojackpot,
  type SloupecEurojackpot,
  type TahEurojackpot,
} from '../src/index.js';
import {
  EJ_2026_09_01,
  EJ_2026_09_04,
  EJ_2026_09_08,
  VSECHNY_TAHY_EJ,
} from './fixtures/eurojackpot.js';

/**
 * Sestaví sloupec, který v daném tahu trefí přesně `hlavni` hlavních čísel a `euro` euročísel.
 * Zbytek doplní čísly, která vylosovaná nebyla, aby shoda byla přesně požadovaná.
 */
function sloupecSeShodou(tah: TahEurojackpot, hlavni: number, euro: number): SloupecEurojackpot {
  const netazena = (max: number, tazena: readonly number[]) =>
    Array.from({ length: max }, (_, i) => i + 1).filter((c) => !tazena.includes(c));

  return {
    hra: 'eurojackpot',
    cisla: [...tah.cisla.slice(0, hlavni), ...netazena(50, tah.cisla).slice(0, 5 - hlavni)],
    eurocisla: [
      ...tah.eurocisla.slice(0, euro),
      ...netazena(12, tah.eurocisla).slice(0, 2 - euro),
    ],
  };
}

describe('urciPoradiEurojackpot', () => {
  it('mapuje všech dvanáct výherních kombinací podle herního plánu', () => {
    const ocekavano: ReadonlyArray<[number, number, PoradiEurojackpot]> = [
      [5, 2, 'I'],
      [5, 1, 'II'],
      [5, 0, 'III'],
      [4, 2, 'IV'],
      [4, 1, 'V'],
      [3, 2, 'VI'],
      [4, 0, 'VII'],
      [2, 2, 'VIII'],
      [3, 1, 'IX'],
      [3, 0, 'X'],
      [1, 2, 'XI'],
      [2, 1, 'XII'],
    ];
    for (const [h, e, poradi] of ocekavano) {
      expect(urciPoradiEurojackpot(h, e), `${h}+${e}`).toBe(poradi);
    }
  });

  it('nevýherní kombinace vrací null', () => {
    const nevyherni: ReadonlyArray<[number, number]> = [
      [0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [0, 2],
    ];
    for (const [h, e] of nevyherni) {
      expect(urciPoradiEurojackpot(h, e), `${h}+${e}`).toBeNull();
    }
  });

  it('pokrývá všechny kombinace 0–5 hlavních a 0–2 euročísel', () => {
    let vyhernich = 0;
    for (let h = 0; h <= 5; h++) {
      for (let e = 0; e <= 2; e++) {
        if (urciPoradiEurojackpot(h, e) !== null) vyhernich++;
      }
    }
    expect(vyhernich).toBe(12);
  });
});

describe('porovnejEurojackpot', () => {
  it('nezáleží na pořadí čísel ve sloupci', () => {
    const tah = EJ_2026_09_08; // 47 14 27 34 36 | 4 3
    const a: SloupecEurojackpot = { hra: 'eurojackpot', cisla: [47, 14, 27, 34, 36], eurocisla: [4, 3] };
    const b: SloupecEurojackpot = { hra: 'eurojackpot', cisla: [36, 27, 47, 34, 14], eurocisla: [3, 4] };
    expect(porovnejEurojackpot(a, tah)).toEqual(porovnejEurojackpot(b, tah));
  });

  it('vrací shodná čísla vzestupně kvůli zvýraznění v UI', () => {
    const sloupec: SloupecEurojackpot = {
      hra: 'eurojackpot',
      cisla: [47, 36, 14, 1, 2],
      eurocisla: [4, 1],
    };
    const shoda = porovnejEurojackpot(sloupec, EJ_2026_09_08);
    expect(shoda.hlavniCisla).toEqual([14, 36, 47]);
    expect(shoda.euroCisla).toEqual([4]);
    expect(shoda.hlavni).toBe(3);
    expect(shoda.euro).toBe(1);
  });

  it('euročíslo shodné s hlavním číslem se počítá jen do euročísel', () => {
    // 2026-09-04: hlavní 14 43 33 5 31, euročísla 4 3 — číslo 4 není mezi hlavními.
    const sloupec: SloupecEurojackpot = {
      hra: 'eurojackpot',
      cisla: [4, 1, 2, 6, 7],
      eurocisla: [4, 1],
    };
    const shoda = porovnejEurojackpot(sloupec, EJ_2026_09_04);
    expect(shoda.hlavni).toBe(0);
    expect(shoda.euro).toBe(1);
  });
});

describe('vyhodnotSloupecEurojackpot proti oficiální tabulce výher', () => {
  // Každý tah: pro všech 12 pořadí zkontrolujeme, že vyhodnocení vrátí právě tu částku,
  // kterou u daného pořadí publikovala výherní listina.
  for (const tah of VSECHNY_TAHY_EJ) {
    it(`tah ${tah.datum} sedí ve všech dvanácti pořadích`, () => {
      for (const radek of tah.poradi) {
        const [h, e] = radek.popis.split('+').map(Number) as [number, number];
        const vysledek = vyhodnotSloupecEurojackpot(sloupecSeShodou(tah, h, e), tah);
        expect(vysledek.poradi, `${tah.datum} ${radek.popis}`).toBe(radek.klic);
        expect(vysledek.vyseVyhryKc, `${tah.datum} ${radek.popis}`).toBe(radek.vyseVyhryKc);
      }
    });
  }

  it('konkrétní kontrola: 4+1 v tahu 8. 9. 2026 dává 5 780 Kč', () => {
    const sloupec: SloupecEurojackpot = {
      hra: 'eurojackpot',
      cisla: [47, 14, 27, 34, 1],
      eurocisla: [4, 1],
    };
    const vysledek = vyhodnotSloupecEurojackpot(sloupec, EJ_2026_09_08);
    expect(vysledek.poradi).toBe('V');
    expect(vysledek.vyseVyhryKc).toBe(5780);
  });

  it('stejný sloupec dá v jiném tahu jinou částku — částky nesmí být v kódu', () => {
    const ctyriPlusJedna = (tah: TahEurojackpot) =>
      vyhodnotSloupecEurojackpot(sloupecSeShodou(tah, 4, 1), tah).vyseVyhryKc;
    expect(ctyriPlusJedna(EJ_2026_09_01)).toBe(7837);
    expect(ctyriPlusJedna(EJ_2026_09_04)).toBe(7902);
    expect(ctyriPlusJedna(EJ_2026_09_08)).toBe(5780);
  });

  it('nulový počet výherců neznamená nulovou výhru', () => {
    // Listina u 2026-09-08 uvádí v II. pořadí 0 výherců a přesto 15 070 584 Kč.
    // Vyhodnocení se musí řídit shodou čísel, ne počtem výherců.
    const druhePoradi = EJ_2026_09_08.poradi.find((p) => p.klic === 'II');
    expect(druhePoradi?.pocetVyher).toBe(0);
    const vysledek = vyhodnotSloupecEurojackpot(sloupecSeShodou(EJ_2026_09_08, 5, 1), EJ_2026_09_08);
    expect(vysledek.poradi).toBe('II');
    expect(vysledek.vyseVyhryKc).toBe(15070584);
  });

  it('nevýherní sloupec nemá pořadí ani částku', () => {
    const vysledek = vyhodnotSloupecEurojackpot(sloupecSeShodou(EJ_2026_09_08, 2, 0), EJ_2026_09_08);
    expect(vysledek.shoda.hlavni).toBe(2);
    expect(vysledek.poradi).toBeNull();
    expect(vysledek.vyseVyhryKc).toBeNull();
  });

  it('chybějící pořadí v tabulce tahu se pozná podle vyplněného pořadí bez částky', () => {
    const bezPrvnihoPoradi: TahEurojackpot = {
      ...EJ_2026_09_08,
      poradi: EJ_2026_09_08.poradi.filter((p) => p.klic !== 'I'),
    };
    const vysledek = vyhodnotSloupecEurojackpot(sloupecSeShodou(bezPrvnihoPoradi, 5, 2), bezPrvnihoPoradi);
    expect(vysledek.poradi).toBe('I');
    expect(vysledek.vyseVyhryKc).toBeNull();
  });
});

describe('fixtury odpovídají výherní listině', () => {
  it('každý tah má právě dvanáct pořadí a pět plus dvě čísla', () => {
    for (const tah of VSECHNY_TAHY_EJ) {
      expect(tah.poradi, tah.datum).toHaveLength(12);
      expect(tah.cisla, tah.datum).toHaveLength(5);
      expect(tah.eurocisla, tah.datum).toHaveLength(2);
      expect(tah.extra6, tah.datum).toMatch(/^[0-9]{6}$/);
    }
  });

  it('Extra 6 si drží vedoucí nulu', () => {
    // 2026-09-04 mělo vylosováno 0 5 7 7 3 9; jako číslo by se nula ztratila.
    expect(EJ_2026_09_04.extra6).toBe('057739');
  });
});
