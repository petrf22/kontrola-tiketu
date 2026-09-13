import { describe, expect, it } from 'vitest';
import { odhadniSklon, prectiTiket, slozRadky, zMlKit, type MlKitVysledek } from '../src/index.js';

/**
 * Výstup ML Kitu nad tiketem Eurojackpotu, jak ho plugin vrací: levá část řádků a euročísla
 * ve dvou různých blocích, protože je mezi nimi na papíře velká mezera.
 */
function vystupMlKit(sklonStupnu = 0): MlKitVysledek {
  const tangens = Math.tan((sklonStupnu * Math.PI) / 180);
  const radek = (text: string, x: number, sirka: number, poradi: number) => {
    const stredX = x + sirka / 2;
    const stredY = 100 + poradi * 40 + stredX * tangens;
    const top = stredY - 10;
    return {
      text,
      boundingBox: { left: x, top, right: x + sirka, bottom: top + 20 },
      cornerPoints: [
        { x, y: top },
        { x: x + sirka, y: top + sirka * tangens },
        { x: x + sirka, y: top + 20 + sirka * tangens },
        { x, y: top + 20 },
      ],
    };
  };

  return {
    blocks: [
      {
        lines: [
          radek('1: 23 30 33 37 47', 40, 200, 0),
          radek('2: 02 22 37 39 40', 40, 200, 1),
          radek('3: 04 06 07 12 33', 40, 200, 2),
        ],
      },
      {
        lines: [
          radek('02 03 NT', 400, 96, 0),
          radek('02 12 NT', 400, 96, 1),
          radek('01 11 NT', 400, 96, 2),
        ],
      },
    ],
  };
}

describe('zMlKit', () => {
  it('rozbalí řádky ze všech bloků', () => {
    expect(zMlKit(vystupMlKit())).toHaveLength(6);
  });

  it('převede rámeček na levý horní roh a rozměry', () => {
    const prvni = zMlKit(vystupMlKit())[0]!;
    expect(prvni.ramecek).toEqual({ x: 40, y: 90, sirka: 200, vyska: 20 });
  });

  it('spočítá úhel z rohových bodů, aby se nemusel odhadovat', () => {
    const utrzky = zMlKit(vystupMlKit(6));
    expect(utrzky[0]?.uhel).toBeCloseTo(6, 0);
    expect(odhadniSklon(utrzky)).toBeCloseTo(6, 0);
  });

  it('poradí si s řádkem, kde je jen rámeček', () => {
    const bezRohu: MlKitVysledek = {
      blocks: [{ lines: [{ text: 'ahoj', boundingBox: { left: 1, top: 2, right: 11, bottom: 22 } }] }],
    };
    const utrzky = zMlKit(bezRohu);
    expect(utrzky[0]?.ramecek).toEqual({ x: 1, y: 2, sirka: 10, vyska: 20 });
    expect(utrzky[0]?.uhel).toBeUndefined();
  });

  it('poradí si s řádkem, kde jsou jen rohy', () => {
    const jenRohy: MlKitVysledek = {
      blocks: [
        {
          lines: [
            {
              text: 'ahoj',
              cornerPoints: [
                { x: 10, y: 5 },
                { x: 50, y: 5 },
                { x: 50, y: 25 },
                { x: 10, y: 25 },
              ],
            },
          ],
        },
      ],
    };
    expect(zMlKit(jenRohy)[0]?.ramecek).toEqual({ x: 10, y: 5, sirka: 40, vyska: 20 });
  });

  it('zahodí řádek bez polohy — hádat, kam patří, by znamenalo přečíst tiket špatně', () => {
    const bezPolohy: MlKitVysledek = { blocks: [{ lines: [{ text: 'nikde' }] }] };
    expect(zMlKit(bezPolohy)).toEqual([]);
  });

  it('prázdný výsledek dá prázdný seznam', () => {
    expect(zMlKit({ blocks: [] })).toEqual([]);
  });
});

describe('od ML Kitu k přečtenému tiketu', () => {
  for (const sklon of [0, 5, -5]) {
    it(`spáruje oddělené bloky do sloupců při náklonu ${sklon}°`, () => {
      const utrzky = zMlKit(vystupMlKit(sklon));
      expect(slozRadky(utrzky)).toHaveLength(3);

      const tiket = prectiTiket(utrzky, 'eurojackpot');
      expect(tiket.sloupce.map((s) => s.cisla)).toEqual([
        [23, 30, 33, 37, 47],
        [2, 22, 37, 39, 40],
        [4, 6, 7, 12, 33],
      ]);
      expect(tiket.sloupce.map((s) => s.eurocisla)).toEqual([
        [2, 3],
        [2, 12],
        [1, 11],
      ]);
      expect(tiket.sloupce.every((s) => s.problemy.length === 0)).toBe(true);
    });
  }
});
