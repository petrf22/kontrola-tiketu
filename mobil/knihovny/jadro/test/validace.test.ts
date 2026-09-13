import { describe, expect, it } from 'vitest';
import {
  jePlatny,
  ROZSAHY,
  zkontrolujCisla,
  zkontrolujSesticisli,
  zkontrolujSloupec,
  zkontrolujTiket,
  type Sloupec,
  type Tiket,
} from '../src/index.js';

const kody = (p: readonly { kod: string }[]) => p.map((x) => x.kod);

describe('zkontrolujCisla', () => {
  const ocekavani = ROZSAHY.sportka.cisla;

  it('projde platný sloupec Sportky', () => {
    expect(zkontrolujCisla([5, 12, 23, 31, 40, 49], ocekavani, 'c')).toEqual([]);
  });

  it('hlásí špatný počet čísel', () => {
    expect(kody(zkontrolujCisla([1, 2, 3], ocekavani, 'c'))).toEqual(['spatny-pocet-cisel']);
  });

  it('hlásí číslo nad rozsahem i pod rozsahem', () => {
    const problemy = zkontrolujCisla([0, 2, 3, 4, 5, 50], ocekavani, 'c');
    expect(kody(problemy)).toEqual(['cislo-mimo-rozsah', 'cislo-mimo-rozsah']);
    expect(problemy.map((p) => p.cesta)).toEqual(['c[0]', 'c[5]']);
  });

  it('odmítne desetinné číslo', () => {
    expect(kody(zkontrolujCisla([1.5, 2, 3, 4, 5, 6], ocekavani, 'c'))).toEqual([
      'cislo-mimo-rozsah',
    ]);
  });

  it('hlásí duplicitu a ukáže na druhý výskyt', () => {
    const problemy = zkontrolujCisla([7, 7, 3, 4, 5, 6], ocekavani, 'c');
    expect(kody(problemy)).toEqual(['duplicitni-cislo']);
    expect(problemy[0]?.cesta).toBe('c[1]');
  });

  it('vrátí všechny problémy najednou, ne jen první', () => {
    // Uživatel opravuje naOCRovaná čísla — potřebuje vidět všechno naráz.
    const problemy = zkontrolujCisla([99, 99], ocekavani, 'c');
    expect(kody(problemy)).toEqual([
      'spatny-pocet-cisel',
      'cislo-mimo-rozsah',
      'cislo-mimo-rozsah',
      'duplicitni-cislo',
    ]);
  });
});

describe('zkontrolujSloupec', () => {
  it('projde platný sloupec Eurojackpotu', () => {
    const sloupec: Sloupec = { hra: 'eurojackpot', cisla: [4, 6, 7, 12, 33], eurocisla: [1, 11] };
    expect(zkontrolujSloupec(sloupec)).toEqual([]);
  });

  it('hlídá euročísla zvlášť — 12 je platné, 13 už ne', () => {
    const dobre: Sloupec = { hra: 'eurojackpot', cisla: [1, 2, 3, 4, 5], eurocisla: [1, 12] };
    const spatne: Sloupec = { hra: 'eurojackpot', cisla: [1, 2, 3, 4, 5], eurocisla: [1, 13] };
    expect(zkontrolujSloupec(dobre)).toEqual([]);
    expect(kody(zkontrolujSloupec(spatne))).toEqual(['cislo-mimo-rozsah']);
  });

  it('u Eurojackpotu je 50 platné, u Sportky ne', () => {
    const ej: Sloupec = { hra: 'eurojackpot', cisla: [50, 2, 3, 4, 5], eurocisla: [1, 2] };
    const sp: Sloupec = { hra: 'sportka', cisla: [50, 2, 3, 4, 5, 6] };
    expect(zkontrolujSloupec(ej)).toEqual([]);
    expect(kody(zkontrolujSloupec(sp))).toEqual(['cislo-mimo-rozsah']);
  });

  it('stejné číslo v hlavních i v euročíslech není duplicita', () => {
    const sloupec: Sloupec = { hra: 'eurojackpot', cisla: [3, 2, 10, 4, 5], eurocisla: [3, 10] };
    expect(zkontrolujSloupec(sloupec)).toEqual([]);
  });
});

describe('zkontrolujSesticisli', () => {
  it('přijme vedoucí nuly', () => {
    expect(zkontrolujSesticisli('000000', 'k')).toEqual([]);
    expect(zkontrolujSesticisli('057739', 'k')).toEqual([]);
  });

  it('odmítne jinou délku a nečíslice', () => {
    expect(kody(zkontrolujSesticisli('12345', 'k'))).toEqual(['spatny-format-sesticisli']);
    expect(kody(zkontrolujSesticisli('1234567', 'k'))).toEqual(['spatny-format-sesticisli']);
    expect(kody(zkontrolujSesticisli('12 456', 'k'))).toEqual(['spatny-format-sesticisli']);
    expect(kody(zkontrolujSesticisli('', 'k'))).toEqual(['spatny-format-sesticisli']);
  });
});

describe('zkontrolujTiket', () => {
  const zaklad: Tiket = {
    id: 'test',
    hra: 'sportka',
    sloupce: [{ hra: 'sportka', cisla: [1, 2, 3, 4, 5, 6] }],
    slosovani: { prvni: '2026-09-02', pocet: 1, dny: null },
    kodDoplnkoveHry: null,
    cenaKc: null,
    vlozeno: '2026-09-01T10:00:00Z',
  };

  it('projde minimální platný tiket', () => {
    expect(jePlatny(zkontrolujTiket(zaklad))).toBe(true);
  });

  it('hlásí tiket bez sloupců', () => {
    expect(kody(zkontrolujTiket({ ...zaklad, sloupce: [] }))).toEqual(['zadny-sloupec']);
  });

  it('hlásí sloupec jiné hry, než je tiket', () => {
    const spatny: Tiket = {
      ...zaklad,
      sloupce: [{ hra: 'eurojackpot', cisla: [1, 2, 3, 4, 5], eurocisla: [1, 2] }],
    };
    expect(kody(zkontrolujTiket(spatny))).toEqual(['nesouhlasi-hra']);
  });

  it('u nesouhlasící hry nekontroluje čísla podle špatných pravidel', () => {
    // Sloupec Eurojackpotu má 5 čísel; kdyby se validoval jako Sportka, přibyl by
    // falešný „spatny-pocet-cisel“ a uživatel by dostal matoucí hlášku.
    const spatny: Tiket = {
      ...zaklad,
      sloupce: [{ hra: 'eurojackpot', cisla: [1, 2, 3, 4, 5], eurocisla: [1, 2] }],
    };
    expect(zkontrolujTiket(spatny)).toHaveLength(1);
  });

  it('hlásí nulový počet slosování', () => {
    const spatny = { ...zaklad, slosovani: { ...zaklad.slosovani, pocet: 0 } };
    expect(kody(zkontrolujTiket(spatny))).toEqual(['spatny-pocet-slosovani']);
  });

  it('rozlišuje prázdný seznam dnů od null', () => {
    const prazdny = { ...zaklad, slosovani: { ...zaklad.slosovani, dny: [] } };
    const vsechny = { ...zaklad, slosovani: { ...zaklad.slosovani, dny: null } };
    expect(kody(zkontrolujTiket(prazdny))).toEqual(['prazdny-seznam-dnu']);
    expect(zkontrolujTiket(vsechny)).toEqual([]);
  });

  it('kontroluje kód doplňkové hry, jen když je vsazený', () => {
    expect(zkontrolujTiket({ ...zaklad, kodDoplnkoveHry: null })).toEqual([]);
    expect(zkontrolujTiket({ ...zaklad, kodDoplnkoveHry: '236412' })).toEqual([]);
    expect(kody(zkontrolujTiket({ ...zaklad, kodDoplnkoveHry: '23641' }))).toEqual([
      'spatny-format-sesticisli',
    ]);
  });

  it('posbírá problémy ze všech sloupců, ne jen z prvního', () => {
    const spatny: Tiket = {
      ...zaklad,
      sloupce: [
        { hra: 'sportka', cisla: [1, 2, 3, 4, 5, 99] },
        { hra: 'sportka', cisla: [7, 7, 3, 4, 5, 6] },
      ],
    };
    const problemy = zkontrolujTiket(spatny);
    expect(kody(problemy)).toEqual(['cislo-mimo-rozsah', 'duplicitni-cislo']);
    expect(problemy.map((p) => p.cesta)).toEqual(['sloupce[0].cisla[5]', 'sloupce[1].cisla[1]']);
  });
});
