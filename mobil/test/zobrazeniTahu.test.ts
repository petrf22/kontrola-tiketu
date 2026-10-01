import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Tah, TahEurojackpot, TahSportka } from '@kontrola-tiketu/jadro';
import { nactiVysledky } from '../src/app/data/import.js';
import { filtrujTahy, VYCHOZI_FILTR_TAHU, zobrazTah } from '../src/app/data/zobrazeniTahu.js';

/** Všechna čísla a částky v očekáváních jsou opsané z balíku, tedy z výherních listin. */
const nactene = nactiVysledky(readFileSync(new URL('fixtures/vysledky-2026-35-az-37.json', import.meta.url), 'utf8'));
if (nactene.stav !== 'ok') throw new Error('Balík výsledků se nenačetl.');
const { tahy, sazbyExtra6, sazbyEurosance } = nactene;
const tah = (hra: Tah['hra'], datum: string) => tahy.find(t => t.hra === hra && t.datum === datum)!;

describe('výběr tahů k prohlížení', () => {
  it('bez filtru jsou nejnovější první a hry téhož dne v pořadí aplikace', () => {
    const vybrane = filtrujTahy(tahy, VYCHOZI_FILTR_TAHU);
    expect(vybrane).toHaveLength(tahy.length);
    expect(vybrane.slice(0, 3).map(t => `${t.hra} ${t.datum}`)).toEqual([
      'euromiliony 2026-09-12', 'eurojackpot 2026-09-08', 'euromiliony 2026-09-08',
    ]);
  });

  it('filtr hry nechá jen tu hru', () => {
    expect(filtrujTahy(tahy, { hra: 'sportka', doData: null }).map(t => t.datum)).toEqual(['2026-09-06', '2026-09-04', '2026-09-02']);
  });

  it('„do data“ zahrne i tah z toho dne', () => {
    expect(filtrujTahy(tahy, { hra: 'vse', doData: '2026-09-04' }).map(t => `${t.hra} ${t.datum}`)).toEqual([
      'eurojackpot 2026-09-04', 'sportka 2026-09-04', 'sportka 2026-09-02', 'eurojackpot 2026-09-01', 'euromiliony 2026-09-01',
    ]);
  });

  it('nemění pořadí v předaném seznamu', () => {
    const kopie = [...tahy];
    filtrujTahy(tahy, VYCHOZI_FILTR_TAHU);
    expect(tahy).toEqual(kopie);
  });
});

describe('zobrazení tahu', () => {
  it('Eurojackpot: čísla vzestupně i v pořadí losování, tabulka z listiny a Extra 6 ze sazeb', () => {
    const z = zobrazTah(tah('eurojackpot', '2026-09-08'), sazbyExtra6, sazbyEurosance);
    expect(z.osudi).toEqual([{ nadpis: null, cisla: [14, 27, 34, 36, 47], vPoradiLosovani: [47, 14, 27, 34, 36], druhe: [3, 4], druheVPoradiLosovani: [4, 3], nazevDruhych: 'euročísla' }]);
    expect(z.doplnkova).toEqual({ nazev: 'Extra 6', cislice: '912799' });
    expect(z.jackpot).toEqual({ nazev: 'Jackpot', castkaKc: 968000000 });

    const [hlavni, extra6] = z.tabulky;
    expect(hlavni!.radky).toHaveLength(12);
    expect(hlavni!.radky.slice(1, 4)).toEqual([
      { popis: '5+1', vzor: null, pocetVyher: 0, castkaKc: 15070584 },
      { popis: '5+0', vzor: null, pocetVyher: 0, castkaKc: 2663542 },
      { popis: '4+2', vzor: null, pocetVyher: 0, castkaKc: 80932 },
    ]);

    // Sazby od 29. 3. 2024: sázka 40 Kč, šestičíslí 25 000×, koncové i sousední číslo 1,5×.
    expect(extra6!.radky.map(r => [r.popis, r.vzor, r.castkaKc])).toEqual([
      ['šestičíslí', '912799', 1000000],
      ['pětičíslí', '12799', 100000],
      ['čtyřčíslí', '2799', 10000],
      ['trojčíslí', '799', 1000],
      ['dvojčíslí', '99', 100],
      ['koncové číslo', '9', 60],
      ['sousední číslo', '0 nebo 8', 60],
    ]);
    expect(extra6!.radky.every(r => r.pocetVyher === null)).toBe(true);
  });

  it('Extra 6 před 29. 3. 2024 sousední číslo nevypisuje — tehdy nevyhrávalo', () => {
    const stary: TahEurojackpot = { ...(tah('eurojackpot', '2026-09-08') as TahEurojackpot), datum: '2023-09-08' };
    const extra6 = zobrazTah(stary, sazbyExtra6, sazbyEurosance).tabulky[1]!;
    expect(extra6.radky.map(r => r.popis)).not.toContain('sousední číslo');
    expect(extra6.radky.find(r => r.popis === 'koncové číslo')!.castkaKc).toBe(120);
  });

  it('bez sazeb Extra 6 ukáže prázdnou tabulku s vysvětlením', () => {
    const extra6 = zobrazTah(tah('eurojackpot', '2026-09-08'), [], sazbyEurosance).tabulky[1]!;
    expect(extra6.radky).toEqual([]);
    expect(extra6.poznamka).toContain('nemá');
  });

  it('Euromiliony: druhé osudí a Eurošance z pevných částek', () => {
    const z = zobrazTah(tah('euromiliony', '2026-09-01'), sazbyExtra6, sazbyEurosance);
    expect(z.osudi[0]).toEqual({ nadpis: null, cisla: [5, 16, 17, 21, 28, 30, 33], vPoradiLosovani: [17, 5, 28, 21, 16, 30, 33], druhe: [4], druheVPoradiLosovani: [4], nazevDruhych: 'druhé osudí' });
    expect(z.jackpot).toEqual({ nazev: 'Jackpot', castkaKc: 89200000 });
    expect(z.tabulky[0]!.radky[3]).toEqual({ popis: '6', vzor: null, pocetVyher: 4, castkaKc: 6141 });
    expect(z.tabulky[1]!.radky.map(r => [r.popis, r.vzor, r.castkaKc])).toEqual([
      ['pětičíslí', '47489', 500000],
      ['čtyřčíslí', '7489', 20000],
      ['trojčíslí', '489', 2000],
      ['dvojčíslí', '89', 200],
      ['koncové číslo', '9', 50],
    ]);
  });

  it('Sportka: oba tahy s dodatkovým, Bonus jednou a Šance se vzory', () => {
    const z = zobrazTah(tah('sportka', '2026-09-02'), sazbyExtra6, sazbyEurosance);
    expect(z.osudi.map(o => [o.nadpis, o.cisla, o.druhe])).toEqual([
      ['1. tah', [5, 18, 19, 21, 34, 37], [42]],
      ['2. tah', [15, 22, 24, 32, 34, 40], [20]],
    ]);
    expect(z.jackpot).toEqual({ nazev: 'Superjackpot', castkaKc: 251000000 });
    expect(z.tabulky.map(t => t.nadpis)).toEqual(['1. tah', '2. tah', 'Bonus', 'Šance']);
    expect(z.tabulky[0]!.radky.map(r => r.popis)).toEqual(['6', '5+dodatkové', '5', '4', '3']);
    expect(z.tabulky[0]!.radky[1]).toEqual({ popis: '5+dodatkové', vzor: null, pocetVyher: 1, castkaKc: 985862 });
    expect(z.tabulky[1]!.radky[2]).toEqual({ popis: '5', vzor: null, pocetVyher: 23, castkaKc: 27252 });

    const sance = z.tabulky[3]!.radky;
    expect(sance[1]).toEqual({ popis: 'pětičíslí', vzor: '36412', pocetVyher: 2, castkaKc: 100000 });
    // Listina u sousedního čísla vzor neuvádí — dopočítá se z koncové číslice 2.
    expect(sance[6]).toEqual({ popis: 'koncové číslo +/- 1', vzor: '1 nebo 3', pocetVyher: 32484, castkaKc: 30 });
  });

  it('tah, ke kterému listina ještě nemá tabulku, nemá žádné tabulky', () => {
    const ej = tah('eurojackpot', '2026-09-08') as TahEurojackpot;
    expect(zobrazTah({ ...ej, poradi: [] }, sazbyExtra6, sazbyEurosance).tabulky).toEqual([]);
    const sp = tah('sportka', '2026-09-02') as TahSportka;
    const bezTabulek: TahSportka = { ...sp, tahy: [{ ...sp.tahy[0], poradi: [] }, { ...sp.tahy[1], poradi: [] }] };
    expect(zobrazTah(bezTabulek, sazbyExtra6, sazbyEurosance).tabulky).toEqual([]);
  });
});
