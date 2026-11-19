import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { clenuTiketu, spolecnyPocetClenu, souhrnBilance, vyhodnotTiket, type SazbyExtra6, type Tah, type Tiket } from '../src/index.js';
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

const PRAZDNY = {
  vsazenoKc: 0,
  vyhranoKc: 0,
  tiketu: 0,
  tiketuBezCeny: 0,
  nejistych: 0,
  vsazenoNaClenaKc: 0,
  vyhranoNaClenaKc: 0,
  skupinovych: 0,
};

function souhrn(tikety: readonly Tiket[]) {
  return souhrnBilance(tikety, new Map(tikety.map((t) => [t.id, vyhodnotTiket(t, TAHY, SAZBY)])));
}

describe('souhrnBilance', () => {
  it('sečte vsazené a vyhrané celkem i po hrách', () => {
    const { celkem, podleHry } = souhrn([vyherni, bezCeny, sportka]);

    expect(podleHry.eurojackpot).toEqual({
      vsazenoKc: 1200,
      vyhranoKc: 5780,
      tiketu: 2,
      tiketuBezCeny: 1,
      nejistych: 0,
      vsazenoNaClenaKc: 1200,
      vyhranoNaClenaKc: 5780,
      skupinovych: 0,
    });
    // Sportka bez konce: tři slosování po 50 Kč, součet pokračuje.
    expect(podleHry.sportka.vsazenoKc).toBe(150);
    expect(podleHry.sportka.nejistych).toBe(1);
    expect(podleHry.euromiliony).toEqual(PRAZDNY);

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
    expect(souhrn([]).celkem).toEqual(PRAZDNY);
  });
});

describe('skupinové sázení — podíl na člena', () => {
  // Cena a výhra tiketu `vyherni` jsou z fixtury (400 Kč, 5 780 Kč podle listiny 8. 9. 2026).
  const skupinovy: Tiket = { ...vyherni, id: 'ej-skupina', clenu: 5 };

  it('dělí vklad i výhru počtem členů', () => {
    const { celkem } = souhrn([skupinovy]);
    expect(celkem.vsazenoKc).toBe(1200);
    expect(celkem.vyhranoKc).toBe(5780);
    expect(celkem.vsazenoNaClenaKc).toBe(1200 / 5);
    expect(celkem.vyhranoNaClenaKc).toBe(5780 / 5);
    expect(celkem.skupinovych).toBe(1);
  });

  it('dělí po tiketech: sám a skupinový tiket se sečtou každý svým dělitelem', () => {
    const sam: Tiket = { ...vyherni, id: 'ej-sam' };
    const { celkem } = souhrn([sam, skupinovy]);
    expect(celkem.vsazenoNaClenaKc).toBe(1200 + 1200 / 5);
    expect(celkem.vyhranoNaClenaKc).toBe(5780 + 5780 / 5);
    expect(celkem.skupinovych).toBe(1);
    expect(celkem.tiketu).toBe(2);
  });

  it('tiket bez ceny nepřidá k podílu vklad, výhru ano', () => {
    const { celkem } = souhrn([{ ...bezCeny, clenu: 4 }]);
    expect(celkem.vsazenoNaClenaKc).toBe(0);
    expect(celkem.tiketuBezCeny).toBe(1);
  });
  it('virtuální tiket: bilance na jednoho je (výhra − vklad) / členů, částky z listiny', () => {
    // `vyherni` je virtuální (kontrola 1.–8. 9. 2026, 400 Kč za slosování); výhra 4+1 je z listiny.
    const t: Tiket = { ...vyherni, id: 'prace', clenu: 5 };
    const v = vyhodnotTiket(t, TAHY, SAZBY);
    expect(v.celkemKc).toBe(5780);
    expect(v.vsazenoKc).toBe(1200);
    const { celkem } = souhrnBilance([t], new Map([[t.id, v]]));
    expect(celkem.vyhranoNaClenaKc - celkem.vsazenoNaClenaKc).toBe((5780 - 1200) / 5);
    expect(celkem.vsazenoNaClenaKc).toBe(240);
  });

  it('virtuální tiket bez konce: podíl se dělí také, výsledek zůstává nejistý', () => {
    const t: Tiket = { ...sportka, id: 'sp-skupina', clenu: 3 };
    const v = vyhodnotTiket(t, TAHY, SAZBY);
    const { celkem } = souhrnBilance([t], new Map([[t.id, v]]));
    expect(v.soucetJisty).toBe(false);
    expect(celkem.nejistych).toBe(1);
    expect(celkem.vsazenoNaClenaKc).toBe(v.vsazenoKc! / 3);
    expect(celkem.vyhranoNaClenaKc).toBe(v.celkemKc / 3);
  });
});

describe('spolecnyPocetClenu', () => {
  it('vrátí počet jen když je u všech tiketů stejný a větší než 1', () => {
    expect(spolecnyPocetClenu([{ clenu: 5 }, { clenu: 5 }])).toBe(5);
    expect(spolecnyPocetClenu([{ clenu: 5 }, { clenu: 3 }])).toBeNull();
    expect(spolecnyPocetClenu([{ clenu: 5 }, {}])).toBeNull();
    expect(spolecnyPocetClenu([{}])).toBeNull();
    expect(spolecnyPocetClenu([])).toBeNull();
  });
});

describe('clenuTiketu', () => {
  it('bez hodnoty, jednička nebo nesmysl znamená sázím sám', () => {
    expect(clenuTiketu({})).toBe(1);
    expect(clenuTiketu({ clenu: 1 })).toBe(1);
    expect(clenuTiketu({ clenu: 0 })).toBe(1);
    expect(clenuTiketu({ clenu: 2.5 })).toBe(1);
    expect(clenuTiketu({ clenu: 5 })).toBe(5);
  });
});
