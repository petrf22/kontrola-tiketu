import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  urciPoradiEurosance,
  vyberSazby,
  vyhodnotEurosance,
  type SazbyEurosance,
} from '../src/index.js';
import { EM_2026_09_08, EM_2026_09_12 } from './fixtures/euromiliony.js';

/** Sazby se čtou z ukázkového balíku od backendu — aplikace je dostává právě v balíku. */
const SOUBOR = new URL('../../../test/fixtures/vysledky-2026-35-az-37.json', import.meta.url);
const SAZBY: readonly SazbyEurosance[] = JSON.parse(readFileSync(SOUBOR, 'utf8')).sazbyEurosance;

describe('sazby Eurošance z balíku výsledků', () => {
  it('mají pět pořadí herního plánu a částky ze závorek bodu 16', () => {
    const sazby = vyberSazby(SAZBY, '2026-09-08');
    expect(sazby).not.toBeNull();
    expect(sazby!.sazkaKc).toBe(30);
    expect(sazby!.vyhryKc).toEqual({
      peticisli: 500_000,
      ctyrcisli: 20_000,
      trojcisli: 2_000,
      dvojcisli: 200,
      'koncove-cislo': 50,
    });
    expect(sazby!.zdroj).toContain('herni-plany');
  });
});

describe('urciPoradiEurosance', () => {
  // 8. 9. 2026 vylosováno 37960.
  it('určí pořadí podle délky shodného konce', () => {
    expect(urciPoradiEurosance('37960', '37960')).toBe('peticisli');
    expect(urciPoradiEurosance('07960', '37960')).toBe('ctyrcisli');
    expect(urciPoradiEurosance('00960', '37960')).toBe('trojcisli');
    expect(urciPoradiEurosance('00060', '37960')).toBe('dvojcisli');
    expect(urciPoradiEurosance('00000', '37960')).toBe('koncove-cislo');
  });

  it('shoda uprostřed nebo na začátku nevyhrává', () => {
    expect(urciPoradiEurosance('37961', '37960')).toBeNull();
  });

  it('sousední koncové číslo v Eurošanci nevyhrává', () => {
    // U Šance a Extra 6 by 1 i 9 vedle 0 bylo sedmé pořadí; Eurošance ho nezná (bod 10).
    expect(urciPoradiEurosance('12341', '37960')).toBeNull();
    expect(urciPoradiEurosance('12349', '37960')).toBeNull();
  });
});

describe('vyhodnotEurosance', () => {
  it('trojčíslí 8. 9. 2026 dává 2 000 Kč z pevných sazeb', () => {
    expect(vyhodnotEurosance('12960', EM_2026_09_08, SAZBY)).toEqual({
      poradi: 'trojcisli',
      vyseVyhryKc: 2000,
      vyhrada: null,
    });
  });

  it('drží vedoucí nuly v kódu tiketu', () => {
    // 12. 9. 2026 vylosováno 17781; kód 07781 trefí čtyřčíslí.
    expect(vyhodnotEurosance('07781', EM_2026_09_12, SAZBY).poradi).toBe('ctyrcisli');
  });

  it('bez sazeb řekne pořadí, ale ne částku', () => {
    expect(vyhodnotEurosance('37960', EM_2026_09_08, [])).toEqual({
      poradi: 'peticisli',
      vyseVyhryKc: null,
      vyhrada: 'chybi-sazby',
    });
  });

  it('nevýherní kód nemá pořadí ani výhradu', () => {
    expect(vyhodnotEurosance('11111', EM_2026_09_08, SAZBY)).toEqual({
      poradi: null,
      vyseVyhryKc: null,
      vyhrada: null,
    });
  });
});
