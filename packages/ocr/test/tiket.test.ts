import { describe, expect, it } from 'vitest';
import { vyhodnotTiket, zkontrolujTiket, type Tah } from '@kontrola-tiketu/jadro';
import { jeBezProblemu, naTiket, prectiTiket, type RozpoznanyText } from '../src/index.js';
import { tiketEJ } from './pomocnici.js';

/** Tiket Eurojackpotu přesně podle rozvržení ze zadání, včetně hlavičky a oddělovačů. */
const CELY_TIKET: readonly string[][] = [
  ['SLOSOVÁNÍ: 1 (ÚT)', '08.09.2026'],
  ['------------------------------------------------'],
  ['1: 23 30 33 37 47', '02 03 NT'],
  ['2: 02 22 37 39 40', '02 12 NT'],
  ['3: 04 06 07 12 33', '01 11 NT'],
  ['------------------------------------------------'],
];

describe('prectiTiket — Eurojackpot', () => {
  const vysledek = prectiTiket(tiketEJ(CELY_TIKET), 'eurojackpot');

  it('přečte tři sloupce', () => {
    expect(vysledek.sloupce).toHaveLength(3);
  });

  it('rozdělí čísla a euročísla podle rozvržení tiketu', () => {
    expect(vysledek.sloupce[0]?.cisla).toEqual([23, 30, 33, 37, 47]);
    expect(vysledek.sloupce[0]?.eurocisla).toEqual([2, 3]);
    expect(vysledek.sloupce[2]?.cisla).toEqual([4, 6, 7, 12, 33]);
    expect(vysledek.sloupce[2]?.eurocisla).toEqual([1, 11]);
  });

  it('zapamatuje si pořadí sloupce z tiketu', () => {
    expect(vysledek.sloupce.map((s) => s.poradi)).toEqual([1, 2, 3]);
  });

  it('nepovažuje NT za číslo', () => {
    expect(vysledek.sloupce.every((s) => s.eurocisla.length === 2)).toBe(true);
  });

  it('oddělovací čáry ani hlavičku nebere jako sloupec', () => {
    expect(vysledek.nepouziteRadky.some((r) => r.startsWith('---'))).toBe(true);
    expect(vysledek.sloupce.every((s) => s.problemy.length === 0)).toBe(true);
  });

  it('přečte z hlavičky datum, den i počet slosování', () => {
    expect(vysledek.hlavicka).toEqual({ pocetSlosovani: 1, den: 'ut', datum: '2026-09-08' });
  });

  it('čistý tiket nemá co potvrzovat navíc', () => {
    expect(jeBezProblemu(vysledek)).toBe(true);
  });
});

describe('prectiTiket — nakloněný snímek', () => {
  for (const sklon of [-6, 0, 6]) {
    it(`dá stejný výsledek při náklonu ${sklon}°`, () => {
      const vysledek = prectiTiket(tiketEJ(CELY_TIKET, { sklonStupnu: sklon }), 'eurojackpot');
      expect(vysledek.sloupce.map((s) => s.cisla)).toEqual([
        [23, 30, 33, 37, 47],
        [2, 22, 37, 39, 40],
        [4, 6, 7, 12, 33],
      ]);
      expect(vysledek.sloupce.map((s) => s.eurocisla)).toEqual([
        [2, 3],
        [2, 12],
        [1, 11],
      ]);
    });
  }
});

describe('prectiTiket — vadné čtení', () => {
  it('opravené záměny označí, aby je uživatel mohl zkontrolovat', () => {
    const vysledek = prectiTiket(
      tiketEJ([['1: 23 3O 33 37 47', 'O2 03 NT']]),
      'eurojackpot',
    );
    expect(vysledek.sloupce[0]?.cisla).toEqual([23, 30, 33, 37, 47]);
    expect(vysledek.sloupce[0]?.opravene).toEqual(['3O', 'O2']);
    expect(jeBezProblemu(vysledek)).toBe(false);
  });

  it('chybějící číslo nezakryje — pošle ho dál jako problém k opravě', () => {
    const vysledek = prectiTiket(tiketEJ([['1: 23 30 33 37', '02 03 NT']]), 'eurojackpot');
    expect(vysledek.sloupce[0]?.cisla).toEqual([23, 30, 33, 37, 2]);
    expect(vysledek.sloupce[0]?.problemy.map((p) => p.kod)).toContain('spatny-pocet-cisel');
  });

  it('číslo mimo rozsah projde dál označené, ne zahozené', () => {
    const vysledek = prectiTiket(tiketEJ([['1: 23 30 33 37 99', '02 03 NT']]), 'eurojackpot');
    expect(vysledek.sloupce[0]?.cisla).toContain(99);
    expect(vysledek.sloupce[0]?.problemy.map((p) => p.kod)).toContain('cislo-mimo-rozsah');
  });

  it('přebytečné číslo se nezahodí, ale zviditelní', () => {
    const vysledek = prectiTiket(tiketEJ([['1: 23 30 33 37 47', '02 03 04 NT']]), 'eurojackpot');
    expect(vysledek.sloupce[0]?.eurocisla).toEqual([2, 3, 4]);
    expect(vysledek.sloupce[0]?.problemy.map((p) => p.kod)).toContain('spatny-pocet-cisel');
  });

  it('nechá si původní text řádku, ať je co porovnat s papírem', () => {
    const vysledek = prectiTiket(tiketEJ([['1: 23 30 33 37 47', '02 03 NT']]), 'eurojackpot');
    expect(vysledek.sloupce[0]?.text).toBe('1: 23 30 33 37 47 02 03 NT');
  });

  it('nic nerozpoznaného nedá žádný sloupec, ne vymyšlený', () => {
    const smeti: RozpoznanyText[] = [
      { text: 'ALLWYN', ramecek: { x: 0, y: 0, sirka: 80, vyska: 20 } },
      { text: 'DĚKUJEME', ramecek: { x: 0, y: 40, sirka: 90, vyska: 20 } },
    ];
    const vysledek = prectiTiket(smeti, 'eurojackpot');
    expect(vysledek.sloupce).toEqual([]);
    expect(jeBezProblemu(vysledek)).toBe(false);
  });
});

describe('prectiTiket — Sportka', () => {
  it('čte šest čísel a žádná euročísla', () => {
    const vysledek = prectiTiket(
      tiketEJ([['1: 05 12 23 31 40 49'], ['2: 01 02 03 04 05 06']]),
      'sportka',
    );
    expect(vysledek.sloupce[0]?.cisla).toEqual([5, 12, 23, 31, 40, 49]);
    expect(vysledek.sloupce[0]?.eurocisla).toEqual([]);
    expect(vysledek.sloupce[0]?.problemy).toEqual([]);
  });

  it('u Sportky je 50 mimo rozsah', () => {
    const vysledek = prectiTiket(tiketEJ([['1: 50 12 23 31 40 49']]), 'sportka');
    expect(vysledek.sloupce[0]?.problemy.map((p) => p.kod)).toContain('cislo-mimo-rozsah');
  });
});

describe('naTiket', () => {
  const vysledek = prectiTiket(tiketEJ(CELY_TIKET), 'eurojackpot');

  it('sestaví tiket, který projde kontrolou jádra', () => {
    const tiket = naTiket(vysledek, { id: 'abc', vlozeno: '2026-09-07T10:00:00Z' });
    expect(zkontrolujTiket(tiket)).toEqual([]);
  });

  it('převezme datum a počet slosování z hlavičky', () => {
    const tiket = naTiket(vysledek, { id: 'abc' });
    expect(tiket.slosovani.prvni).toBe('2026-09-08');
    expect(tiket.slosovani.pocet).toBe(1);
  });

  it('kód doplňkové hry bere zvenčí, ne z OCR — je v čárovém kódu', () => {
    expect(naTiket(vysledek, { id: 'a' }).kodDoplnkoveHry).toBeNull();
    expect(naTiket(vysledek, { id: 'a', kodDoplnkoveHry: '912799' }).kodDoplnkoveHry).toBe('912799');
  });

  it('sestavený tiket jde rovnou vyhodnotit', async () => {
    const { EJ_2026_09_08 } = (await import(
      '../../jadro/test/fixtures/eurojackpot.js'
    )) as { EJ_2026_09_08: Tah };

    const tiket = naTiket(vysledek, { id: 'abc' });
    const hodnoceni = vyhodnotTiket(tiket, [EJ_2026_09_08]);

    expect(hodnoceni.slosovani).toHaveLength(1);
    expect(hodnoceni.chybejicichSlosovani).toBe(0);
    // Tažená čísla 47 14 27 34 36 / 4 3 — první sloupec trefil 47, druhý nic navíc.
    expect(hodnoceni.slosovani[0]?.sloupce).toHaveLength(3);
  });
});
