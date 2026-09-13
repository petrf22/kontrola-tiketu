import { describe, expect, it } from 'vitest';
import { prectiKodDoplnkoveHry } from '../src/index.js';

describe('prectiKodDoplnkoveHry — Eurojackpot', () => {
  it('přečte podobu, kterou má reálný tiket', () => {
    // Ověřeno na tiketu 9. 9. 2026.
    expect(prectiKodDoplnkoveHry(['Extra 6: 845991'], 'eurojackpot')).toBe('845991');
  });

  it('nezáleží na velikosti písmen ani na mezeře v popisku', () => {
    for (const radek of ['EXTRA 6: 845991', 'extra6 845991', 'Extra6: 845991']) {
      expect(prectiKodDoplnkoveHry([radek], 'eurojackpot'), radek).toBe('845991');
    }
  });

  it('poradí si s číslicemi rozsekanými mezerami', () => {
    expect(prectiKodDoplnkoveHry(['Extra 6: 8 4 5 9 9 1'], 'eurojackpot')).toBe('845991');
  });

  it('zachová vedoucí nulu', () => {
    // Kdyby se kód četl jako číslo, nula by zmizela a vyhodnocení by sedělo na jiný vzor.
    expect(prectiKodDoplnkoveHry(['Extra 6: 057739'], 'eurojackpot')).toBe('057739');
  });

  it('opraví nulu přečtenou jako písmeno O', () => {
    expect(prectiKodDoplnkoveHry(['Extra 6: O57739'], 'eurojackpot')).toBe('057739');
    expect(prectiKodDoplnkoveHry(['Extra 6: 84599I'], 'eurojackpot')).toBe('845991');
  });

  it('najde řádek mezi ostatními', () => {
    const radky = [
      'SLOSOVÁNÍ: 1 (ÚT) 08.09.2026',
      '1: 23 30 33 37 47 02 03 NT',
      'Extra 6: 845991',
      'Děkujeme',
    ];
    expect(prectiKodDoplnkoveHry(radky, 'eurojackpot')).toBe('845991');
  });
});

describe('nevymýšlí kód', () => {
  it('bez popisku nevrátí nic, i když jsou na řádku číslice', () => {
    expect(prectiKodDoplnkoveHry(['1: 23 30 33 37 47 02 03 NT'], 'eurojackpot')).toBeNull();
    expect(prectiKodDoplnkoveHry(['845991'], 'eurojackpot')).toBeNull();
  });

  it('nesebere kratší ani delší běh číslic', () => {
    expect(prectiKodDoplnkoveHry(['Extra 6: 84599'], 'eurojackpot')).toBeNull();
    expect(prectiKodDoplnkoveHry(['Extra 6: 8459912'], 'eurojackpot')).toBeNull();
  });

  it('nesebere číslice před popiskem', () => {
    // Datum na začátku řádku nesmí kód přebít.
    expect(prectiKodDoplnkoveHry(['080920 Extra 6: 845991'], 'eurojackpot')).toBe('845991');
  });

  it('prázdný vstup dá null', () => {
    expect(prectiKodDoplnkoveHry([], 'eurojackpot')).toBeNull();
  });

  it('nezamění hry — Šance není Extra 6', () => {
    expect(prectiKodDoplnkoveHry(['Extra 6: 845991'], 'sportka')).toBeNull();
    expect(prectiKodDoplnkoveHry(['Šance: 236412'], 'eurojackpot')).toBeNull();
  });
});

describe('Sportka', () => {
  it('přečte Šanci s diakritikou i bez ní', () => {
    // Přesná podoba na tiketu Sportky ověřená není, proto je vzor volnější.
    expect(prectiKodDoplnkoveHry(['Šance: 236412'], 'sportka')).toBe('236412');
    expect(prectiKodDoplnkoveHry(['SANCE 236412'], 'sportka')).toBe('236412');
  });
});
