import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  PLNA_SAZENKA_SPORTKA,
  splnujePodminkyBonusu,
  vyberSlosovani,
  vyhodnotTiket,
  type SazbyExtra6,
  type Sloupec,
  type Tah,
  type Tiket,
} from '../src/index.js';
import { EJ_2026_09_01, EJ_2026_09_04, EJ_2026_09_08 } from './fixtures/eurojackpot.js';
import { SP_2026_09_02, SP_2026_09_04, SP_2026_09_06 } from './fixtures/sportka.js';

const SAZBY: readonly SazbyExtra6[] = JSON.parse(
  readFileSync(new URL('../../../data/sazby-extra6.json', import.meta.url), 'utf8'),
).sazby;

const TAHY_EJ: readonly Tah[] = [EJ_2026_09_01, EJ_2026_09_04, EJ_2026_09_08];
const TAHY_SP: readonly Tah[] = [SP_2026_09_02, SP_2026_09_04, SP_2026_09_06];

function tiketEJ(over: Partial<Tiket> = {}): Tiket {
  return {
    id: 'ej-test',
    hra: 'eurojackpot',
    sloupce: [{ hra: 'eurojackpot', cisla: [47, 14, 27, 34, 36], eurocisla: [4, 3] }],
    slosovani: { prvni: '2026-09-08', pocet: 1, dny: null },
    kodDoplnkoveHry: null,
    cenaKc: null,
    vlozeno: '2026-09-07T10:00:00Z',
    ...over,
  };
}

function tiketSP(over: Partial<Tiket> = {}): Tiket {
  return {
    id: 'sp-test',
    hra: 'sportka',
    sloupce: [{ hra: 'sportka', cisla: [21, 5, 37, 18, 34, 19] }],
    slosovani: { prvni: '2026-09-02', pocet: 1, dny: null },
    kodDoplnkoveHry: null,
    cenaKc: null,
    vlozeno: '2026-09-01T10:00:00Z',
    ...over,
  };
}

describe('vyberSlosovani', () => {
  it('vezme slosování od prvního data, v počtu podle tiketu', () => {
    const t = tiketEJ({ slosovani: { prvni: '2026-09-01', pocet: 2, dny: null } });
    const { pouzite, chybi } = vyberSlosovani(t, TAHY_EJ);
    expect(pouzite.map((x) => x.datum)).toEqual(['2026-09-01', '2026-09-04']);
    expect(chybi).toBe(0);
  });

  it('ignoruje slosování před prvním datem', () => {
    const t = tiketEJ({ slosovani: { prvni: '2026-09-04', pocet: 5, dny: null } });
    expect(vyberSlosovani(t, TAHY_EJ).pouzite.map((x) => x.datum)).toEqual([
      '2026-09-04',
      '2026-09-08',
    ]);
  });

  it('hlásí, kolik slosování v datech chybí', () => {
    const t = tiketEJ({ slosovani: { prvni: '2026-09-04', pocet: 5, dny: null } });
    expect(vyberSlosovani(t, TAHY_EJ).chybi).toBe(3);
  });

  it('nemíchá hry', () => {
    const t = tiketEJ({ slosovani: { prvni: '2026-09-01', pocet: 9, dny: null } });
    const { pouzite } = vyberSlosovani(t, [...TAHY_EJ, ...TAHY_SP]);
    expect(pouzite.every((x) => x.hra === 'eurojackpot')).toBe(true);
    expect(pouzite).toHaveLength(3);
  });

  it('respektuje výběr dnů — tiket Sportky jen na neděli', () => {
    const t = tiketSP({ slosovani: { prvni: '2026-09-02', pocet: 1, dny: ['ne'] } });
    expect(vyberSlosovani(t, TAHY_SP).pouzite.map((x) => x.datum)).toEqual(['2026-09-06']);
  });

  it('řadí podle data i při zamíchaném vstupu', () => {
    const t = tiketEJ({ slosovani: { prvni: '2026-09-01', pocet: 3, dny: null } });
    const zamichane = [EJ_2026_09_08, EJ_2026_09_01, EJ_2026_09_04];
    expect(vyberSlosovani(t, zamichane).pouzite.map((x) => x.datum)).toEqual([
      '2026-09-01',
      '2026-09-04',
      '2026-09-08',
    ]);
  });
});

describe('vyhodnotTiket — Eurojackpot', () => {
  it('plná shoda dá I. pořadí a částku z listiny', () => {
    const v = vyhodnotTiket(tiketEJ(), TAHY_EJ, SAZBY);
    expect(v.slosovani).toHaveLength(1);
    const vyhry = v.slosovani[0]!.vyhry;
    expect(vyhry).toHaveLength(1);
    expect(vyhry[0]!.poradi).toBe('I');
    expect(vyhry[0]!.castkaKc).toBe(0); // 8. 9. 2026 nemělo v I. pořadí výherce ani částku
  });

  it('sčítá výhry přes všechna slosování tiketu', () => {
    // Sloupec, který v každém ze tří tahů trefí právě tři hlavní čísla.
    const t = tiketEJ({
      sloupce: [{ hra: 'eurojackpot', cisla: [47, 14, 27, 9, 35], eurocisla: [11, 12] }],
      slosovani: { prvni: '2026-09-01', pocet: 3, dny: null },
    });
    const v = vyhodnotTiket(t, TAHY_EJ, SAZBY);
    const soucet = v.slosovani.reduce((s, x) => s + x.celkemKc, 0);
    expect(v.celkemKc).toBe(soucet);
    expect(v.slosovani).toHaveLength(3);
  });

  it('Extra 6 přidá výhru navíc k výhře ze sloupce', () => {
    const t = tiketEJ({ kodDoplnkoveHry: '000799' }); // tažené 912799 → trojčíslí
    const vyhry = vyhodnotTiket(t, TAHY_EJ, SAZBY).slosovani[0]!.vyhry;
    expect(vyhry.map((x) => x.zdroj)).toEqual(['sloupec', 'doplnkova-hra']);
    expect(vyhry[1]!.poradi).toBe('trojcisli');
    expect(vyhry[1]!.castkaKc).toBe(1000);
  });

  it('bez vsazené doplňkové hry se Extra 6 nevyhodnocuje', () => {
    const vyhry = vyhodnotTiket(tiketEJ({ kodDoplnkoveHry: null }), TAHY_EJ, SAZBY)
      .slosovani[0]!.vyhry;
    expect(vyhry.every((x) => x.zdroj !== 'doplnkova-hra')).toBe(true);
  });
});

describe('vyhodnotTiket — Sportka', () => {
  it('jeden sloupec vyhodnotí v obou tazích slosování', () => {
    const v = vyhodnotTiket(tiketSP(), TAHY_SP, SAZBY);
    const sloupce = v.slosovani[0]!.sloupce;
    expect(sloupce).toHaveLength(1);
    expect(sloupce[0]!.hra).toBe('sportka');
    if (sloupce[0]!.hra === 'sportka') {
      expect(sloupce[0]!.vysledky.map((x) => x.poradiTahu)).toEqual([1, 2]);
    }
  });

  it('výhra nese, ve kterém tahu vznikla', () => {
    const t = tiketSP({ sloupce: [{ hra: 'sportka', cisla: [40, 15, 34, 32, 24, 1] }] });
    const vyhry = vyhodnotTiket(t, TAHY_SP, SAZBY).slosovani[0]!.vyhry;
    const vDruhemTahu = vyhry.filter((x) => x.poradiTahu === 2);
    expect(vDruhemTahu).toHaveLength(1);
    expect(vDruhemTahu[0]!.poradi).toBe('III'); // 5 čísel bez dodatkového
    expect(vDruhemTahu[0]!.castkaKc).toBe(27252);
  });

  it('Šance se vyhodnotí samostatně, nezávisle na sloupcích', () => {
    const t = tiketSP({
      sloupce: [{ hra: 'sportka', cisla: [1, 2, 3, 4, 6, 7] }], // nevýherní sloupec
      kodDoplnkoveHry: '996412', // tažené 236412 → čtyřčíslí
    });
    const vyhry = vyhodnotTiket(t, TAHY_SP, SAZBY).slosovani[0]!.vyhry;
    expect(vyhry).toHaveLength(1);
    expect(vyhry[0]!.zdroj).toBe('doplnkova-hra');
    expect(vyhry[0]!.castkaKc).toBe(10000);
  });
});

describe('Bonus Sportky', () => {
  const osmSloupcu = (prvni: Sloupec): Sloupec[] => [
    prvni,
    ...Array.from({ length: PLNA_SAZENKA_SPORTKA - 1 }, (_, i) => ({
      hra: 'sportka' as const,
      cisla: [1 + i, 2 + i, 3 + i, 40, 41, 42].slice(0, 6),
    })),
  ];
  const vyherniSloupec: Sloupec = { hra: 'sportka', cisla: [21, 5, 37, 18, 34, 19] };

  it('podmínky vyžadují plnou sázenku i vsazenou Šanci', () => {
    expect(splnujePodminkyBonusu(tiketSP({ sloupce: [vyherniSloupec], kodDoplnkoveHry: '236412' })))
      .toBe(false);
    expect(splnujePodminkyBonusu(tiketSP({ sloupce: osmSloupcu(vyherniSloupec), kodDoplnkoveHry: null })))
      .toBe(false);
    expect(
      splnujePodminkyBonusu(
        tiketSP({ sloupce: osmSloupcu(vyherniSloupec), kodDoplnkoveHry: '236412' }),
      ),
    ).toBe(true);
  });

  it('přizná se k šestce, když Šance vyhrála mimo sedmé pořadí', () => {
    const t = tiketSP({ sloupce: osmSloupcu(vyherniSloupec), kodDoplnkoveHry: '996412' });
    const vyhry = vyhodnotTiket(t, TAHY_SP, SAZBY).slosovani[0]!.vyhry;
    const bonus = vyhry.filter((x) => x.zdroj === 'bonus');
    expect(bonus).toHaveLength(1);
    expect(bonus[0]!.poradiTahu).toBe(1);
  });

  it('nepřizná se, když Šance vyhrála jen sedmé pořadí', () => {
    // Tažené 236412, koncové 2; sázenka s koncovým 1 trefí sousední číslo.
    const t = tiketSP({ sloupce: osmSloupcu(vyherniSloupec), kodDoplnkoveHry: '999991' });
    const vyhry = vyhodnotTiket(t, TAHY_SP, SAZBY).slosovani[0]!.vyhry;
    expect(vyhry.some((x) => x.zdroj === 'bonus')).toBe(false);
    expect(vyhry.some((x) => x.poradi === 'sousedni-cislo')).toBe(true);
  });

  it('nepřizná se bez šestky, ani když je Šance výherní', () => {
    const bezSestky: Sloupec = { hra: 'sportka', cisla: [21, 5, 37, 18, 34, 1] };
    const t = tiketSP({ sloupce: osmSloupcu(bezSestky), kodDoplnkoveHry: '996412' });
    const vyhry = vyhodnotTiket(t, TAHY_SP, SAZBY).slosovani[0]!.vyhry;
    expect(vyhry.some((x) => x.zdroj === 'bonus')).toBe(false);
  });

  it('nepřizná se na neplnou sázenku', () => {
    const t = tiketSP({ sloupce: [vyherniSloupec], kodDoplnkoveHry: '996412' });
    const vyhry = vyhodnotTiket(t, TAHY_SP, SAZBY).slosovani[0]!.vyhry;
    expect(vyhry.some((x) => x.zdroj === 'bonus')).toBe(false);
  });
});

describe('jistota součtu', () => {
  it('je jistý, když jsou všechna slosování k dispozici a nic nemá výhradu', () => {
    const v = vyhodnotTiket(tiketEJ(), TAHY_EJ, SAZBY);
    expect(v.chybejicichSlosovani).toBe(0);
    expect(v.soucetJisty).toBe(true);
  });

  it('není jistý, když chybí slosování — „nevyhrál jsi“ není totéž co „zatím nevím“', () => {
    const t = tiketEJ({ slosovani: { prvni: '2026-09-08', pocet: 4, dny: null } });
    const v = vyhodnotTiket(t, TAHY_EJ, SAZBY);
    expect(v.chybejicichSlosovani).toBe(3);
    expect(v.soucetJisty).toBe(false);
  });

  it('není jistý u prvního pořadí Extra 6, kde se výhra může dělit', () => {
    const t = tiketEJ({ kodDoplnkoveHry: '912799' }); // plná shoda s taženým 912799
    const v = vyhodnotTiket(t, TAHY_EJ, SAZBY);
    expect(v.slosovani[0]!.nejistychVyher).toBe(1);
    expect(v.soucetJisty).toBe(false);
  });

  it('bez sazeb Extra 6 se částka nedopočítá a součet je neúplný', () => {
    const t = tiketEJ({ kodDoplnkoveHry: '000799' });
    const v = vyhodnotTiket(t, TAHY_EJ, []);
    const doplnkova = v.slosovani[0]!.vyhry.find((x) => x.zdroj === 'doplnkova-hra');
    expect(doplnkova?.castkaKc).toBeNull();
    expect(doplnkova?.vyhrada).toBe('chybi-sazby');
    expect(v.soucetJisty).toBe(false);
  });

  it('prázdný vstup dá nulový součet, ne chybu', () => {
    const v = vyhodnotTiket(tiketEJ(), [], SAZBY);
    expect(v.slosovani).toEqual([]);
    expect(v.celkemKc).toBe(0);
    expect(v.chybejicichSlosovani).toBe(1);
    expect(v.soucetJisty).toBe(false);
  });
});

describe('bilance tiketu', () => {
  it('spočítá výhru minus cenu', () => {
    // 4+1 v tahu 8. 9. 2026 dává 5 780 Kč; tiket za 400 Kč tedy vydělal.
    const t: Tiket = {
      ...tiketEJ(),
      sloupce: [{ hra: 'eurojackpot', cisla: [47, 14, 27, 34, 1], eurocisla: [4, 1] }],
      cenaKc: 400,
    };
    const v = vyhodnotTiket(t, TAHY_EJ, SAZBY);
    expect(v.celkemKc).toBe(5780);
    expect(v.bilanceKc).toBe(5380);
  });

  it('u prodělečného tiketu je bilance záporná', () => {
    const t: Tiket = { ...tiketEJ({ sloupce: [{ hra: 'eurojackpot', cisla: [1, 2, 3, 4, 5], eurocisla: [11, 12] }] }), cenaKc: 400 };
    const v = vyhodnotTiket(t, TAHY_EJ, SAZBY);
    expect(v.celkemKc).toBe(0);
    expect(v.bilanceKc).toBe(-400);
  });

  it('bez známé ceny je bilance null, ne nula', () => {
    // Nula by tvrdila, že tiket byl zadarmo.
    expect(vyhodnotTiket(tiketEJ(), TAHY_EJ, SAZBY).bilanceKc).toBeNull();
  });

  it('cena nemá vliv na vyhodnocení výher', () => {
    const bez = vyhodnotTiket(tiketEJ(), TAHY_EJ, SAZBY);
    const s = vyhodnotTiket({ ...tiketEJ(), cenaKc: 400 }, TAHY_EJ, SAZBY);
    expect(s.celkemKc).toBe(bez.celkemKc);
    expect(s.slosovani).toEqual(bez.slosovani);
  });
});
