import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { souhrnBilance, vyhodnotTiket, type SazbyExtra6, type Tah, type Tiket } from '../src/index.js';
import { EJ_2026_09_01, EJ_2026_09_04, EJ_2026_09_08 } from './fixtures/eurojackpot.js';
import { SP_2026_09_02, SP_2026_09_04, SP_2026_09_06 } from './fixtures/sportka.js';

const BALIK = JSON.parse(
  readFileSync(new URL('../../../test/fixtures/vysledky-2026-35-az-37.json', import.meta.url), 'utf8'),
);
const SAZBY: readonly SazbyExtra6[] = BALIK.sazbyExtra6;
const TAHY: readonly Tah[] = [EJ_2026_09_01, EJ_2026_09_04, EJ_2026_09_08, SP_2026_09_02, SP_2026_09_04, SP_2026_09_06];

// 4+1 v tahu 8. 9. 2026 dává 5 780 Kč (listina), 1. a 4. 9. tentýž sloupec nevyhrál nic.
const vyherni: Tiket = {
  id: 'ej-vyherni',
  hra: 'eurojackpot',
  sloupce: [{ hra: 'eurojackpot', cisla: [47, 14, 27, 34, 1], eurocisla: [4, 1] }],
  slosovani: { prvni: '2026-09-08', pocet: 1, dny: null },
  kodDoplnkoveHry: null,
  cenaKc: 400,
  vlozeno: '2026-09-07T10:00:00Z',
  kontrola: { od: '2026-09-01', do: '2026-09-08', cenaZaSlosovaniKc: 400 },
};

const bezCeny: Tiket = {
  id: 'ej-bez-ceny',
  hra: 'eurojackpot',
  sloupce: [{ hra: 'eurojackpot', cisla: [1, 2, 3, 4, 5], eurocisla: [11, 12] }],
  slosovani: { prvni: '2026-09-01', pocet: 1, dny: null },
  kodDoplnkoveHry: null,
  cenaKc: null,
  vlozeno: '2026-09-01T10:00:00Z',
};

const sportka: Tiket = {
  id: 'sp',
  hra: 'sportka',
  sloupce: [{ hra: 'sportka', cisla: [1, 2, 3, 4, 5, 6] }],
  slosovani: { prvni: '2026-09-02', pocet: 1, dny: null },
  kodDoplnkoveHry: null,
  cenaKc: 50,
  vlozeno: '2026-09-01T10:00:00Z',
  kontrola: { od: '2026-09-02', do: null, cenaZaSlosovaniKc: 50 },
};

function souhrn(tikety: readonly Tiket[]) {
  return souhrnBilance(tikety, new Map(tikety.map((t) => [t.id, vyhodnotTiket(t, TAHY, SAZBY)])));
}

describe('souhrnBilance', () => {
  it('sečte vsazené a vyhrané celkem i po hrách', () => {
    const { celkem, podleHry } = souhrn([vyherni, bezCeny, sportka]);

    expect(podleHry.eurojackpot).toEqual({ vsazenoKc: 1200, vyhranoKc: 5780, tiketu: 2, tiketuBezCeny: 1, nejistych: 0 });
    // Sportka bez konce: tři slosování po 50 Kč, součet pokračuje.
    expect(podleHry.sportka.vsazenoKc).toBe(150);
    expect(podleHry.sportka.nejistych).toBe(1);
    expect(podleHry.euromiliony).toEqual({ vsazenoKc: 0, vyhranoKc: 0, tiketu: 0, tiketuBezCeny: 0, nejistych: 0 });

    expect(celkem.vsazenoKc).toBe(1200 + 150);
    expect(celkem.vyhranoKc).toBe(5780 + podleHry.sportka.vyhranoKc);
    expect(celkem.tiketu).toBe(3);
    expect(celkem.tiketuBezCeny).toBe(1);
  });

  it('tiket bez vyhodnocení přeskočí', () => {
    const vysledky = new Map([[vyherni.id, vyhodnotTiket(vyherni, TAHY, SAZBY)]]);
    expect(souhrnBilance([vyherni, bezCeny], vysledky).celkem.tiketu).toBe(1);
  });

  it('bez tiketů je všechno nula', () => {
    expect(souhrn([]).celkem).toEqual({ vsazenoKc: 0, vyhranoKc: 0, tiketu: 0, tiketuBezCeny: 0, nejistych: 0 });
  });
});
