import { describe, expect, it } from 'vitest';
import {
  porovnejSportka,
  urciPoradiSportka,
  vyhodnotSloupecSportka,
  vyhodnotSloupecVObouTazich,
  type SloupecSportka,
  type SportkaTah,
} from '../src/index.js';
import {
  SP_2015_03_04,
  SP_2026_09_02,
  SP_2026_09_04,
  VSECHNY_TAHY_SPORTKA,
} from './fixtures/sportka.js';

/** Sestaví sloupec, který v daném tahu trefí přesně `cisel` čísel a volitelně dodatkové. */
function sloupecSeShodou(tah: SportkaTah, cisel: number, dodatkove: boolean): SloupecSportka {
  const zakazana = new Set([...tah.cisla, tah.dodatkove]);
  const vypln = Array.from({ length: 49 }, (_, i) => i + 1).filter((c) => !zakazana.has(c));
  const zbyva = 6 - cisel - (dodatkove ? 1 : 0);
  return {
    hra: 'sportka',
    cisla: [
      ...tah.cisla.slice(0, cisel),
      ...(dodatkove ? [tah.dodatkove] : []),
      ...vypln.slice(0, zbyva),
    ],
  };
}

describe('urciPoradiSportka', () => {
  it('mapuje pořadí podle herního plánu', () => {
    expect(urciPoradiSportka(6, false)).toBe('I');
    expect(urciPoradiSportka(5, true)).toBe('II');
    expect(urciPoradiSportka(5, false)).toBe('III');
    expect(urciPoradiSportka(4, false)).toBe('IV');
    expect(urciPoradiSportka(3, false)).toBe('V');
  });

  it('dodatkové číslo rozhoduje jen při shodě pěti čísel', () => {
    expect(urciPoradiSportka(6, true)).toBe('I');
    expect(urciPoradiSportka(4, true)).toBe('IV');
    expect(urciPoradiSportka(3, true)).toBe('V');
    expect(urciPoradiSportka(2, true)).toBeNull();
  });

  it('dvě a méně uhodnutých čísel nevyhrává', () => {
    for (const cisel of [0, 1, 2]) {
      expect(urciPoradiSportka(cisel, false), `${cisel}`).toBeNull();
    }
  });

  it('nikdy nevrací Bonus — ten nezávisí na jednom sloupci', () => {
    for (let cisel = 0; cisel <= 6; cisel++) {
      for (const dodatkove of [true, false]) {
        expect(urciPoradiSportka(cisel, dodatkove)).not.toBe('bonus');
      }
    }
  });
});

describe('porovnejSportka', () => {
  const prvniTah = SP_2026_09_02.tahy[0]; // 21 5 37 18 34 19, dodatkové 42

  it('vrací shodná čísla vzestupně', () => {
    const sloupec: SloupecSportka = { hra: 'sportka', cisla: [37, 5, 21, 2, 3, 4] };
    const shoda = porovnejSportka(sloupec, prvniTah);
    expect(shoda.cisla).toEqual([5, 21, 37]);
    expect(shoda.cisel).toBe(3);
  });

  it('pozná dodatkové číslo ve sloupci', () => {
    const s: SloupecSportka = { hra: 'sportka', cisla: [42, 1, 2, 3, 4, 6] };
    expect(porovnejSportka(s, prvniTah).dodatkove).toBe(true);
    expect(porovnejSportka(s, prvniTah).cisel).toBe(0);
  });

  it('dodatkové číslo se nepočítá mezi uhodnutá čísla', () => {
    const sloupec = sloupecSeShodou(prvniTah, 5, true);
    const shoda = porovnejSportka(sloupec, prvniTah);
    expect(shoda.cisel).toBe(5);
    expect(shoda.dodatkove).toBe(true);
  });
});

describe('vyhodnotSloupecSportka proti oficiální tabulce výher', () => {
  for (const slosovani of VSECHNY_TAHY_SPORTKA) {
    for (const tah of slosovani.tahy) {
      it(`${slosovani.datum}, ${tah.poradiTahu}. tah sedí ve všech pořadích`, () => {
        const ocekavano: ReadonlyArray<[number, boolean, string]> = [
          [6, false, 'I'],
          [5, true, 'II'],
          [5, false, 'III'],
          [4, false, 'IV'],
          [3, false, 'V'],
        ];
        for (const [cisel, dodatkove, klic] of ocekavano) {
          const radek = tah.poradi.find((p) => p.klic === klic);
          const vysledek = vyhodnotSloupecSportka(sloupecSeShodou(tah, cisel, dodatkove), tah);
          expect(vysledek.poradi, `${slosovani.datum} ${klic}`).toBe(klic);
          expect(vysledek.vyseVyhryKc, `${slosovani.datum} ${klic}`).toBe(radek?.vyseVyhryKc);
        }
      });
    }
  }

  it('konkrétní kontrola: 5+dodatkové v 1. tahu 2. 9. 2026 dává 985 862 Kč', () => {
    const tah = SP_2026_09_02.tahy[0];
    const sloupec: SloupecSportka = { hra: 'sportka', cisla: [21, 5, 37, 18, 34, 42] };
    const vysledek = vyhodnotSloupecSportka(sloupec, tah);
    expect(vysledek.poradi).toBe('II');
    expect(vysledek.vyseVyhryKc).toBe(985862);
  });

  it('týž sloupec bez dodatkového čísla spadne do III. pořadí a na jinou částku', () => {
    const tah = SP_2026_09_02.tahy[0];
    const sloupec: SloupecSportka = { hra: 'sportka', cisla: [21, 5, 37, 18, 34, 1] };
    const vysledek = vyhodnotSloupecSportka(sloupec, tah);
    expect(vysledek.poradi).toBe('III');
    expect(vysledek.vyseVyhryKc).toBe(18994);
  });

  it('stejná shoda dává v různých tazích různé částky', () => {
    const ctyri = (tah: SportkaTah) =>
      vyhodnotSloupecSportka(sloupecSeShodou(tah, 4, false), tah).vyseVyhryKc;
    expect(ctyri(SP_2026_09_02.tahy[0])).toBe(889);
    expect(ctyri(SP_2026_09_02.tahy[1])).toBe(1036);
    expect(ctyri(SP_2026_09_04.tahy[0])).toBe(947);
    expect(ctyri(SP_2015_03_04.tahy[0])).toBe(697);
  });

  it('nevýherní sloupec nemá pořadí ani částku', () => {
    const tah = SP_2026_09_02.tahy[0];
    const vysledek = vyhodnotSloupecSportka(sloupecSeShodou(tah, 2, false), tah);
    expect(vysledek.poradi).toBeNull();
    expect(vysledek.vyseVyhryKc).toBeNull();
  });
});

describe('vyhodnotSloupecVObouTazich', () => {
  it('sloupec hraje v obou tazích — jedna sázka, dvě vyhodnocení', () => {
    const sloupec: SloupecSportka = { hra: 'sportka', cisla: [21, 5, 37, 18, 34, 19] };
    const [prvni, druhy] = vyhodnotSloupecVObouTazich(sloupec, SP_2026_09_02);
    expect(prvni.poradiTahu).toBe(1);
    expect(druhy.poradiTahu).toBe(2);
    // Ve 1. tahu je to plná shoda, ve 2. tahu jen jedno číslo (34).
    expect(prvni.poradi).toBe('I');
    expect(druhy.shoda.cisla).toEqual([34]);
    expect(druhy.poradi).toBeNull();
  });

  it('sloupec může vyhrát v obou tazích zároveň', () => {
    // 1. tah 21 5 37 18 34 19, 2. tah 40 15 34 32 24 22 — 34 je v obou.
    const sloupec: SloupecSportka = { hra: 'sportka', cisla: [21, 5, 34, 40, 15, 32] };
    const [prvni, druhy] = vyhodnotSloupecVObouTazich(sloupec, SP_2026_09_02);
    expect(prvni.poradi).toBe('V');
    expect(druhy.poradi).toBe('IV');
    expect(prvni.vyseVyhryKc).toBe(170);
    expect(druhy.vyseVyhryKc).toBe(1036);
  });
});

describe('fixtury odpovídají výherní listině', () => {
  it('každé slosování má dva tahy po šesti číslech a dodatkovém', () => {
    for (const slosovani of VSECHNY_TAHY_SPORTKA) {
      expect(slosovani.tahy, slosovani.datum).toHaveLength(2);
      for (const tah of slosovani.tahy) {
        expect(tah.cisla, slosovani.datum).toHaveLength(6);
        expect(tah.dodatkove, slosovani.datum).toBeGreaterThanOrEqual(1);
        expect(tah.dodatkove, slosovani.datum).toBeLessThanOrEqual(49);
        expect(tah.cisla, slosovani.datum).not.toContain(tah.dodatkove);
        expect(tah.poradi.map((p) => p.klic)).toEqual(['bonus', 'I', 'II', 'III', 'IV', 'V']);
      }
    }
  });

  it('pokrývá obě éry hry — 2015 dvakrát týdně, 2026 třikrát', () => {
    const dny = new Set(VSECHNY_TAHY_SPORTKA.map((t) => t.den));
    expect(dny).toEqual(new Set(['st', 'pa', 'ne']));
    expect(VSECHNY_TAHY_SPORTKA.some((t) => t.sazkovyTyden.rok === 2015)).toBe(true);
  });
});
