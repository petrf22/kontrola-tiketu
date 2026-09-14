import { describe, expect, it } from 'vitest';
import type { Tah, Tiket } from '@kontrola-tiketu/jadro';
import {
  cenaZaSlosovaniZPapiru,
  konecPodlePapiru,
  prectiCastku,
  sestavKontrolu,
  sRozsahem,
} from '../src/app/data/kontrola.js';
import { EJ_2026_09_01, EJ_2026_09_04, EJ_2026_09_08 } from '../knihovny/jadro/test/fixtures/eurojackpot.js';

const TAHY: readonly Tah[] = [EJ_2026_09_01, EJ_2026_09_04, EJ_2026_09_08];

const tiket: Tiket = {
  id: 'ej',
  hra: 'eurojackpot',
  sloupce: [{ hra: 'eurojackpot', cisla: [1, 2, 3, 4, 5], eurocisla: [1, 2] }],
  slosovani: { prvni: '2026-09-01', pocet: 2, dny: null },
  kodDoplnkoveHry: null,
  cenaKc: 800,
  vlozeno: '2026-09-01T10:00:00Z',
};

describe('rozsah kontroly z formuláře', () => {
  it('konec podle papíru je poslední slosování, na které tiket platí', () => {
    expect(konecPodlePapiru(tiket, TAHY)).toBe('2026-09-04');
    expect(konecPodlePapiru({ ...tiket, slosovani: { ...tiket.slosovani, prvni: '' } }, TAHY)).toBeNull();
  });

  it('rozsah shodný s papírem není virtuální', () => {
    expect(sestavKontrolu(tiket, '2026-09-01', '2026-09-04', 400, TAHY)).toBeNull();
  });

  it('jiný začátek, konec nebo bez konce virtuální je', () => {
    expect(sestavKontrolu(tiket, '2023-09-12', '2026-09-04', 400, TAHY)).toEqual({
      od: '2023-09-12',
      do: '2026-09-04',
      cenaZaSlosovaniKc: 400,
    });
    expect(sestavKontrolu(tiket, '2026-09-01', '2026-09-08', null, TAHY)?.do).toBe('2026-09-08');
    expect(sestavKontrolu(tiket, '2026-09-01', null, 400, TAHY)?.do).toBeNull();
  });

  it('cena za slosování je cena tiketu dělená počtem slosování', () => {
    expect(cenaZaSlosovaniZPapiru(tiket)).toBe(400);
    expect(cenaZaSlosovaniZPapiru({ ...tiket, slosovani: { ...tiket.slosovani, pocet: 3 } })).toBe(266.67);
    expect(cenaZaSlosovaniZPapiru({ ...tiket, cenaKc: null })).toBeNull();
  });

  it('rozsah jde přidat i odebrat, zbytek tiketu zůstane', () => {
    const virtualni = sRozsahem(tiket, { od: '2023-09-12', do: null, cenaZaSlosovaniKc: 400 });
    expect(virtualni.kontrola?.od).toBe('2023-09-12');
    const zpet = sRozsahem(virtualni, null);
    expect(zpet).toEqual(tiket);
    expect('kontrola' in zpet).toBe(false);
  });

  it('rozsah přežije uložení jako JSON, jak ho ukládá šifrovaná databáze', () => {
    const virtualni = sRozsahem(tiket, { od: '2023-09-12', do: null, cenaZaSlosovaniKc: null });
    expect(JSON.parse(JSON.stringify(virtualni))).toEqual(virtualni);
  });

  it('přečte částku s desetinnou čárkou a prázdné pole bere jako neznámou cenu', () => {
    expect(prectiCastku('133,5')).toBe(133.5);
    expect(prectiCastku(' 400 ')).toBe(400);
    expect(prectiCastku('')).toBeNull();
    expect(prectiCastku('abc')).toBeNull();
  });
});
