import { CapacitorException } from '@capacitor/core';
import { describe, expect, it } from 'vitest';
import { chybaProUzivatele } from './chybaProUzivatele';

describe('Text chyby pro uživatele', () => {
  it('anglickou hlášku z pluginu nahradí českou větou, naši chybu nechá', () => {
    expect(chybaProUzivatele(new CapacitorException('User cancelled photos app'), 'Náhrada.')).toBe('Náhrada.');
    expect(chybaProUzivatele(new Error('Naše česká chyba.'), 'Náhrada.')).toBe('Naše česká chyba.');
    expect(chybaProUzivatele('cokoliv', 'Náhrada.')).toBe('Náhrada.');
  });
});
