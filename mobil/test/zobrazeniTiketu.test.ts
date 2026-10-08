import { describe, expect, it } from 'vitest';
import { vyhodnotTiket, type Tiket } from '@kontrola-tiketu/jadro';
import { EJ_2026_09_08 } from '../knihovny/jadro/test/fixtures/eurojackpot.js';
import { dnesniDatum, formatujDatum } from '../src/app/data/format.js';
import {
  cekaniNaSlosovani, dosudJisty, historieTiketu, nactenyFiltrSeznamu, neuplneSlosovani, popisTerminu,
  semaforBilance, semaforVyhry, sUpravenouCenou, VYCHOZI_FILTR_SEZNAMU,
} from '../src/app/data/zobrazeniTiketu.js';

const tiket: Tiket = {
  id: 'test', hra: 'eurojackpot', sloupce: [{ hra: 'eurojackpot', cisla: [47, 14, 27, 34, 1], eurocisla: [4, 1] }],
  slosovani: { prvni: '2026-09-08', pocet: 1, dny: null }, cenaKc: null, kodDoplnkoveHry: null, vlozeno: '2026-09-08T12:00:00Z',
};

describe('cena a historie pro rozhraní', () => {
  it('odliší automatickou cenu od nuly a zachová archiv', () => {
    const t = { ...tiket, archivovany: true };
    expect(sUpravenouCenou(t, '').cenaKc).toBeNull();
    expect(sUpravenouCenou(t, '0')).toEqual({ ...t, cenaKc: 0 });
    expect(sUpravenouCenou(t, '12,50').cenaKc).toBe(12.5);
  });
  it.each(['-1', 'abc', 'Infinity', '1e1000', '1.2.3'])('neplatná cena %s se nesmí změnit na automatickou', cena => {
    expect(() => sUpravenouCenou(tiket, cena)).toThrow();
  });
  it('virtuální tiket mění cenu slosování, nikoli cenu papíru nebo rozsah', () => {
    const t = { ...tiket, archivovany: true, kontrola: { od: '2026-09-01', do: null, cenaZaSlosovaniKc: null } };
    expect(sUpravenouCenou(t, '0')).toEqual({ ...t, kontrola: { ...t.kontrola, cenaZaSlosovaniKc: 0 } });
    expect(sUpravenouCenou(t, '').kontrola?.cenaZaSlosovaniKc).toBeNull();
  });
  it('výhru bez částky zahrne mezi výherní i neúplná slosování', () => {
    const vysledek = vyhodnotTiket(tiket, [{ ...EJ_2026_09_08, poradi: [] }], []);
    const s = vysledek.slosovani[0]!;
    expect(s.vyhry.length).toBeGreaterThan(0);
    expect(s.vyhry[0]?.castkaKc).toBeNull();
    expect(neuplneSlosovani(s)).toBe(true);
    expect(historieTiketu([s], 'vyherni')).toEqual([s]);
    expect(historieTiketu([s], 'neuplna')).toEqual([s]);
  });
  it('řazení historie nemění původní výsledky', () => {
    const s = vyhodnotTiket(tiket, [EJ_2026_09_08], []).slosovani[0]!;
    const puvodni = [{ ...s, datum: '2026-09-01' }, s];
    expect(historieTiketu(puvodni, 'vsechna').map(s => s.datum)).toEqual(['2026-09-08', '2026-09-01']);
    expect(puvodni[0]?.datum).toBe('2026-09-01');
  });
});

describe('tiket, který ještě nebyl slosován', () => {
  const budouci = { ...tiket, slosovani: { ...tiket.slosovani, prvni: '2026-09-12' } };
  const cekani = (t: Tiket, dnes: string) => cekaniNaSlosovani(t, vyhodnotTiket(t, [EJ_2026_09_08]), dnes);

  it('s vyhodnoceným slosováním se nečeká', () => {
    expect(cekani(tiket, '2026-09-20')).toBeNull();
  });
  it('slosování zítra i dnes večer je teprve před námi', () => {
    expect(cekani(budouci, '2026-09-11')).toEqual({ duvod: 'pred-slosovanim', od: '2026-09-12' });
    expect(cekani(budouci, '2026-09-12')).toEqual({ duvod: 'pred-slosovanim', od: '2026-09-12' });
  });
  it('proběhlé slosování bez stažených výsledků se od čekání liší', () => {
    expect(cekani(budouci, '2026-09-13')).toEqual({ duvod: 'chybi-vysledky', od: '2026-09-12' });
  });
  it('virtuální tiket čeká od začátku rozsahu kontroly', () => {
    const t = { ...tiket, kontrola: { od: '2026-09-15', do: null, cenaZaSlosovaniKc: null } };
    expect(cekani(t, '2026-09-14')).toEqual({ duvod: 'pred-slosovanim', od: '2026-09-15' });
  });
  it('dnešní datum je místní, ne UTC', () => {
    expect(dnesniDatum(new Date(2026, 8, 24, 23, 59))).toBe('2026-09-24');
    expect(dnesniDatum(new Date(2026, 0, 1, 0, 1))).toBe('2026-01-01');
  });
});

describe('uložený filtr seznamu', () => {
  it('platné hodnoty převezme', () => {
    expect(nactenyFiltrSeznamu({ typ: 'virtualni', nazev: 'prace', seskupit: false }))
      .toEqual({ typ: 'virtualni', nazev: 'prace', seskupit: false });
  });
  it.each([null, 'text', 42, { typ: 'vse', nazev: 7, seskupit: 'ano' }])('nečitelný záznam %j dá výchozí filtr', data => {
    expect(nactenyFiltrSeznamu(data)).toEqual(VYCHOZI_FILTR_SEZNAMU);
  });
  it('chybějící položka dostane výchozí hodnotu, ostatní zůstanou', () => {
    expect(nactenyFiltrSeznamu({ typ: 'papirove' })).toEqual({ ...VYCHOZI_FILTR_SEZNAMU, typ: 'papirove' });
  });
});

describe('termín tiketu v seznamu', () => {
  const d = formatujDatum;
  it('jedno slosování jen datem', () => {
    expect(popisTerminu(tiket, [])).toBe(d('2026-09-08'));
  });
  it('papír na víc slosování dopočítá konec z rozvrhu i ze známých tahů', () => {
    // Eurojackpot losuje v úterý a v pátek: 8., 11. a 15. 9.
    const tri = { ...tiket, slosovani: { ...tiket.slosovani, pocet: 3 } };
    expect(popisTerminu(tri, [])).toBe(`${d('2026-09-08')} – ${d('2026-09-15')}`);
    expect(popisTerminu(tri, [EJ_2026_09_08])).toBe(`${d('2026-09-08')} – ${d('2026-09-15')}`);
  });
  it('virtuální tiket: stejný den, rozsah a bez konce', () => {
    const virtualni = (od: string, doData: string | null) => ({ ...tiket, kontrola: { od, do: doData, cenaZaSlosovaniKc: null } });
    expect(popisTerminu(virtualni('2026-09-01', '2026-09-01'), [])).toBe(d('2026-09-01'));
    expect(popisTerminu(virtualni('2026-09-01', '2026-09-30'), [])).toBe(`${d('2026-09-01')} – ${d('2026-09-30')}`);
    expect(popisTerminu(virtualni('2026-09-01', null), [])).toBe(`${d('2026-09-01')} – …`);
  });
});

describe('semafor částek', () => {
  it('výhra: nekonečná má důraz, jinak výhra nebo nula', () => {
    expect(semaforVyhry(150, false)).toBe('nehotovy');
    expect(semaforVyhry(0, false)).toBe('nehotovy');
    expect(semaforVyhry(150, true)).toBe('vyhra');
    expect(semaforVyhry(0, true)).toBe('nula');
  });
  it('bilance: zisk, výhra pod vsazeným, prohra; nekonečná jako výhra', () => {
    expect(semaforBilance(500, 100, true)).toBe('zisk');
    expect(semaforBilance(400, 0, true)).toBe('ztrata-s-vyhrou');
    expect(semaforBilance(150, -250, true)).toBe('ztrata-s-vyhrou');
    expect(semaforBilance(0, -400, true)).toBe('prohra');
    expect(semaforBilance(500, 100, false)).toBe('nehotovy');
    expect(semaforBilance(150, null, true)).toBe('nula');
  });
  it('virtuální tiket, který běží dál, má dosavadní výsledek jistý', () => {
    const v = vyhodnotTiket({ ...tiket, kontrola: { od: '2026-09-08', do: null, cenaZaSlosovaniKc: null } }, [EJ_2026_09_08], []);
    expect(v.soucetJisty).toBe(false);
    expect(dosudJisty(v)).toBe(true);
  });
});
