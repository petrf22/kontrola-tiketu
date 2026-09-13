/**
 * Reálné tahy Euromilionů, opsané z výherní listiny Allwyn.
 * Zdroj: https://www.allwyn.cz/system/vyherka?year=2026&week=<36|37>&game=euromiliony
 *
 * Soubor je generovaný z ukázkového balíku `test/fixtures/vysledky-2026-35-az-37.json`
 * (tedy z uložených listin) — neupravovat ručně. Slouží jako doklad, že vyhodnocení sedí
 * na oficiálně publikovanou tabulku výher.
 */

import type { TahEuromiliony } from '../../src/model.js';

/** 2026-09-01 (ut), 36. sázkový týden. */
export const EM_2026_09_01: TahEuromiliony = {
  hra: 'euromiliony',
  datum: '2026-09-01',
  den: 'ut',
  sazkovyTyden: { rok: 2026, tyden: 36 },
  vsazenoKc: 1091850,
  naVyhryKc: 93779250,
  cisla: [17, 5, 28, 21, 16, 30, 33],
  druheOsudi: 4,
  eurosance: '47489',
  poradi: [
    { klic: 'I', popis: '7+1', pocetVyher: 0, vyseVyhryKc: 0 },
    { klic: 'II', popis: '7', pocetVyher: 0, vyseVyhryKc: 0 },
    { klic: 'III', popis: '6+1', pocetVyher: 0, vyseVyhryKc: 0 },
    { klic: 'IV', popis: '6', pocetVyher: 4, vyseVyhryKc: 6141 },
    { klic: 'V', popis: '5+1', pocetVyher: 5, vyseVyhryKc: 4913 },
    { klic: 'VI', popis: '5', pocetVyher: 25, vyseVyhryKc: 1201 },
    { klic: 'VII', popis: '4+1', pocetVyher: 106, vyseVyhryKc: 360 },
    { klic: 'VIII', popis: '4', pocetVyher: 441, vyseVyhryKc: 167 },
    { klic: 'IX', popis: '3+1', pocetVyher: 713, vyseVyhryKc: 111 },
    { klic: 'X', popis: '2+1', pocetVyher: 2099, vyseVyhryKc: 63 },
  ],
  prevodHlavniCastKc: 89001182,
  jackpotKc: 89200000,
};

/** 2026-09-05 (so), 36. sázkový týden. */
export const EM_2026_09_05: TahEuromiliony = {
  hra: 'euromiliony',
  datum: '2026-09-05',
  den: 'so',
  sazkovyTyden: { rok: 2026, tyden: 36 },
  vsazenoKc: 1521690,
  naVyhryKc: 94117772,
  cisla: [33, 15, 6, 17, 10, 16, 8],
  druheOsudi: 4,
  eurosance: '33055',
  poradi: [
    { klic: 'I', popis: '7+1', pocetVyher: 0, vyseVyhryKc: 0 },
    { klic: 'II', popis: '7', pocetVyher: 0, vyseVyhryKc: 0 },
    { klic: 'III', popis: '6+1', pocetVyher: 1, vyseVyhryKc: 397169 },
    { klic: 'IV', popis: '6', pocetVyher: 2, vyseVyhryKc: 17119 },
    { klic: 'V', popis: '5+1', pocetVyher: 4, vyseVyhryKc: 8559 },
    { klic: 'VI', popis: '5', pocetVyher: 36, vyseVyhryKc: 1162 },
    { klic: 'VII', popis: '4+1', pocetVyher: 152, vyseVyhryKc: 350 },
    { klic: 'VIII', popis: '4', pocetVyher: 635, vyseVyhryKc: 161 },
    { klic: 'IX', popis: '3+1', pocetVyher: 1082, vyseVyhryKc: 101 },
    { klic: 'X', popis: '2+1', pocetVyher: 3006, vyseVyhryKc: 62 },
  ],
  prevodHlavniCastKc: 89112050,
  jackpotKc: 89300000,
};

/** 2026-09-08 (ut), 37. sázkový týden. */
export const EM_2026_09_08: TahEuromiliony = {
  hra: 'euromiliony',
  datum: '2026-09-08',
  den: 'ut',
  sazkovyTyden: { rok: 2026, tyden: 37 },
  vsazenoKc: 1102380,
  naVyhryKc: 93682682,
  cisla: [18, 17, 28, 3, 2, 12, 22],
  druheOsudi: 5,
  eurosance: '37960',
  poradi: [
    { klic: 'I', popis: '7+1', pocetVyher: 0, vyseVyhryKc: 0 },
    { klic: 'II', popis: '7', pocetVyher: 0, vyseVyhryKc: 0 },
    { klic: 'III', popis: '6+1', pocetVyher: 1, vyseVyhryKc: 22047 },
    { klic: 'IV', popis: '6', pocetVyher: 2, vyseVyhryKc: 12401 },
    { klic: 'V', popis: '5+1', pocetVyher: 8, vyseVyhryKc: 3100 },
    { klic: 'VI', popis: '5', pocetVyher: 39, vyseVyhryKc: 777 },
    { klic: 'VII', popis: '4+1', pocetVyher: 120, vyseVyhryKc: 321 },
    { klic: 'VIII', popis: '4', pocetVyher: 528, vyseVyhryKc: 140 },
    { klic: 'IX', popis: '3+1', pocetVyher: 736, vyseVyhryKc: 108 },
    { klic: 'X', popis: '2+1', pocetVyher: 2074, vyseVyhryKc: 65 },
  ],
  prevodHlavniCastKc: 89192413,
  jackpotKc: 89400000,
};

/** 2026-09-12 (so), 37. sázkový týden. */
export const EM_2026_09_12: TahEuromiliony = {
  hra: 'euromiliony',
  datum: '2026-09-12',
  den: 'so',
  sazkovyTyden: { rok: 2026, tyden: 37 },
  vsazenoKc: 1561170,
  naVyhryKc: 94014487,
  cisla: [6, 17, 9, 34, 3, 12, 29],
  druheOsudi: 2,
  eurosance: '17781',
  poradi: [
    { klic: 'I', popis: '7+1', pocetVyher: 0, vyseVyhryKc: 0 },
    { klic: 'II', popis: '7', pocetVyher: 0, vyseVyhryKc: 0 },
    { klic: 'III', popis: '6+1', pocetVyher: 1, vyseVyhryKc: 31223 },
    { klic: 'IV', popis: '6', pocetVyher: 2, vyseVyhryKc: 17563 },
    { klic: 'V', popis: '5+1', pocetVyher: 23, vyseVyhryKc: 1527 },
    { klic: 'VI', popis: '5', pocetVyher: 46, vyseVyhryKc: 933 },
    { klic: 'VII', popis: '4+1', pocetVyher: 201, vyseVyhryKc: 271 },
    { klic: 'VIII', popis: '4', pocetVyher: 770, vyseVyhryKc: 136 },
    { klic: 'IX', popis: '3+1', pocetVyher: 1274, vyseVyhryKc: 88 },
    { klic: 'X', popis: '2+1', pocetVyher: 3528, vyseVyhryKc: 54 },
  ],
  prevodHlavniCastKc: 89306941,
  jackpotKc: 89500000,
};

export const VSECHNY_TAHY_EM: readonly TahEuromiliony[] = [EM_2026_09_01, EM_2026_09_05, EM_2026_09_08, EM_2026_09_12];
