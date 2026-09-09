import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { TahEurojackpot, TahSportka } from '@kontrola-tiketu/jadro';
import {
  ChybaParsovani,
  jePrazdna,
  parsujListinu,
  sestavUrl,
} from '../src/zdroje/allwyn-vyherka.js';
import { castkaZa, dekodujEntity, naCastku } from '../src/zdroje/html.js';

function listina(jmeno: string): string {
  const cesta = new URL(`fixtures/${jmeno}.html.gz`, import.meta.url);
  return gunzipSync(readFileSync(cesta)).toString('utf8');
}

describe('sestavUrl', () => {
  it('sestaví adresu podle docs/data-source.md', () => {
    expect(sestavUrl('sportka', 2026, 36)).toBe(
      'https://www.allwyn.cz/system/vyherka?year=2026&week=36&game=sportka',
    );
  });
});

describe('dekodujEntity', () => {
  it('dekóduje číselné entity, kterými je psaná diakritika', () => {
    expect(dekodujEntity('SPORTKA ST&#x158;EDA')).toBe('SPORTKA STŘEDA');
    expect(dekodujEntity('&#x160;ANCE')).toBe('ŠANCE');
  });

  it('nedělitelnou mezeru zachová jako U+00A0, nedegraduje ji na obyčejnou', () => {
    // Dekódování nemá ztrácet informaci; obyčejnou mezeru z ní dělá až naCastku.
    expect(dekodujEntity('1&nbsp;234&nbsp;Kč')).toBe('1\u00a0234\u00a0Kč');
    expect(naCastku(dekodujEntity('1&nbsp;234'))).toBe(1234);
  });

  it('neznámou entitu nechá být, místo aby ji zahodila', () => {
    expect(dekodujEntity('&nezname;')).toBe('&nezname;');
  });
});

describe('naCastku', () => {
  it('zvládne nedělitelné mezery jako oddělovač tisíců', () => {
    expect(naCastku('15 070 584')).toBe(15070584);
  });

  it('zahodí haléře, které listina uvádí jen u součtů', () => {
    expect(naCastku('263 731 922,00')).toBe(263731922);
  });

  it('prázdný vstup je null, ne nula', () => {
    expect(naCastku('')).toBeNull();
  });
});

describe('castkaZa', () => {
  it('nenechá se zmást číslicemi ve třídách tagů', () => {
    const usek = 'Na výhry: </td><td class="ar b2"><span class="s18b">9 641 556,00 Kč</span>';
    expect(castkaZa(usek, 'Na výhry:')).toBe(9641556);
  });
});

describe('prázdná listina', () => {
  it('se pozná podle chybějícího „Losování dne“, ne podle stavového kódu', () => {
    expect(jePrazdna(listina('prazdna'))).toBe(true);
    expect(jePrazdna(listina('sportka-2026-36'))).toBe(false);
  });

  it('parsuje se na prázdný seznam, ne na chybu', () => {
    expect(parsujListinu(listina('prazdna'))).toEqual([]);
  });
});

describe('Eurojackpot', () => {
  it('z jednoho dotazu přečte všechny tahy týdne', () => {
    const tahy = parsujListinu(listina('eurojackpot-2026-36')) as TahEurojackpot[];
    expect(tahy.map((t) => t.datum)).toEqual(['2026-09-01', '2026-09-04']);
    expect(tahy.map((t) => t.den)).toEqual(['ut', 'pa']);
  });

  it('nerozdělený týden má jen jeden tah', () => {
    const tahy = parsujListinu(listina('eurojackpot-2026-37'));
    expect(tahy).toHaveLength(1);
    expect(tahy[0]!.datum).toBe('2026-09-08');
  });

  it('tah z 8. 9. 2026 sedí na listinu do posledního řádku', () => {
    const [tah] = parsujListinu(listina('eurojackpot-2026-37')) as TahEurojackpot[];
    expect(tah).toEqual({
      hra: 'eurojackpot',
      datum: '2026-09-08',
      den: 'ut',
      sazkovyTyden: { rok: 2026, tyden: 37 },
      vsazenoKc: 25604400,
      naVyhryKc: 11415295,
      cisla: [47, 14, 27, 34, 36],
      eurocisla: [4, 3],
      extra6: '912799',
      poradi: [
        { klic: 'I', popis: '5+2', pocetVyher: 0, vyseVyhryKc: 0 },
        { klic: 'II', popis: '5+1', pocetVyher: 0, vyseVyhryKc: 15070584 },
        { klic: 'III', popis: '5+0', pocetVyher: 0, vyseVyhryKc: 2663542 },
        { klic: 'IV', popis: '4+2', pocetVyher: 0, vyseVyhryKc: 80932 },
        { klic: 'V', popis: '4+1', pocetVyher: 16, vyseVyhryKc: 5780 },
        { klic: 'VI', popis: '3+2', pocetVyher: 21, vyseVyhryKc: 3692 },
        { klic: 'VII', popis: '4+0', pocetVyher: 35, vyseVyhryKc: 2279 },
        { klic: 'VIII', popis: '2+2', pocetVyher: 443, vyseVyhryKc: 612 },
        { klic: 'IX', popis: '3+1', pocetVyher: 652, vyseVyhryKc: 416 },
        { klic: 'X', popis: '3+0', pocetVyher: 1249, vyseVyhryKc: 406 },
        { klic: 'XI', popis: '1+2', pocetVyher: 2292, vyseVyhryKc: 309 },
        { klic: 'XII', popis: '2+1', pocetVyher: 8739, vyseVyhryKc: 222 },
      ],
      jackpotKc: 968000000,
    });
  });

  it('drží vedoucí nulu v Extra 6', () => {
    const tahy = parsujListinu(listina('eurojackpot-2026-36')) as TahEurojackpot[];
    expect(tahy.find((t) => t.datum === '2026-09-04')?.extra6).toBe('057739');
  });
});

describe('Sportka', () => {
  it('přečte tři tahy týdne a ke každému připojí jeho Šanci', () => {
    const tahy = parsujListinu(listina('sportka-2026-36')) as TahSportka[];
    expect(tahy.map((t) => t.datum)).toEqual(['2026-09-02', '2026-09-04', '2026-09-06']);
    expect(tahy.map((t) => t.den)).toEqual(['st', 'pa', 'ne']);
    for (const tah of tahy) {
      expect(tah.sance?.datum, tah.datum).toBe(tah.datum);
    }
  });

  it('tah z 2. 9. 2026 sedí na listinu', () => {
    const [tah] = parsujListinu(listina('sportka-2026-36')) as TahSportka[];
    expect(tah!.vsazenoKc).toBe(35817510);
    expect(tah!.naVyhryKc).toBe(263731922);
    expect(tah!.prevodBonusKc).toBe(241714387);
    expect(tah!.superJackpotKc).toBe(251000000);

    expect(tah!.tahy[0].cisla).toEqual([21, 5, 37, 18, 34, 19]);
    expect(tah!.tahy[0].dodatkove).toBe(42);
    expect(tah!.tahy[1].cisla).toEqual([40, 15, 34, 32, 24, 22]);
    expect(tah!.tahy[1].dodatkove).toBe(20);
  });

  it('nepřehodí převody mezi prvním a druhým tahem', () => {
    // Listina uvádí u obou tahů „Převod 1. pořadí“; kdyby se sekce nerozdělily,
    // druhý tah by dostal hodnoty prvního.
    const [tah] = parsujListinu(listina('sportka-2026-36')) as TahSportka[];
    expect(tah!.tahy[0].prevod2PoradiKc).toBe(0);
    expect(tah!.tahy[1].prevod2PoradiKc).toBe(2686755);
    expect(tah!.tahy[0].jackpot2PoradiKc).toBe(600000);
    expect(tah!.tahy[1].jackpot2PoradiKc).toBe(1000000);
  });

  it('tabulka výher obou tahů sedí na listinu', () => {
    const [tah] = parsujListinu(listina('sportka-2026-36')) as TahSportka[];
    expect(tah!.tahy[0].poradi).toEqual([
      { klic: 'bonus', popis: 'Bonus', pocetVyher: 0, vyseVyhryKc: 0 },
      { klic: 'I', popis: '6', pocetVyher: 0, vyseVyhryKc: 0 },
      { klic: 'II', popis: '5+dodatkové', pocetVyher: 1, vyseVyhryKc: 985862 },
      { klic: 'III', popis: '5', pocetVyher: 33, vyseVyhryKc: 18994 },
      { klic: 'IV', popis: '4', pocetVyher: 1208, vyseVyhryKc: 889 },
      { klic: 'V', popis: '3', pocetVyher: 21719, vyseVyhryKc: 170 },
    ]);
  });

  it('Šance z 2. 9. 2026 sedí včetně vzorů', () => {
    const [tah] = parsujListinu(listina('sportka-2026-36')) as TahSportka[];
    expect(tah!.sance?.cislice).toBe('236412');
    expect(tah!.sance?.vsazenoKc).toBe(4889970);
    expect(tah!.sance?.poradi).toEqual([
      { klic: 'sestecisli', popis: 'šestičíslí', vzor: '236412', pocetVyher: 0, vyseVyhryKc: 0 },
      { klic: 'peticisli', popis: 'pětičíslí', vzor: '36412', pocetVyher: 2, vyseVyhryKc: 100000 },
      { klic: 'ctyrcisli', popis: 'čtyřčíslí', vzor: '6412', pocetVyher: 12, vyseVyhryKc: 10000 },
      { klic: 'trojcisli', popis: 'trojčíslí', vzor: '412', pocetVyher: 138, vyseVyhryKc: 1000 },
      { klic: 'dvojcisli', popis: 'dvojčíslí', vzor: '12', pocetVyher: 1445, vyseVyhryKc: 100 },
      { klic: 'koncove-cislo', popis: 'koncové číslo', vzor: '2', pocetVyher: 14637, vyseVyhryKc: 50 },
      { klic: 'sousedni-cislo', popis: 'koncové číslo +/- 1', vzor: null, pocetVyher: 32484, vyseVyhryKc: 30 },
    ]);
  });
});

describe('starší listina z roku 2015', () => {
  it('zvládne dva tahy týdně a Šanci jen se šesti pořadími', () => {
    const tahy = parsujListinu(listina('sportka-2015-10')) as TahSportka[];
    expect(tahy.map((t) => t.den)).toEqual(['st', 'ne']);
    expect(tahy[0]!.sance?.poradi).toHaveLength(6);
    expect(tahy[0]!.sance?.poradi.some((p) => p.klic === 'sousedni-cislo')).toBe(false);
  });

  it('první pořadí Šance tehdy nebylo pevnou částkou', () => {
    const tahy = parsujListinu(listina('sportka-2015-10')) as TahSportka[];
    const sestecisli = tahy[0]!.sance?.poradi.find((p) => p.klic === 'sestecisli');
    expect(sestecisli?.vyseVyhryKc).toBe(2575470);
  });

  it('sázkový týden se bere z hlavičky sekce, ne z parametrů dotazu', () => {
    const tahy = parsujListinu(listina('sportka-2015-10'));
    for (const tah of tahy) {
      expect(tah.sazkovyTyden).toEqual({ rok: 2015, tyden: 10 });
    }
  });
});

describe('poškozený vstup', () => {
  it('chybějící tabulka druhého tahu shodí parser místo tichého polovičního výsledku', () => {
    const poskozena = listina('sportka-2026-36').replaceAll('<!-- vyhry 2 tah. -->', '');
    expect(() => parsujListinu(poskozena)).toThrow(ChybaParsovani);
  });

  it('useknutá tabulka Eurojackpotu se pozná podle počtu pořadí', () => {
    const poskozena = listina('eurojackpot-2026-37').replace(
      /<td class="ac b2">\s*XII\s*<\/td>/,
      '<td class="ac b2">XIII</td>',
    );
    expect(() => parsujListinu(poskozena)).toThrow(/12 pořadí/);
  });
});
