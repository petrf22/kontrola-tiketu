import { describe, expect, it } from 'vitest';
import { prectiCenu } from '../src/index.js';

describe('prectiCenu', () => {
  it('přečte částku v podobě, kterou má reálný tiket', () => {
    // Ověřeno na tiketu Eurojackpotu 9. 9. 2026.
    expect(prectiCenu(['400 Kč'])).toBe(400);
  });

  it('poradí si s oddělovačem tisíců', () => {
    expect(prectiCenu(['1 200 Kč'])).toBe(1200);
    expect(prectiCenu(['1 200 Kč'])).toBe(1200);
  });

  it('najde částku mezi ostatními řádky', () => {
    expect(prectiCenu(['SLOSOVÁNÍ: 1 (ÚT)', '1: 23 30 33 37 47', '400 Kč', 'Děkujeme'])).toBe(400);
  });

  it('snese popisek před částkou', () => {
    expect(prectiCenu(['Vklad celkem 400 Kč'])).toBe(400);
  });

  it('nevymýšlí — bez částky vrátí null', () => {
    expect(prectiCenu(['1: 23 30 33 37 47'])).toBeNull();
    expect(prectiCenu([])).toBeNull();
    expect(prectiCenu(['Kč'])).toBeNull();
  });

  it('nesebere číslo, které není částka', () => {
    // Datum ani sériové číslo nejsou cena.
    expect(prectiCenu(['08.09.2026', '12395-043390722-029398'])).toBeNull();
  });

  it('nulovou částku nebere — tiket zadarmo neexistuje', () => {
    expect(prectiCenu(['0 Kč'])).toBeNull();
  });
});
