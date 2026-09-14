import { describe, expect, it } from 'vitest';
import {
  dnyZVyberu,
  jePlatneDatum,
  jePlatny,
  ROZSAHY,
  zkontrolujCisla,
  zkontrolujKodDoplnkoveHry,
  zkontrolujSloupec,
  zkontrolujTiket,
  type Sloupec,
  type Tiket,
} from '../src/index.js';

const kody = (p: readonly { kod: string }[]) => p.map((x) => x.kod);

describe('dnyZVyberu', () => {
  it('všechny dny hry znamenají všechna slosování', () => {
    expect(dnyZVyberu('sportka', ['st', 'pa', 'ne'])).toBeNull();
    expect(dnyZVyberu('eurojackpot', ['ut', 'pa'])).toBeNull();
  });

  it('podmnožinu vrátí jako seznam dnů', () => {
    expect(dnyZVyberu('sportka', ['ne'])).toEqual(['ne']);
    expect(dnyZVyberu('eurojackpot', ['pa'])).toEqual(['pa']);
  });

  it('řadí podle týdne, ne podle pořadí zaškrtnutí', () => {
    expect(dnyZVyberu('sportka', ['ne', 'st'])).toEqual(['st', 'ne']);
    expect(dnyZVyberu('sportka', ['ne', 'pa', 'st'])).toBeNull();
  });

  it('dny, které hra nemá, zahodí — třeba zbytek po přepnutí hry', () => {
    expect(dnyZVyberu('eurojackpot', ['st', 'pa', 'ne'])).toEqual(['pa']);
  });

  it('prázdný výběr nechá na validaci', () => {
    expect(dnyZVyberu('sportka', [])).toEqual([]);
  });
});

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

  it('skloňuje počet v hlášce', () => {
    const zprava = (cisla: number[], ocekavani: { pocet: number; min: number; max: number }) =>
      zkontrolujCisla(cisla, ocekavani, 'c')[0]?.zprava;
    expect(zprava([], ROZSAHY.euromiliony.druheOsudi)).toBe('Očekává se 1 číslo, zadáno 0.');
    expect(zprava([], ROZSAHY.eurojackpot.eurocisla)).toBe('Očekávají se 2 čísla, zadáno 0.');
    expect(zprava([1], ROZSAHY.eurojackpot.cisla)).toBe('Očekává se 5 čísel, zadáno 1.');
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

describe('zkontrolujKodDoplnkoveHry', () => {
  it('přijme vedoucí nuly', () => {
    expect(zkontrolujKodDoplnkoveHry('000000', 6, 'k')).toEqual([]);
    expect(zkontrolujKodDoplnkoveHry('057739', 6, 'k')).toEqual([]);
    expect(zkontrolujKodDoplnkoveHry('07781', 5, 'k')).toEqual([]);
  });

  it('odmítne jinou délku a nečíslice', () => {
    expect(kody(zkontrolujKodDoplnkoveHry('12345', 6, 'k'))).toEqual(['spatny-format-kodu']);
    expect(kody(zkontrolujKodDoplnkoveHry('1234567', 6, 'k'))).toEqual(['spatny-format-kodu']);
    expect(kody(zkontrolujKodDoplnkoveHry('12 456', 6, 'k'))).toEqual(['spatny-format-kodu']);
    expect(kody(zkontrolujKodDoplnkoveHry('', 6, 'k'))).toEqual(['spatny-format-kodu']);
    expect(kody(zkontrolujKodDoplnkoveHry('123456', 5, 'k'))).toEqual(['spatny-format-kodu']);
  });

  it('řekne v hlášce, kolik číslic čeká', () => {
    expect(zkontrolujKodDoplnkoveHry('1234', 5, 'k')[0]?.zprava).toContain('pět číslic');
    expect(zkontrolujKodDoplnkoveHry('1234', 6, 'k')[0]?.zprava).toContain('šest číslic');
  });
});

describe('Euromiliony', () => {
  const sloupec = (cisla: number[], druheOsudi: number[]): Sloupec => ({
    hra: 'euromiliony',
    cisla,
    druheOsudi,
  });

  it('přijme sedm čísel z 1–35 a jedno z 1–5', () => {
    expect(zkontrolujSloupec(sloupec([1, 2, 3, 4, 5, 6, 35], [5]))).toEqual([]);
  });

  it('hlásí rozsah i počet v obou osudích', () => {
    expect(kody(zkontrolujSloupec(sloupec([1, 2, 3, 4, 5, 6, 36], [1])))).toEqual(['cislo-mimo-rozsah']);
    expect(kody(zkontrolujSloupec(sloupec([1, 2, 3, 4, 5, 6], [1])))).toEqual(['spatny-pocet-cisel']);
    expect(kody(zkontrolujSloupec(sloupec([1, 2, 3, 4, 5, 6, 7], [6])))).toEqual(['cislo-mimo-rozsah']);
    expect(zkontrolujSloupec(sloupec([1, 2, 3, 4, 5, 6, 7], []))[0]?.cesta).toBe('sloupec.druheOsudi');
  });

  it('kód Eurošance má pět číslic, ne šest', () => {
    const tiket: Tiket = {
      id: 'em',
      hra: 'euromiliony',
      sloupce: [sloupec([1, 2, 3, 4, 5, 6, 7], [1])],
      slosovani: { prvni: '2026-09-08', pocet: 1, dny: null },
      kodDoplnkoveHry: '07781',
      cenaKc: null,
      vlozeno: '2026-09-07T10:00:00Z',
    };
    expect(zkontrolujTiket(tiket)).toEqual([]);
    expect(kody(zkontrolujTiket({ ...tiket, kodDoplnkoveHry: '077810' }))).toEqual(['spatny-format-kodu']);
  });

  it('úterý a sobota znamenají všechna slosování', () => {
    expect(dnyZVyberu('euromiliony', ['so', 'ut'])).toBeNull();
    expect(dnyZVyberu('euromiliony', ['so'])).toEqual(['so']);
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

  it('projde virtuální tiket s rozsahem bez konce i s koncem', () => {
    const kontrola = { od: '2023-09-12', do: null, cenaZaSlosovaniKc: 400 };
    expect(zkontrolujTiket({ ...zaklad, kontrola })).toEqual([]);
    expect(zkontrolujTiket({ ...zaklad, kontrola: { ...kontrola, do: '2026-09-08' } })).toEqual([]);
    expect(zkontrolujTiket({ ...zaklad, kontrola: { ...kontrola, cenaZaSlosovaniKc: null } })).toEqual([]);
  });

  it('hlásí rozsah kontroly bez začátku a s koncem před začátkem', () => {
    const kontrola = { od: '', do: null, cenaZaSlosovaniKc: null };
    expect(kody(zkontrolujTiket({ ...zaklad, kontrola }))).toEqual(['spatne-datum']);
    const obracene = { od: '2026-09-08', do: '2026-09-01', cenaZaSlosovaniKc: null };
    const problemy = zkontrolujTiket({ ...zaklad, kontrola: obracene });
    expect(kody(problemy)).toEqual(['konec-pred-zacatkem']);
    expect(problemy[0]?.cesta).toBe('kontrola.do');
  });

  it('hlásí zápornou cenu za slosování', () => {
    const kontrola = { od: '2026-09-01', do: null, cenaZaSlosovaniKc: -1 };
    expect(kody(zkontrolujTiket({ ...zaklad, kontrola }))).toEqual(['spatna-cena']);
  });

  it('kontroluje kód doplňkové hry, jen když je vsazený', () => {
    expect(zkontrolujTiket({ ...zaklad, kodDoplnkoveHry: null })).toEqual([]);
    expect(zkontrolujTiket({ ...zaklad, kodDoplnkoveHry: '236412' })).toEqual([]);
    expect(kody(zkontrolujTiket({ ...zaklad, kodDoplnkoveHry: '23641' }))).toEqual([
      'spatny-format-kodu',
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

describe('jePlatneDatum', () => {
  it('přijme skutečné datum a odmítne nesmysl', () => {
    expect(jePlatneDatum('2024-02-29')).toBe(true);
    expect(jePlatneDatum('2026-02-29')).toBe(false);
    expect(jePlatneDatum('2026-13-01')).toBe(false);
    expect(jePlatneDatum('8. 9. 2026')).toBe(false);
    expect(jePlatneDatum('')).toBe(false);
  });
});
