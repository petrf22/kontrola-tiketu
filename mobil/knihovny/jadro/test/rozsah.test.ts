import { describe, expect, it } from 'vitest';
import {
  datumPoslednihoSlosovani,
  denVTydnu,
  jeVirtualni,
  prekryvy,
  stejnaSazka,
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

describe('stejnaSazka', () => {
  it('nezáleží na pořadí sloupců ani čísel ve sloupci', () => {
    const prehozene = tiket({
      id: 'jiny',
      sloupce: [
        { hra: 'eurojackpot', cisla: [40, 39, 37, 22, 2], eurocisla: [12, 2] },
        { hra: 'eurojackpot', cisla: [47, 37, 33, 30, 23], eurocisla: [3, 2] },
      ],
    });
    expect(stejnaSazka(tiket(), prehozene)).toBe(true);
  });

  it('jiné číslo, jiný kód doplňkové hry nebo sloupec navíc není stejná sázka', () => {
    const a = tiket();
    expect(stejnaSazka(a, tiket({ kodDoplnkoveHry: null }))).toBe(false);
    expect(stejnaSazka(a, tiket({ sloupce: a.sloupce.slice(0, 1) }))).toBe(false);
    expect(
      stejnaSazka(a, tiket({ sloupce: [a.sloupce[0]!, { hra: 'eurojackpot', cisla: [2, 22, 37, 39, 41], eurocisla: [2, 12] }] })),
    ).toBe(false);
  });
});

describe('prekryvy', () => {
  it('najde papírový tiket pokrytý virtuálním se stejnou sázkou', () => {
    const virtualni = tiket({ id: 'v', kontrola: { od: '2026-09-01', do: null, cenaZaSlosovaniKc: 400 } });
    const papirovy = tiket({ id: 'p' });
    const vysledek = prekryvy([virtualni, papirovy], TAHY_EJ);
    expect(vysledek.get('v')).toEqual([{ tiketId: 'p', data: ['2026-09-08'] }]);
    expect(vysledek.get('p')).toEqual([{ tiketId: 'v', data: ['2026-09-08'] }]);
  });

  it('bez společného slosování nebo s jinou sázkou překryv není', () => {
    const virtualni = tiket({ id: 'v', kontrola: { od: '2026-09-01', do: '2026-09-04', cenaZaSlosovaniKc: 400 } });
    const jina = tiket({ id: 'j', kodDoplnkoveHry: null, kontrola: { od: '2026-09-01', do: null, cenaZaSlosovaniKc: null } });
    expect(prekryvy([virtualni, tiket({ id: 'p' }), jina], TAHY_EJ).size).toBe(0);
  });
});
