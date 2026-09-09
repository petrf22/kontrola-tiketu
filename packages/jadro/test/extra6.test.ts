import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  vyberSazby,
  vyhodnotExtra6,
  type PoradiKoncoveCislice,
  type SazbyExtra6,
} from '../src/index.js';
import { EJ_2026_09_04, EJ_2026_09_08 } from './fixtures/eurojackpot.js';

/**
 * Sazby se čtou z distribuovaného datového souboru, ne z kopie v testu — test tak zároveň
 * hlídá, že se do `data/sazby-extra6.json` nedostane nesmysl. Čtení souboru je v pořádku
 * v testu, ne v jádře; jádro samo žádné I/O nedělá a sazby dostává parametrem.
 */
const SOUBOR = new URL('../../../data/sazby-extra6.json', import.meta.url);
const SAZBY: readonly SazbyExtra6[] = JSON.parse(readFileSync(SOUBOR, 'utf8')).sazby;

describe('data/sazby-extra6.json', () => {
  it('obsahuje všech sedm pořadí a nezápornou sázku', () => {
    expect(SAZBY.length).toBeGreaterThan(0);
    for (const s of SAZBY) {
      expect(s.sazkaKc).toBeGreaterThan(0);
      expect(Object.keys(s.nasobky).sort()).toEqual([
        'ctyrcisli',
        'dvojcisli',
        'koncove-cislo',
        'peticisli',
        'sestecisli',
        'sousedni-cislo',
        'trojcisli',
      ]);
      expect(s.platnostOd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(s.zdroj).toContain('herni-plany');
    }
  });

  it('násobky dávají částky uvedené v herním plánu', () => {
    const sazby = vyberSazby(SAZBY, '2026-09-08');
    expect(sazby).not.toBeNull();
    const castka = (klic: PoradiKoncoveCislice) => sazby!.nasobky[klic] * sazby!.sazkaKc;
    expect(castka('sestecisli')).toBe(1_000_000);
    expect(castka('peticisli')).toBe(100_000);
    expect(castka('ctyrcisli')).toBe(10_000);
    expect(castka('trojcisli')).toBe(1_000);
    expect(castka('dvojcisli')).toBe(100);
    expect(castka('koncove-cislo')).toBe(60);
    expect(castka('sousedni-cislo')).toBe(60);
  });
});

describe('vyberSazby', () => {
  const starsi: SazbyExtra6 = {
    platnostOd: '2020-01-01',
    sazkaKc: 20,
    nasobky: {
      sestecisli: 25000, peticisli: 2500, ctyrcisli: 250, trojcisli: 25,
      dvojcisli: 2.5, 'koncove-cislo': 1.5, 'sousedni-cislo': 1.5,
    },
    zdroj: 'test',
  };
  const novejsi: SazbyExtra6 = { ...starsi, platnostOd: '2025-09-05', sazkaKc: 40 };
  const oboje = [novejsi, starsi]; // schválně v opačném pořadí

  it('vybere poslední sazby platné k datu', () => {
    expect(vyberSazby(oboje, '2026-09-08')?.sazkaKc).toBe(40);
    expect(vyberSazby(oboje, '2022-05-01')?.sazkaKc).toBe(20);
  });

  it('den začátku platnosti už spadá pod nové sazby', () => {
    expect(vyberSazby(oboje, '2025-09-05')?.sazkaKc).toBe(40);
    expect(vyberSazby(oboje, '2025-09-04')?.sazkaKc).toBe(20);
  });

  it('pro datum před první platností vrátí null', () => {
    expect(vyberSazby(oboje, '2019-12-31')).toBeNull();
    expect(vyberSazby([], '2026-09-08')).toBeNull();
  });
});

describe('vyhodnotExtra6', () => {
  // 2026-09-08 mělo vylosováno 912799.
  it('mapuje délku shody na pořadí a částku', () => {
    const ocekavano: ReadonlyArray<[string, PoradiKoncoveCislice, number]> = [
      ['912799', 'sestecisli', 1_000_000],
      ['012799', 'peticisli', 100_000],
      ['002799', 'ctyrcisli', 10_000],
      ['000799', 'trojcisli', 1_000],
      ['000099', 'dvojcisli', 100],
      ['000009', 'koncove-cislo', 60],
      ['000008', 'sousedni-cislo', 60],
      ['000000', 'sousedni-cislo', 60],
    ];
    for (const [kod, poradi, castka] of ocekavano) {
      const v = vyhodnotExtra6(kod, EJ_2026_09_08, SAZBY);
      expect(v.poradi, kod).toBe(poradi);
      expect(v.vyseVyhryKc, kod).toBe(castka);
    }
  });

  it('nevýherní kód nemá pořadí ani částku', () => {
    const v = vyhodnotExtra6('000005', EJ_2026_09_08, SAZBY);
    expect(v.poradi).toBeNull();
    expect(v.vyseVyhryKc).toBeNull();
    expect(v.vyhrada).toBeNull();
  });

  it('u prvního pořadí hlásí výhradu, protože se výhra může dělit', () => {
    const v = vyhodnotExtra6('912799', EJ_2026_09_08, SAZBY);
    expect(v.poradi).toBe('sestecisli');
    expect(v.vyhrada).toBe('delene-prvni-poradi');
  });

  it('u nižších pořadí je částka jistá', () => {
    expect(vyhodnotExtra6('012799', EJ_2026_09_08, SAZBY).vyhrada).toBeNull();
    expect(vyhodnotExtra6('000009', EJ_2026_09_08, SAZBY).vyhrada).toBeNull();
  });

  it('bez sazeb pro dané datum vrátí pořadí, ale ne částku', () => {
    const v = vyhodnotExtra6('912799', EJ_2026_09_08, []);
    expect(v.poradi).toBe('sestecisli');
    expect(v.vyseVyhryKc).toBeNull();
    expect(v.vyhrada).toBe('chybi-sazby');
  });

  it('respektuje vedoucí nulu ve vylosovaném šestičíslí', () => {
    // 2026-09-04 mělo vylosováno 057739; kód 157739 se shoduje na pěti číslicích.
    expect(EJ_2026_09_04.extra6).toBe('057739');
    const v = vyhodnotExtra6('157739', EJ_2026_09_04, SAZBY);
    expect(v.poradi).toBe('peticisli');
    expect(v.vyseVyhryKc).toBe(100_000);
    // Plná shoda včetně vedoucí nuly je šestičíslí.
    expect(vyhodnotExtra6('057739', EJ_2026_09_04, SAZBY).poradi).toBe('sestecisli');
  });
});
