import { describe, expect, it } from 'vitest';
import {
  datumPoslednihoSlosovani,
  denVTydnu,
  jeVirtualni,
  duplicity,
  prekryvy,
  stejneSloupce,
  type Tah,
  type Tiket,
} from '../src/index.js';
import { EJ_2026_09_01, EJ_2026_09_04, EJ_2026_09_08 } from './fixtures/eurojackpot.js';
import { SP_2026_09_02, SP_2026_09_04, SP_2026_09_06 } from './fixtures/sportka.js';

const TAHY_EJ: readonly Tah[] = [EJ_2026_09_01, EJ_2026_09_04, EJ_2026_09_08];
const TAHY_SP: readonly Tah[] = [SP_2026_09_02, SP_2026_09_04, SP_2026_09_06];

function tiket(over: Partial<Tiket> = {}): Tiket {
  return {
    id: 'ej',
    hra: 'eurojackpot',
    sloupce: [
      { hra: 'eurojackpot', cisla: [23, 30, 33, 37, 47], eurocisla: [2, 3] },
      { hra: 'eurojackpot', cisla: [2, 22, 37, 39, 40], eurocisla: [2, 12] },
    ],
    slosovani: { prvni: '2026-09-08', pocet: 1, dny: null },
    kodDoplnkoveHry: '845991',
    cenaKc: 400,
    vlozeno: '2026-09-07T10:00:00Z',
    ...over,
  };
}

describe('denVTydnu', () => {
  it('sedí na dny tahů z listiny', () => {
    for (const tah of [...TAHY_EJ, ...TAHY_SP]) expect(denVTydnu(tah.datum)).toBe(tah.den);
  });
});

describe('jeVirtualni', () => {
  it('rozliší tiket podle papíru od tiketu s rozsahem kontroly', () => {
    expect(jeVirtualni(tiket())).toBe(false);
    expect(jeVirtualni(tiket({ kontrola: { od: '2026-09-01', do: null, cenaZaSlosovaniKc: null } }))).toBe(true);
  });
});

describe('datumPoslednihoSlosovani', () => {
  it('jedno slosování je den prvního', () => {
    expect(datumPoslednihoSlosovani('eurojackpot', { prvni: '2026-09-08', pocet: 1, dny: null }, TAHY_EJ)).toBe(
      '2026-09-08',
    );
  });

  it('řídí se známými tahy', () => {
    expect(datumPoslednihoSlosovani('eurojackpot', { prvni: '2026-09-01', pocet: 3, dny: null }, TAHY_EJ)).toBe(
      '2026-09-08',
    );
    expect(datumPoslednihoSlosovani('sportka', { prvni: '2026-09-02', pocet: 2, dny: ['ne'] }, TAHY_SP)).toBe(
      '2026-09-13',
    );
  });

  it('za posledním známým tahem pokračuje kalendářem — úterý a pátek', () => {
    // 8. 9. (známý), 11. 9. pá, 15. 9. út, 18. 9. pá
    expect(datumPoslednihoSlosovani('eurojackpot', { prvni: '2026-09-08', pocet: 4, dny: null }, TAHY_EJ)).toBe(
      '2026-09-18',
    );
  });

  it('bez tahů počítá čistě z kalendáře a vybraných dnů', () => {
    // Sportka jen ve středu: 2., 9., 16. 9.
    expect(datumPoslednihoSlosovani('sportka', { prvni: '2026-09-01', pocet: 3, dny: ['st'] }, [])).toBe(
      '2026-09-16',
    );
    // Euromiliony úterý a sobota: 8., 12., 15. 9.
    expect(datumPoslednihoSlosovani('euromiliony', { prvni: '2026-09-07', pocet: 3, dny: null }, [])).toBe(
      '2026-09-15',
    );
  });

  it('před prvním známým tahem použije kalendář', () => {
    // Út 25. 8., pá 28. 8., út 1. 9. (známý)
    expect(datumPoslednihoSlosovani('eurojackpot', { prvni: '2026-08-25', pocet: 3, dny: null }, TAHY_EJ)).toBe(
      '2026-09-01',
    );
  });
});

describe('stejneSloupce', () => {
  it('nezáleží na pořadí sloupců ani čísel ve sloupci', () => {
    const prehozene = tiket({
      id: 'jiny',
      sloupce: [
        { hra: 'eurojackpot', cisla: [40, 39, 37, 22, 2], eurocisla: [12, 2] },
        { hra: 'eurojackpot', cisla: [47, 37, 33, 30, 23], eurocisla: [3, 2] },
      ],
    });
    expect(stejneSloupce(tiket(), prehozene)).toBe(true);
  });

  it('kód doplňkové hry nerozhoduje — rozpoznávač ho občas přečte jinak', () => {
    expect(stejneSloupce(tiket(), tiket({ kodDoplnkoveHry: null }))).toBe(true);
    expect(stejneSloupce(tiket(), tiket({ kodDoplnkoveHry: '845997' }))).toBe(true);
  });

  it('jiné číslo nebo sloupec navíc nejsou stejné sloupce', () => {
    const a = tiket();
    expect(stejneSloupce(a, tiket({ sloupce: a.sloupce.slice(0, 1) }))).toBe(false);
    expect(
      stejneSloupce(a, tiket({ sloupce: [a.sloupce[0]!, { hra: 'eurojackpot', cisla: [2, 22, 37, 39, 41], eurocisla: [2, 12] }] })),
    ).toBe(false);
  });
});

describe('duplicity', () => {
  // Tiket od uživatele (4. 10. 2026): Sportka, tři sloupce se Šancí na 6 slosování (ST, PÁ, NE).
  // První sken přečetl méně slosování a jiný kód Šance, druhý byl úplný.
  const sportka = (over: Partial<Tiket> = {}): Tiket =>
    tiket({
      id: 'uplny',
      hra: 'sportka',
      sloupce: [
        { hra: 'sportka', cisla: [1, 9, 18, 26, 38, 44] },
        { hra: 'sportka', cisla: [6, 12, 21, 30, 39, 45] },
        { hra: 'sportka', cisla: [7, 14, 20, 28, 35, 49] },
      ],
      slosovani: { prvni: '2026-09-02', pocet: 6, dny: ['st', 'pa', 'ne'] },
      kodDoplnkoveHry: '654321',
      cenaKc: 720,
      ...over,
    });

  it('najde druhý sken téhož tiketu s méně slosováními i jiným kódem Šance', () => {
    const prvniSken = sportka({ id: 'neuplny', slosovani: { prvni: '2026-09-02', pocet: 2, dny: ['st', 'pa', 'ne'] }, kodDoplnkoveHry: '654327' });
    expect(duplicity(sportka(), [prvniSken], TAHY_SP)).toEqual([
      { tiketId: 'neuplny', data: ['2026-09-02', '2026-09-04'] },
    ]);
  });

  it('vidí i slosování, která ještě nemají výsledky', () => {
    // 9., 11. a 13. 9. listina zatím nemá.
    const pozdeji = sportka({ id: 'pozdeji', slosovani: { prvni: '2026-09-09', pocet: 1, dny: null } });
    expect(duplicity(sportka(), [pozdeji], TAHY_SP)).toEqual([{ tiketId: 'pozdeji', data: ['2026-09-09'] }]);
    expect(duplicity(sportka(), [pozdeji], [])).toEqual([{ tiketId: 'pozdeji', data: ['2026-09-09'] }]);
  });

  it('tentýž tiket (stejné id), jiné dny nebo jiné sloupce duplicitou nejsou', () => {
    const jenStreda = sportka({ id: 'st', slosovani: { prvni: '2026-09-16', pocet: 2, dny: ['st'] } });
    const jenNedele = sportka({ id: 'ne', slosovani: { prvni: '2026-09-13', pocet: 3, dny: ['ne'] } });
    const jineSloupce = sportka({ id: 'jine', sloupce: sportka().sloupce.slice(1) });
    expect(duplicity(sportka(), [sportka(), jineSloupce], TAHY_SP)).toEqual([]);
    expect(duplicity(jenStreda, [jenNedele], TAHY_SP)).toEqual([]);
  });

  it('virtuální tiket bez konce proti papírovému', () => {
    const virtualni = tiket({ id: 'v', kontrola: { od: '2026-09-01', do: null, cenaZaSlosovaniKc: 400 } });
    expect(duplicity(virtualni, [tiket({ id: 'p' })], TAHY_EJ)).toEqual([{ tiketId: 'p', data: ['2026-09-08'] }]);
    // Papír před začátkem kontroly se nepotká.
    const dribe = tiket({ id: 'd', slosovani: { prvni: '2026-08-25', pocet: 2, dny: null } });
    expect(duplicity(virtualni, [dribe], TAHY_EJ)).toEqual([]);
  });

  it('dva virtuální tikety bez konce se stejnými dny', () => {
    const utery = tiket({ id: 'ut', slosovani: { prvni: '2026-09-01', pocet: 1, dny: ['ut'] }, kontrola: { od: '2026-09-01', do: null, cenaZaSlosovaniKc: null } });
    const patky = tiket({ id: 'pa', slosovani: { prvni: '2026-09-04', pocet: 1, dny: ['pa'] }, kontrola: { od: '2026-09-04', do: null, cenaZaSlosovaniKc: null } });
    const vse = tiket({ id: 'vse', kontrola: { od: '2026-09-05', do: null, cenaZaSlosovaniKc: null } });
    expect(duplicity(utery, [patky], TAHY_EJ)).toEqual([]);
    expect(duplicity(vse, [utery], TAHY_EJ)).toEqual([{ tiketId: 'ut', data: ['2026-09-08', '2026-09-15'] }]);
  });
});

describe('prekryvy', () => {
  it('označí oba tikety z dvojice', () => {
    const virtualni = tiket({ id: 'v', kontrola: { od: '2026-09-01', do: null, cenaZaSlosovaniKc: 400 } });
    const papirovy = tiket({ id: 'p' });
    const vysledek = prekryvy([virtualni, papirovy], TAHY_EJ);
    expect(vysledek.get('v')).toEqual([{ tiketId: 'p', data: ['2026-09-08'] }]);
    expect(vysledek.get('p')).toEqual([{ tiketId: 'v', data: ['2026-09-08'] }]);
  });

  it('bez společného slosování nebo s jinými sloupci překryv není', () => {
    const virtualni = tiket({ id: 'v', kontrola: { od: '2026-09-01', do: '2026-09-04', cenaZaSlosovaniKc: 400 } });
    const jina = tiket({ id: 'j', sloupce: tiket().sloupce.slice(1), kontrola: { od: '2026-09-01', do: null, cenaZaSlosovaniKc: null } });
    expect(prekryvy([virtualni, tiket({ id: 'p' }), jina], TAHY_EJ).size).toBe(0);
  });
});
