import { describe, expect, it } from 'vitest';
import { prectiCislaSloupce, prectiCislo, prectiCisla } from '../src/index.js';

describe('prectiCislo', () => {
  it('přečte jedno- i dvouciferné číslo', () => {
    expect(prectiCislo('7')).toEqual({ hodnota: 7, puvodni: '7', opraveno: false });
    expect(prectiCislo('47')).toEqual({ hodnota: 47, puvodni: '47', opraveno: false });
  });

  it('zachová vedoucí nulu jako hodnotu, ne jako text', () => {
    expect(prectiCislo('02')?.hodnota).toBe(2);
  });

  it('opraví jednoznačné záměny a řekne o tom', () => {
    expect(prectiCislo('O2')).toEqual({ hodnota: 2, puvodni: 'O2', opraveno: true });
    expect(prectiCislo('I2')?.hodnota).toBe(12);
    expect(prectiCislo('3O')?.hodnota).toBe(30);
    expect(prectiCislo('4S')?.hodnota).toBe(45);
  });

  it('neopravuje, když v útržku není ani jedna číslice', () => {
    // Jinak by se z „NT“ na tiketu stalo číslo.
    expect(prectiCislo('NT')).toBeNull();
    expect(prectiCislo('OZ')).toBeNull();
    expect(prectiCislo('OO')).toBeNull();
  });

  it('nevymýšlí čísla z textu', () => {
    expect(prectiCislo('SLOSOVÁNÍ')).toBeNull();
    expect(prectiCislo('ÚT')).toBeNull();
    expect(prectiCislo('')).toBeNull();
    expect(prectiCislo('   ')).toBeNull();
  });

  it('odmítne víc než dvě číslice', () => {
    expect(prectiCislo('123')).toBeNull();
    expect(prectiCislo('08.09.2026')).toBeNull();
  });

  it('ořízne interpunkci kolem čísla', () => {
    expect(prectiCislo('47,')?.hodnota).toBe(47);
    expect(prectiCislo('(3)')?.hodnota).toBe(3);
    expect(prectiCislo('1:')?.hodnota).toBe(1);
  });
});

describe('prectiCisla', () => {
  it('přečte celý řádek tiketu a vynechá NT', () => {
    const cisla = prectiCisla('1: 23 30 33 37 47 02 03 NT');
    expect(cisla.map((c) => c.hodnota)).toEqual([1, 23, 30, 33, 37, 47, 2, 3]);
  });

  it('zachová pořadí zleva doprava', () => {
    expect(prectiCisla('3 1 2').map((c) => c.hodnota)).toEqual([3, 1, 2]);
  });

  it('z hlavičky nevytáhne datum jako čísla', () => {
    const cisla = prectiCisla('SLOSOVÁNÍ: 1 (ÚT) 08.09.2026');
    expect(cisla.map((c) => c.hodnota)).toEqual([1]);
  });

  it('poradí si s vícenásobnými mezerami z monospace tisku', () => {
    expect(prectiCisla('1:   23    30').map((c) => c.hodnota)).toEqual([1, 23, 30]);
  });

  it('řádek bez čísel dá prázdný seznam', () => {
    expect(prectiCisla('------------------------------')).toEqual([]);
  });
});

describe('prectiCislaSloupce — čísla na tiketu jsou vždy dvojice číslic', () => {
  const hodnoty = (text: string) => prectiCislaSloupce(text).map((c) => c.hodnota);

  it('čistý řádek přečte stejně jako prectiCisla, bez oprav', () => {
    const cisla = prectiCislaSloupce('23 30 33 37 47 02 03 NT');
    expect(cisla.map((c) => c.hodnota)).toEqual([23, 30, 33, 37, 47, 2, 3]);
    expect(cisla.some((c) => c.opraveno)).toBe(false);
  });

  it('slepená čísla rozdělí po dvojicích a označí k ověření', () => {
    expect(prectiCislaSloupce('0203')).toEqual([
      { hodnota: 2, puvodni: '0203', opraveno: true },
      { hodnota: 3, puvodni: '0203', opraveno: true },
    ]);
    expect(hodnoty('233033')).toEqual([23, 30, 33]);
  });

  it('odřízne přilepené NT (náhodný tip) a hodnotu před ním neoznačí', () => {
    expect(prectiCislaSloupce('03NT')).toEqual([{ hodnota: 3, puvodni: '03NT', opraveno: false }]);
    expect(hodnoty('0203NT')).toEqual([2, 3]);
  });

  it('samotné NT není číslo', () => {
    expect(prectiCislaSloupce('NT')).toEqual([]);
  });

  it('jednu číslici přečte, ale označí — na papíře chybí druhá', () => {
    expect(prectiCislaSloupce('2')).toEqual([{ hodnota: 2, puvodni: '2', opraveno: true }]);
  });

  it('lichý počet číslic od tří nehádá', () => {
    expect(prectiCislaSloupce('023')).toEqual([]);
    expect(prectiCislaSloupce('02030')).toEqual([]);
  });

  it('opraví záměnu písmene za číslici a řekne o tom', () => {
    expect(prectiCislaSloupce('O2')).toEqual([{ hodnota: 2, puvodni: 'O2', opraveno: true }]);
    expect(hodnoty('O2O3')).toEqual([2, 3]);
  });

  it('bez skutečné číslice nic neopravuje', () => {
    expect(prectiCislaSloupce('OO')).toEqual([]);
    expect(prectiCislaSloupce('OZ')).toEqual([]);
  });
});
