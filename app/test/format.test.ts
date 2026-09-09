import { describe, expect, it } from 'vitest';
import { formatujDatum, formatujDatumCas, nazevDne } from '../src/app/data/format.js';

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
