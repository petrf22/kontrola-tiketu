import { describe, expect, it } from 'vitest';
import {
  formatujDatum,
  formatujDatumCas,
  formatujKc,
  mistoVeSloupci,
  nazevDne,
  nazevDoplnkoveHry,
  nazevHry,
  nazevPoradiDoplnkoveHry,
  pocetSloupcu,
  popisDnuSlosovani,
  popisProblemu,
  popisRozpisuCeny,
  popisRozsahuKontroly,
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

describe('nazevHry a nazevDoplnkoveHry', () => {
  it('pojmenují všechny tři hry i jejich doplňkové hry', () => {
    expect(nazevHry('euromiliony')).toBe('Euromiliony');
    expect(nazevHry('sportka')).toBe('Sportka');
    expect(nazevDoplnkoveHry('eurojackpot')).toBe('Extra 6');
    expect(nazevDoplnkoveHry('sportka')).toBe('Šance');
    expect(nazevDoplnkoveHry('euromiliony')).toBe('Eurošance');
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

describe('popisProblemu', () => {
  const problem = (cesta: string) =>
    ({ kod: 'spatny-pocet-cisel', zprava: 'Očekávají se 2 čísla, zadáno 0.', cesta }) as const;

  it('řekne, ve kterém sloupci a poli chyba je', () => {
    expect(popisProblemu(problem('sloupce[0].cisla'))).toBe('1. sloupec, čísla: Očekávají se 2 čísla, zadáno 0.');
    expect(popisProblemu(problem('sloupce[1].eurocisla'))).toBe(
      '2. sloupec, euročísla: Očekávají se 2 čísla, zadáno 0.',
    );
    expect(popisProblemu(problem('sloupce[2].druheOsudi[0]'))).toBe(
      '3. sloupec, druhé osudí: Očekávají se 2 čísla, zadáno 0.',
    );
  });

  it('problém mimo sloupce nechá beze změny', () => {
    expect(popisProblemu(problem('kodDoplnkoveHry'))).toBe('Očekávají se 2 čísla, zadáno 0.');
  });
});

describe('mistoVeSloupci', () => {
  it('euročísla i druhé osudí patří do druhého políčka', () => {
    expect(mistoVeSloupci('sloupce[3].eurocisla[1]')).toEqual({ index: 3, pole: 'druhe', nazev: 'euročísla' });
    expect(mistoVeSloupci('sloupce[0].druheOsudi')?.pole).toBe('druhe');
    expect(mistoVeSloupci('sloupce[12].cisla[4]')).toEqual({ index: 12, pole: 'cisla', nazev: 'čísla' });
  });

  it('jiné cesty nejsou ve sloupci', () => {
    expect(mistoVeSloupci('sloupce')).toBeNull();
    expect(mistoVeSloupci('sloupce[0]')).toBeNull();
    expect(mistoVeSloupci('slosovani.dny')).toBeNull();
  });
});

describe('formatujKc', () => {
  it('odděluje tisíce a nechá znaménko', () => {
    // Intl odděluje tisíce nezlomitelnou mezerou, aby se částka nerozdělila na dva řádky.
    expect(formatujKc(61160).replace(/\s/g, ' ')).toBe('61 160 Kč');
    expect(formatujKc(-400)).toBe('-400 Kč');
    expect(formatujKc(133.33)).toBe('133,33 Kč');
  });
});

describe('popisRozpisuCeny', () => {
  it('rozepíše sloupce, doplňkovou hru i předplatné', () => {
    expect(
      popisRozpisuCeny('eurojackpot', { sloupcu: 6, sloupecKc: 60, doplnkovaHraKc: 40, slosovani: 1, celkemKc: 400 }),
    ).toBe('6 × 60 Kč + Extra 6 40 Kč = 400 Kč');
    expect(
      popisRozpisuCeny('sportka', { sloupcu: 8, sloupecKc: 30, doplnkovaHraKc: 30, slosovani: 3, celkemKc: 810 }),
    ).toBe('(8 × 30 Kč + Šance 30 Kč) × 3 slosování = 810 Kč');
    expect(
      popisRozpisuCeny('euromiliony', { sloupcu: 2, sloupecKc: 30, doplnkovaHraKc: null, slosovani: 2, celkemKc: 120 }),
    ).toBe('2 × 30 Kč × 2 slosování = 120 Kč');
  });
});

describe('popisRozsahuKontroly', () => {
  it('rozliší rozsah bez konce a s koncem', () => {
    expect(popisRozsahuKontroly({ od: '2023-09-12', do: null })).toBe('od 12. 9. 2023, bez konce');
    expect(popisRozsahuKontroly({ od: '2026-09-01', do: '2026-09-08' })).toBe('od 1. 9. 2026 do 8. 9. 2026');
  });
});
