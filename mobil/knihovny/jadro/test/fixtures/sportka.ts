/**
 * Reálné tahy Sportky včetně Šance, opsané z výherní listiny Allwyn.
 * Zdroj: https://www.allwyn.cz/system/vyherka?year=<2015|2026>&week=<10|36>&game=sportka
 *
 * Záměrně jsou tu dvě různé éry hry: v roce 2015 se losovalo dvakrát týdně a Šance měla
 * jen šest pořadí (sousední číslo ještě neexistovalo), v roce 2026 třikrát týdně a sedm
 * pořadí. Vyhodnocení musí zvládnout obojí.
 *
 * Soubor je generovaný z uložených listin — neupravovat ručně.
 */

import type { TahSportka } from '../../src/model.js';

/** 2015-03-04 (st), 10. sázkový týden. */
export const SP_2015_03_04: TahSportka = {
  hra: 'sportka',
  datum: '2015-03-04',
  den: 'st',
  sazkovyTyden: { rok: 2015, tyden: 10 },
  vsazenoKc: 40058040,
  naVyhryKc: 138495445,
  tahy: [
    {
      poradiTahu: 1,
      cisla: [5, 43, 1, 26, 29, 36],
      dodatkove: 31,
      poradi: [
        { klic: 'bonus', popis: 'Bonus', pocetVyher: 0, vyseVyhryKc: 0 },
        { klic: 'I', popis: '6', pocetVyher: 0, vyseVyhryKc: 0 },
        { klic: 'II', popis: '5+dodatkové', pocetVyher: 0, vyseVyhryKc: 0 },
        { klic: 'III', popis: '5', pocetVyher: 37, vyseVyhryKc: 24359 },
        { klic: 'IV', popis: '4', pocetVyher: 1724, vyseVyhryKc: 697 },
        { klic: 'V', popis: '3', pocetVyher: 32988, vyseVyhryKc: 121 },
      ],
      prevod1PoradiKc: 7533523,
      jackpot1PoradiKc: 10500000,
      prevod2PoradiKc: 2397029,
      jackpot2PoradiKc: 3330000,
    },
    {
      poradiTahu: 2,
      cisla: [35, 37, 26, 29, 12, 5],
      dodatkove: 11,
      poradi: [
        { klic: 'bonus', popis: 'Bonus', pocetVyher: 0, vyseVyhryKc: 0 },
        { klic: 'I', popis: '6', pocetVyher: 0, vyseVyhryKc: 0 },
        { klic: 'II', popis: '5+dodatkové', pocetVyher: 3, vyseVyhryKc: 569090 },
        { klic: 'III', popis: '5', pocetVyher: 34, vyseVyhryKc: 26508 },
        { klic: 'IV', popis: '4', pocetVyher: 1971, vyseVyhryKc: 609 },
        { klic: 'V', popis: '3', pocetVyher: 35306, vyseVyhryKc: 113 },
      ],
      prevod1PoradiKc: 35857210,
      jackpot1PoradiKc: 38800000,
      prevod2PoradiKc: 0,
      jackpot2PoradiKc: 930000,
    },
  ],
  sance: {
    datum: '2015-03-04',
    cislice: '713201',
    vsazenoKc: 4608380,
    poradi: [
      { klic: 'sestecisli', popis: 'šestičíslí', vzor: '713201', pocetVyher: 1, vyseVyhryKc: 2575470 },
      { klic: 'peticisli', popis: 'pětičíslí', vzor: '13201', pocetVyher: 0, vyseVyhryKc: 0 },
      { klic: 'ctyrcisli', popis: 'čtyřčíslí', vzor: '3201', pocetVyher: 18, vyseVyhryKc: 10000 },
      { klic: 'trojcisli', popis: 'trojčíslí', vzor: '201', pocetVyher: 199, vyseVyhryKc: 1000 },
      { klic: 'dvojcisli', popis: 'dvojčíslí', vzor: '01', pocetVyher: 1970, vyseVyhryKc: 100 },
      { klic: 'koncove-cislo', popis: 'koncové číslo', vzor: '1', pocetVyher: 20670, vyseVyhryKc: 50 },
    ],
  },
  prevodBonusKc: 78814765,
  superJackpotKc: 120300000,
};

/** 2015-03-08 (ne), 10. sázkový týden. */
export const SP_2015_03_08: TahSportka = {
  hra: 'sportka',
  datum: '2015-03-08',
  den: 'ne',
  sazkovyTyden: { rok: 2015, tyden: 10 },
  vsazenoKc: 54968840,
  naVyhryKc: 152086947,
  tahy: [
    {
      poradiTahu: 1,
      cisla: [12, 20, 3, 47, 29, 7],
      dodatkove: 43,
      poradi: [
        { klic: 'bonus', popis: 'Bonus', pocetVyher: 0, vyseVyhryKc: 0 },
        { klic: 'I', popis: '6', pocetVyher: 0, vyseVyhryKc: 0 },
        { klic: 'II', popis: '5+dodatkové', pocetVyher: 0, vyseVyhryKc: 0 },
        { klic: 'III', popis: '5', pocetVyher: 61, vyseVyhryKc: 20275 },
        { klic: 'IV', popis: '4', pocetVyher: 3169, vyseVyhryKc: 520 },
        { klic: 'V', popis: '3', pocetVyher: 55199, vyseVyhryKc: 99 },
      ],
      prevod1PoradiKc: 10556809,
      jackpot1PoradiKc: 12700000,
      prevod2PoradiKc: 3358983,
      jackpot2PoradiKc: 4030000,
    },
    {
      poradiTahu: 2,
      cisla: [37, 45, 7, 21, 8, 23],
      dodatkove: 3,
      poradi: [
        { klic: 'bonus', popis: 'Bonus', pocetVyher: 0, vyseVyhryKc: 0 },
        { klic: 'I', popis: '6', pocetVyher: 0, vyseVyhryKc: 0 },
        { klic: 'II', popis: '5+dodatkové', pocetVyher: 0, vyseVyhryKc: 0 },
        { klic: 'III', popis: '5', pocetVyher: 50, vyseVyhryKc: 24735 },
        { klic: 'IV', popis: '4', pocetVyher: 2778, vyseVyhryKc: 593 },
        { klic: 'V', popis: '3', pocetVyher: 52642, vyseVyhryKc: 104 },
      ],
      prevod1PoradiKc: 38880496,
      jackpot1PoradiKc: 41000000,
      prevod2PoradiKc: 961954,
      jackpot2PoradiKc: 1630000,
    },
  ],
  sance: {
    datum: '2015-03-08',
    cislice: '116104',
    vsazenoKc: 6135620,
    poradi: [
      { klic: 'sestecisli', popis: 'šestičíslí', vzor: '116104', pocetVyher: 0, vyseVyhryKc: 0 },
      { klic: 'peticisli', popis: 'pětičíslí', vzor: '16104', pocetVyher: 2, vyseVyhryKc: 100000 },
      { klic: 'ctyrcisli', popis: 'čtyřčíslí', vzor: '6104', pocetVyher: 26, vyseVyhryKc: 10000 },
      { klic: 'trojcisli', popis: 'trojčíslí', vzor: '104', pocetVyher: 271, vyseVyhryKc: 1000 },
      { klic: 'dvojcisli', popis: 'dvojčíslí', vzor: '04', pocetVyher: 2691, vyseVyhryKc: 100 },
      { klic: 'koncove-cislo', popis: 'koncové číslo', vzor: '4', pocetVyher: 27956, vyseVyhryKc: 50 },
    ],
  },
  prevodBonusKc: 81620477,
  superJackpotKc: 124500000,
};

/** 2026-09-02 (st), 36. sázkový týden. */
export const SP_2026_09_02: TahSportka = {
  hra: 'sportka',
  datum: '2026-09-02',
  den: 'st',
  sazkovyTyden: { rok: 2026, tyden: 36 },
  vsazenoKc: 35817510,
  naVyhryKc: 263731922,
  tahy: [
    {
      poradiTahu: 1,
      cisla: [21, 5, 37, 18, 34, 19],
      dodatkove: 42,
      poradi: [
        { klic: 'bonus', popis: 'Bonus', pocetVyher: 0, vyseVyhryKc: 0 },
        { klic: 'I', popis: '6', pocetVyher: 0, vyseVyhryKc: 0 },
        { klic: 'II', popis: '5+dodatkové', pocetVyher: 1, vyseVyhryKc: 985862 },
        { klic: 'III', popis: '5', pocetVyher: 33, vyseVyhryKc: 18994 },
        { klic: 'IV', popis: '4', pocetVyher: 1208, vyseVyhryKc: 889 },
        { klic: 'V', popis: '3', pocetVyher: 21719, vyseVyhryKc: 170 },
      ],
      prevod1PoradiKc: 3549108,
      jackpot1PoradiKc: 5700000,
      prevod2PoradiKc: 0,
      jackpot2PoradiKc: 600000,
    },
    {
      poradiTahu: 2,
      cisla: [40, 15, 34, 32, 24, 22],
      dodatkove: 20,
      poradi: [
        { klic: 'bonus', popis: 'Bonus', pocetVyher: 0, vyseVyhryKc: 0 },
        { klic: 'I', popis: '6', pocetVyher: 0, vyseVyhryKc: 0 },
        { klic: 'II', popis: '5+dodatkové', pocetVyher: 0, vyseVyhryKc: 0 },
        { klic: 'III', popis: '5', pocetVyher: 23, vyseVyhryKc: 27252 },
        { klic: 'IV', popis: '4', pocetVyher: 1037, vyseVyhryKc: 1036 },
        { klic: 'V', popis: '3', pocetVyher: 19966, vyseVyhryKc: 185 },
      ],
      prevod1PoradiKc: 3549108,
      jackpot1PoradiKc: 5700000,
      prevod2PoradiKc: 2686755,
      jackpot2PoradiKc: 1000000,
    },
  ],
  sance: {
    datum: '2026-09-02',
    cislice: '236412',
    vsazenoKc: 4889970,
    poradi: [
      { klic: 'sestecisli', popis: 'šestičíslí', vzor: '236412', pocetVyher: 0, vyseVyhryKc: 0 },
      { klic: 'peticisli', popis: 'pětičíslí', vzor: '36412', pocetVyher: 2, vyseVyhryKc: 100000 },
      { klic: 'ctyrcisli', popis: 'čtyřčíslí', vzor: '6412', pocetVyher: 12, vyseVyhryKc: 10000 },
      { klic: 'trojcisli', popis: 'trojčíslí', vzor: '412', pocetVyher: 138, vyseVyhryKc: 1000 },
      { klic: 'dvojcisli', popis: 'dvojčíslí', vzor: '12', pocetVyher: 1445, vyseVyhryKc: 100 },
      { klic: 'koncove-cislo', popis: 'koncové číslo', vzor: '2', pocetVyher: 14637, vyseVyhryKc: 50 },
      { klic: 'sousedni-cislo', popis: 'koncové číslo +/- 1', vzor: null, pocetVyher: 32484, vyseVyhryKc: 30 },
    ],
  },
  prevodBonusKc: 241714387,
  superJackpotKc: 251000000,
};

/** 2026-09-04 (pa), 36. sázkový týden. */
export const SP_2026_09_04: TahSportka = {
  hra: 'sportka',
  datum: '2026-09-04',
  den: 'pa',
  sazkovyTyden: { rok: 2026, tyden: 36 },
  vsazenoKc: 44419920,
  naVyhryKc: 273709318,
  tahy: [
    {
      poradiTahu: 1,
      cisla: [48, 28, 39, 18, 1, 40],
      dodatkove: 35,
      poradi: [
        { klic: 'bonus', popis: 'Bonus', pocetVyher: 0, vyseVyhryKc: 0 },
        { klic: 'I', popis: '6', pocetVyher: 0, vyseVyhryKc: 0 },
        { klic: 'II', popis: '5+dodatkové', pocetVyher: 0, vyseVyhryKc: 0 },
        { klic: 'III', popis: '5', pocetVyher: 26, vyseVyhryKc: 29898 },
        { klic: 'IV', popis: '4', pocetVyher: 1406, vyseVyhryKc: 947 },
        { klic: 'V', popis: '3', pocetVyher: 24635, vyseVyhryKc: 186 },
      ],
      prevod1PoradiKc: 5548004,
      jackpot1PoradiKc: 7500000,
      prevod2PoradiKc: 555249,
      jackpot2PoradiKc: 1000000,
    },
    {
      poradiTahu: 2,
      cisla: [27, 29, 33, 8, 16, 5],
      dodatkove: 37,
      poradi: [
        { klic: 'bonus', popis: 'Bonus', pocetVyher: 0, vyseVyhryKc: 0 },
        { klic: 'I', popis: '6', pocetVyher: 0, vyseVyhryKc: 0 },
        { klic: 'II', popis: '5+dodatkové', pocetVyher: 1, vyseVyhryKc: 1000000 },
        { klic: 'III', popis: '5', pocetVyher: 27, vyseVyhryKc: 28790 },
        { klic: 'IV', popis: '4', pocetVyher: 1549, vyseVyhryKc: 860 },
        { klic: 'V', popis: '3', pocetVyher: 27525, vyseVyhryKc: 167 },
      ],
      prevod1PoradiKc: 5548004,
      jackpot1PoradiKc: 7500000,
      prevod2PoradiKc: 0,
      jackpot2PoradiKc: 500000,
    },
  ],
  sance: {
    datum: '2026-09-04',
    cislice: '333467',
    vsazenoKc: 5942430,
    poradi: [
      { klic: 'sestecisli', popis: 'šestičíslí', vzor: '333467', pocetVyher: 0, vyseVyhryKc: 0 },
      { klic: 'peticisli', popis: 'pětičíslí', vzor: '33467', pocetVyher: 2, vyseVyhryKc: 100000 },
      { klic: 'ctyrcisli', popis: 'čtyřčíslí', vzor: '3467', pocetVyher: 22, vyseVyhryKc: 10000 },
      { klic: 'trojcisli', popis: 'trojčíslí', vzor: '467', pocetVyher: 185, vyseVyhryKc: 1000 },
      { klic: 'dvojcisli', popis: 'dvojčíslí', vzor: '67', pocetVyher: 1825, vyseVyhryKc: 100 },
      { klic: 'koncove-cislo', popis: 'koncové číslo', vzor: '7', pocetVyher: 18774, vyseVyhryKc: 50 },
      { klic: 'sousedni-cislo', popis: 'koncové číslo +/- 1', vzor: null, pocetVyher: 39662, vyseVyhryKc: 30 },
    ],
  },
  prevodBonusKc: 244868201,
  superJackpotKc: 255000000,
};

/** 2026-09-06 (ne), 36. sázkový týden. */
export const SP_2026_09_06: TahSportka = {
  hra: 'sportka',
  datum: '2026-09-06',
  den: 'ne',
  sazkovyTyden: { rok: 2026, tyden: 36 },
  vsazenoKc: 43707270,
  naVyhryKc: 278373093,
  tahy: [
    {
      poradiTahu: 1,
      cisla: [35, 28, 15, 13, 37, 11],
      dodatkove: 29,
      poradi: [
        { klic: 'bonus', popis: 'Bonus', pocetVyher: 0, vyseVyhryKc: 0 },
        { klic: 'I', popis: '6', pocetVyher: 0, vyseVyhryKc: 0 },
        { klic: 'II', popis: '5+dodatkové', pocetVyher: 1, vyseVyhryKc: 1000000 },
        { klic: 'III', popis: '5', pocetVyher: 21, vyseVyhryKc: 36422 },
        { klic: 'IV', popis: '4', pocetVyher: 1356, vyseVyhryKc: 966 },
        { klic: 'V', popis: '3', pocetVyher: 25521, vyseVyhryKc: 177 },
      ],
      prevod1PoradiKc: 7514831,
      jackpot1PoradiKc: 9300000,
      prevod2PoradiKc: 0,
      jackpot2PoradiKc: 500000,
    },
    {
      poradiTahu: 2,
      cisla: [3, 43, 4, 19, 21, 44],
      dodatkove: 33,
      poradi: [
        { klic: 'bonus', popis: 'Bonus', pocetVyher: 0, vyseVyhryKc: 0 },
        { klic: 'I', popis: '6', pocetVyher: 0, vyseVyhryKc: 0 },
        { klic: 'II', popis: '5+dodatkové', pocetVyher: 0, vyseVyhryKc: 0 },
        { klic: 'III', popis: '5', pocetVyher: 21, vyseVyhryKc: 36422 },
        { klic: 'IV', popis: '4', pocetVyher: 1459, vyseVyhryKc: 898 },
        { klic: 'V', popis: '3', pocetVyher: 27182, vyseVyhryKc: 166 },
      ],
      prevod1PoradiKc: 7514831,
      jackpot1PoradiKc: 9300000,
      prevod2PoradiKc: 546340,
      jackpot2PoradiKc: 1000000,
    },
  ],
  sance: {
    datum: '2026-09-06',
    cislice: '229511',
    vsazenoKc: 5838540,
    poradi: [
      { klic: 'sestecisli', popis: 'šestičíslí', vzor: '229511', pocetVyher: 1, vyseVyhryKc: 1000000 },
      { klic: 'peticisli', popis: 'pětičíslí', vzor: '29511', pocetVyher: 1, vyseVyhryKc: 100000 },
      { klic: 'ctyrcisli', popis: 'čtyřčíslí', vzor: '9511', pocetVyher: 16, vyseVyhryKc: 10000 },
      { klic: 'trojcisli', popis: 'trojčíslí', vzor: '511', pocetVyher: 153, vyseVyhryKc: 1000 },
      { klic: 'dvojcisli', popis: 'dvojčíslí', vzor: '11', pocetVyher: 1596, vyseVyhryKc: 100 },
      { klic: 'koncove-cislo', popis: 'koncové číslo', vzor: '1', pocetVyher: 17009, vyseVyhryKc: 50 },
      { klic: 'sousedni-cislo', popis: 'koncové číslo +/- 1', vzor: null, pocetVyher: 37283, vyseVyhryKc: 30 },
    ],
  },
  prevodBonusKc: 247971417,
  superJackpotKc: 259000000,
};

export const VSECHNY_TAHY_SPORTKA: readonly TahSportka[] = [
  SP_2015_03_04,
  SP_2015_03_08,
  SP_2026_09_02,
  SP_2026_09_04,
  SP_2026_09_06,
];
