import { describe, expect, it } from 'vitest';
import { klicNazvu, seskupPodleNazvu, upravNazev } from '../src/app/data/nazvyTiketu.js';

describe('Názvy tiketů', () => {
  it('sjednotí mezery, velikost písmen a Unicode, zachová diakritiku', () => {
    expect(upravNazev('  Práce\t v   pěti  ')).toBe('Práce v pěti');
    expect(klicNazvu(' PRÁCE ')).toBe(klicNazvu('práce'.normalize('NFD')));
    expect(klicNazvu('prace')).not.toBe(klicNazvu('práce'));
    expect(upravNazev(' \n ')).toBeNull();
    expect(klicNazvu(undefined)).toBe(klicNazvu(null));
  });

  it('neplete názvy se zvláštními hodnotami filtru ani klíči objektů', () => {
    const nazvy = [undefined, null, ' ', 'Bez názvu', '*', '__proto__'];
    const skupiny = seskupPodleNazvu(nazvy, n => n);
    expect(skupiny).toHaveLength(4);
    expect(skupiny.at(-1)?.polozky).toEqual([undefined, null, ' ']);
    expect(klicNazvu('*')).not.toBe('*');
  });

  it('seskupuje napříč hrami a zachová pořadí uvnitř skupin', () => {
    const polozky = [
      { nazev: 'práce', hra: 'sportka' },
      { nazev: 'kolega', hra: 'euromiliony' },
      { nazev: ' PRÁCE ', hra: 'eurojackpot' },
      { nazev: 'Práce', hra: 'euromiliony' },
    ];
    const skupiny = seskupPodleNazvu(polozky, p => p.nazev);
    expect(skupiny.map(s => s.nazev)).toEqual(['kolega', 'práce']);
    expect(skupiny[1]?.polozky.map(p => p.hra)).toEqual(['sportka', 'eurojackpot', 'euromiliony']);
    expect(seskupPodleNazvu([], () => '')).toEqual([]);
  });
});
