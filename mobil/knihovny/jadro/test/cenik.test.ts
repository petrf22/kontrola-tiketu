import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  cenaTiketuPodleCeniku,
  platnyCenik,
  rozpisCenyTiketu,
  vkladNaSlosovani,
  vsazenoPodleCeniku,
  vyhodnotTiket,
  type CenikHry,
  type Sloupec,
  type SazbyExtra6,
  type SazkaTiketu,
  type Tah,
} from '../src/index.js';
import { EJ_2026_09_01, EJ_2026_09_04, EJ_2026_09_08 } from './fixtures/eurojackpot.js';

// Ceník se bere z ukázkového balíku backendu, tedy z opisu herních plánů — nevymýšlí se.
const BALIK = JSON.parse(
  readFileSync(new URL('../../../test/fixtures/vysledky-2026-35-az-37.json', import.meta.url), 'utf8'),
);
const CENY: readonly CenikHry[] = BALIK.ceny;
const SAZBY: readonly SazbyExtra6[] = BALIK.sazbyExtra6;

const EJ_SLOUPEC: Sloupec = { hra: 'eurojackpot', cisla: [47, 14, 27, 34, 1], eurocisla: [4, 1] };
const SP_SLOUPEC: Sloupec = { hra: 'sportka', cisla: [1, 2, 3, 4, 5, 6] };
const EM_SLOUPEC: Sloupec = { hra: 'euromiliony', cisla: [1, 2, 3, 4, 5, 6, 7], druheOsudi: [1] };

function sazka(over: Partial<SazkaTiketu> & Pick<SazkaTiketu, 'hra' | 'sloupce'>): SazkaTiketu {
  return {
    slosovani: { prvni: '2026-09-08', pocet: 1, dny: null },
    kodDoplnkoveHry: null,
    ...over,
  };
}

describe('platnyCenik', () => {
  it('Sportka stojí do 29. 9. 2024 20 Kč a od 2. 10. 2024 30 Kč', () => {
    expect(platnyCenik(CENY, 'sportka', '2024-09-29')?.sloupecKc).toBe(20);
    expect(platnyCenik(CENY, 'sportka', '2024-10-02')?.sloupecKc).toBe(30);
    expect(platnyCenik(CENY, 'sportka', '2024-10-02')?.doplnkovaHraKc).toBe(30);
  });

  it('Sportka stála 16 Kč a Šance 10 Kč do 18. 5. 2014', () => {
    const cenik = platnyCenik(CENY, 'sportka', '2014-05-18');
    expect(cenik?.sloupecKc).toBe(16);
    expect(cenik?.doplnkovaHraKc).toBe(10);
    expect(platnyCenik(CENY, 'sportka', '2014-05-21')?.sloupecKc).toBe(20);
  });

  it('před nejstarším doloženým plánem cenu nezná', () => {
    expect(platnyCenik(CENY, 'sportka', '2012-05-20')).toBeNull();
    expect(platnyCenik(CENY, 'eurojackpot', '2014-10-03')).toBeNull();
  });

  it('nemíchá hry', () => {
    expect(platnyCenik(CENY, 'eurojackpot', '2026-09-08')?.hra).toBe('eurojackpot');
    expect(platnyCenik([], 'eurojackpot', '2026-09-08')).toBeNull();
  });

  it('nezávisí na pořadí záznamů', () => {
    expect(platnyCenik([...CENY].reverse(), 'sportka', '2026-09-06')?.sloupecKc).toBe(30);
  });
});

describe('vkladNaSlosovani', () => {
  it('Euromiliony před Eurošancí: sloupce se spočítají, vsazená Eurošance ne', () => {
    const cenik = platnyCenik(CENY, 'euromiliony', '2013-01-01');
    expect(vkladNaSlosovani(cenik, 2, false)).toBe(60);
    expect(vkladNaSlosovani(cenik, 2, true)).toBeNull();
  });

  it('bez sloupců ani bez ceníku cenu nezná', () => {
    expect(vkladNaSlosovani(platnyCenik(CENY, 'sportka', '2026-09-06'), 0, false)).toBeNull();
    expect(vkladNaSlosovani(null, 3, false)).toBeNull();
  });
});

describe('cena papírového tiketu', () => {
  it('plný tiket Eurojackpotu s Extra 6 stojí 400 Kč jako skutečný tiket z 9. 9. 2026', () => {
    const tiket = sazka({ hra: 'eurojackpot', sloupce: Array(6).fill(EJ_SLOUPEC), kodDoplnkoveHry: '123456' });
    expect(cenaTiketuPodleCeniku(tiket, CENY)).toBe(400);
    expect(rozpisCenyTiketu(tiket, CENY)).toEqual({
      sloupcu: 6,
      sloupecKc: 60,
      doplnkovaHraKc: 40,
      slosovani: 1,
      celkemKc: 400,
    });
  });

  it('plná sázenka Sportky s Šancí stojí 270 Kč, na tři slosování trojnásobek', () => {
    const tiket = sazka({ hra: 'sportka', sloupce: Array(8).fill(SP_SLOUPEC), kodDoplnkoveHry: '123456' });
    expect(cenaTiketuPodleCeniku(tiket, CENY)).toBe(270);
    const predplatne = { ...tiket, slosovani: { prvni: '2026-09-06', pocet: 3, dny: null } };
    expect(cenaTiketuPodleCeniku(predplatne, CENY)).toBe(810);
  });

  it('předplatné přes změnu ceny stojí podle prvního slosování', () => {
    const tiket = sazka({
      hra: 'sportka',
      sloupce: [SP_SLOUPEC],
      slosovani: { prvni: '2024-09-29', pocet: 4, dny: null },
    });
    expect(cenaTiketuPodleCeniku(tiket, CENY)).toBe(80);
  });

  it('Euromiliony s Eurošancí', () => {
    const tiket = sazka({ hra: 'euromiliony', sloupce: [EM_SLOUPEC, EM_SLOUPEC], kodDoplnkoveHry: '12345' });
    expect(rozpisCenyTiketu(tiket, CENY)?.celkemKc).toBe(90);
  });

  it('bez ceníku cenu nezná', () => {
    expect(rozpisCenyTiketu(sazka({ hra: 'sportka', sloupce: [SP_SLOUPEC] }), [])).toBeNull();
  });
});

describe('vsazenoPodleCeniku', () => {
  it('virtuální tiket Sportky přes změnu ceny počítá každé slosování za jeho cenu', () => {
    const tiket = sazka({ hra: 'sportka', sloupce: [SP_SLOUPEC, SP_SLOUPEC], kodDoplnkoveHry: '123456' });
    // 2 × 20 + 20 za 27. a 29. 9. 2024, 2 × 30 + 30 za 2. 10. 2024.
    expect(vsazenoPodleCeniku(tiket, ['2024-09-27', '2024-09-29', '2024-10-02'], CENY)).toBe(210);
  });

  it('žádné slosování nestojí nic', () => {
    expect(vsazenoPodleCeniku(sazka({ hra: 'sportka', sloupce: [SP_SLOUPEC] }), [], CENY)).toBe(0);
  });

  it('když ceník nezná jediné slosování, nezná ani součet', () => {
    const tiket = sazka({ hra: 'sportka', sloupce: [SP_SLOUPEC] });
    expect(vsazenoPodleCeniku(tiket, ['2012-05-20', '2012-05-23'], CENY)).toBeNull();
  });
});

describe('vyhodnocení s ceníkem', () => {
  const TAHY_EJ: readonly Tah[] = [EJ_2026_09_01, EJ_2026_09_04, EJ_2026_09_08];
  const zaklad = {
    id: 'ej-cenik',
    hra: 'eurojackpot' as const,
    sloupce: [EJ_SLOUPEC],
    slosovani: { prvni: '2026-09-08', pocet: 1, dny: null },
    kodDoplnkoveHry: '123456',
    cenaKc: null,
    vlozeno: '2026-09-07T10:00:00Z',
  };

  it('papírový tiket bez ceny stojí podle ceníku, vytištěná cena má přednost', () => {
    expect(vyhodnotTiket(zaklad, TAHY_EJ, SAZBY, [], CENY).vsazenoKc).toBe(100);
    expect(vyhodnotTiket({ ...zaklad, cenaKc: 90 }, TAHY_EJ, SAZBY, [], CENY).vsazenoKc).toBe(90);
  });

  it('virtuální tiket bez ruční ceny počítá z ceníku, s ruční cenou z ní', () => {
    const virtualni = { ...zaklad, kontrola: { od: '2026-09-01', do: null, cenaZaSlosovaniKc: null } };
    const v = vyhodnotTiket(virtualni, TAHY_EJ, SAZBY, [], CENY);
    expect(v.vsazenoKc).toBe(300);
    expect(v.bilanceKc).toBe(v.celkemKc - 300);

    const rucne = { ...zaklad, kontrola: { od: '2026-09-01', do: null, cenaZaSlosovaniKc: 50 } };
    expect(vyhodnotTiket(rucne, TAHY_EJ, SAZBY, [], CENY).vsazenoKc).toBe(150);
  });
});
