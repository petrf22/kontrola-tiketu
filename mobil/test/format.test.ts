import { describe, expect, it } from 'vitest';
import {
  formatujDatum,
  formatujDatumCas,
  nazevDne,
  nazevPoradiDoplnkoveHry,
  pocetSloupcu,
  popisDnuSlosovani,
} from '../src/app/data/format.js';

describe('formatujDatum', () => {
  it('píše datum česky, ne v ISO tvaru', () => {
    expect(formatujDatum('2026-09-08')).toBe('8. 9. 2026');
    expect(formatujDatum('2026-12-24')).toBe('24. 12. 2026');
  });

  it('nedoplňuje vedoucí nuly, jak je v češtině zvykem', () => {
    expect(formatujDatum('2026-01-05')).toBe('5. 1. 2026');
  });

  it('nesrozumitelný vstup vrátí beze změny, místo aby zobrazil „Invalid Date“', () => {
    expect(formatujDatum('')).toBe('');
    expect(formatujDatum('nesmysl')).toBe('nesmysl');
  });
});

describe('formatujDatumCas', () => {
  it('přidá čas k datu', () => {
    expect(formatujDatumCas('2026-09-08T12:34:00Z')).toMatch(/^8\. 9\. 2026 \d{2}:\d{2}$/);
  });

  it('vadný vstup vrátí beze změny', () => {
    expect(formatujDatumCas('nesmysl')).toBe('nesmysl');
  });
});

describe('nazevDne', () => {
  it('rozepisuje zkratky', () => {
    expect(nazevDne('ut')).toBe('úterý');
    expect(nazevDne('ne')).toBe('neděle');
  });

  it('neznámou zkratku nechá být', () => {
    expect(nazevDne('xx')).toBe('xx');
  });
});

describe('nazevPoradiDoplnkoveHry', () => {
  it('místo klíče z modelu vypíše, co uživatel trefil', () => {
    // Bez tohohle stálo v detailu tiketu „pořadí trojcisli“.
    expect(nazevPoradiDoplnkoveHry('trojcisli')).toBe('trojčíslí');
    expect(nazevPoradiDoplnkoveHry('koncove-cislo')).toBe('koncové číslo');
    expect(nazevPoradiDoplnkoveHry('sousedni-cislo')).toBe('sousední číslo');
  });

  it('neznámý klíč vrátí beze změny, ať se neztratí', () => {
    expect(nazevPoradiDoplnkoveHry('sedmicisli')).toBe('sedmicisli');
  });
});

describe('pocetSloupcu', () => {
  it('skloňuje podle počtu, jak má čeština', () => {
    expect(pocetSloupcu(1)).toBe('1 sloupec');
    expect(pocetSloupcu(2)).toBe('2 sloupce');
    expect(pocetSloupcu(4)).toBe('4 sloupce');
    expect(pocetSloupcu(5)).toBe('5 sloupců');
    expect(pocetSloupcu(10)).toBe('10 sloupců');
  });
});

describe('popisDnuSlosovani', () => {
  it('tiket na všechna slosování nemá co upřesňovat', () => {
    expect(popisDnuSlosovani(null)).toBe('');
  });

  it('skloňuje dny, jak se říkají v odpovědi na otázku kdy', () => {
    expect(popisDnuSlosovani(['ne'])).toBe('jen v neděli');
    expect(popisDnuSlosovani(['st', 'ne'])).toBe('jen ve středu a v neděli');
    expect(popisDnuSlosovani(['ut'])).toBe('jen v úterý');
  });

  it('víc dnů spojí čárkou a poslední spojkou', () => {
    expect(popisDnuSlosovani(['st', 'pa', 'ne'])).toBe('jen ve středu, v pátek a v neděli');
  });
});
