import { describe, expect, it } from 'vitest';
import { median, odhadniSklon, slozRadky, stred, type RozpoznanyText } from '../src/index.js';
import { tiketEJ } from './pomocnici.js';

const TIKET = [
  ['1: 23 30 33 37 47', '02 03 NT'],
  ['2: 02 22 37 39 40', '02 12 NT'],
  ['3: 04 06 07 12 33', '01 11 NT'],
];

describe('pomocné výpočty', () => {
  it('median u sudého počtu bere průměr prostředních', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([])).toBe(0);
  });

  it('stred počítá střed rámečku', () => {
    expect(stred({ x: 10, y: 20, sirka: 100, vyska: 40 })).toEqual({ x: 60, y: 40 });
  });
});

describe('slozRadky', () => {
  it('spáruje levý a pravý blok do jednoho řádku', () => {
    const radky = slozRadky(tiketEJ(TIKET));
    expect(radky).toHaveLength(3);
    expect(radky[0]?.text).toBe('1: 23 30 33 37 47 02 03 NT');
    expect(radky[2]?.text).toBe('3: 04 06 07 12 33 01 11 NT');
  });

  it('nezáleží na pořadí útržků ve vstupu', () => {
    const utrzky = tiketEJ(TIKET);
    const obracene = [...utrzky].reverse();
    expect(slozRadky(obracene).map((r) => r.text)).toEqual(slozRadky(utrzky).map((r) => r.text));
  });

  it('řadí řádky shora dolů', () => {
    const radky = slozRadky(tiketEJ(TIKET));
    expect(radky.map((r) => r.text.slice(0, 1))).toEqual(['1', '2', '3']);
  });

  it('útržky v řádku řadí zleva doprava, ne podle vstupu', () => {
    const radky = slozRadky(tiketEJ([['1: 23 30 33 37 47', '02 03 NT']]));
    expect(radky[0]?.utrzky.map((u) => u.ramecek.x)).toEqual([40, 400]);
  });

  it('prázdný vstup dá prázdný výsledek, ne chybu', () => {
    expect(slozRadky([])).toEqual([]);
  });

  it('jediný útržek je jeden řádek', () => {
    const jeden: RozpoznanyText[] = [
      { text: 'ahoj', ramecek: { x: 0, y: 0, sirka: 50, vyska: 20 } },
    ];
    expect(slozRadky(jeden)).toHaveLength(1);
  });
});

describe('nakloněný snímek', () => {
  for (const sklon of [-8, -3, 0, 3, 8]) {
    it(`spáruje řádky i při náklonu ${sklon}°`, () => {
      const radky = slozRadky(tiketEJ(TIKET, { sklonStupnu: sklon }));
      expect(radky).toHaveLength(3);
      expect(radky[0]?.text).toBe('1: 23 30 33 37 47 02 03 NT');
      expect(radky[1]?.text).toBe('2: 02 22 37 39 40 02 12 NT');
      expect(radky[2]?.text).toBe('3: 04 06 07 12 33 01 11 NT');
    });
  }

  it('bez korekce sklonu by se řádky spletly — proto se sklon odhaduje', () => {
    // Kontrola, že test výše opravdu něco dokazuje: se sklonem natvrdo na nulu to selže.
    const radky = slozRadky(tiketEJ(TIKET, { sklonStupnu: 8 }), { sklonStupnu: 0 });
    expect(radky.map((r) => r.text)).not.toEqual([
      '1: 23 30 33 37 47 02 03 NT',
      '2: 02 22 37 39 40 02 12 NT',
      '3: 04 06 07 12 33 01 11 NT',
    ]);
  });

  it('odhadne sklon ze vstupu přesně', () => {
    for (const sklon of [-12, -8, -3, -0.5, 0, 3, 8, 12]) {
      const odhad = odhadniSklon(tiketEJ(TIKET, { sklonStupnu: sklon }));
      expect(Math.abs(odhad - sklon), `${sklon}°`).toBeLessThanOrEqual(0.5);
    }
  });

  it('trefí střed pásu shodně skórujících úhlů, ne jeho okraj', () => {
    // Tolerance je velkorysá, takže nejlepší skóre mívá celý pás úhlů. Kdyby se bral
    // okraj, odhad by soustavně ujížděl — dřív takhle vycházelo 8° jako 7°.
    expect(odhadniSklon(tiketEJ(TIKET, { sklonStupnu: 8 }))).toBe(8);
  });

  it('dá přednost úhlu, který uvedl rozpoznávač', () => {
    const utrzky = tiketEJ(TIKET).map((u) => ({ ...u, uhel: 5 }));
    expect(odhadniSklon(utrzky)).toBe(5);
  });
});

describe('odolnost proti slévání řádků', () => {
  it('husté řádky zůstanou oddělené', () => {
    const radky = slozRadky(tiketEJ(TIKET, { vyskaTextu: 20, rozteč: 26 }));
    expect(radky).toHaveLength(3);
  });

  it('tolerance se dá přitáhnout, když je tisk hodně nahuštěný', () => {
    const utrzky = tiketEJ(TIKET, { vyskaTextu: 20, rozteč: 22 });
    expect(slozRadky(utrzky, { tolerance: 0.4 })).toHaveLength(3);
  });

  it('řádky se nerozlézají — porovnává se s prvním prvkem skupiny', () => {
    // Útržky posunuté vždy o kousek: kdyby se porovnávalo se sousedem, slily by se v jeden.
    const schody: RozpoznanyText[] = Array.from({ length: 6 }, (_, i) => ({
      text: `${i}`,
      ramecek: { x: i * 100, y: i * 9, sirka: 20, vyska: 20 },
    }));
    expect(slozRadky(schody, { sklonStupnu: 0 }).length).toBeGreaterThan(1);
  });
});

describe('celý tiket i s hlavičkou a oddělovači', () => {
  const CELY = [
    ['SLOSOVÁNÍ: 1 (ÚT)', '08.09.2026'],
    ['------------------------------------------------'],
    ['1: 23 30 33 37 47', '02 03 NT'],
    ['2: 02 22 37 39 40', '02 12 NT'],
    ['3: 04 06 07 12 33', '01 11 NT'],
    ['------------------------------------------------'],
  ];

  for (const sklon of [-8, -4, 0, 4, 8]) {
    it(`řádky různé šířky se nespletou při náklonu ${sklon}°`, () => {
      const radky = slozRadky(tiketEJ(CELY, { sklonStupnu: sklon }));
      expect(radky).toHaveLength(6);
      expect(radky[0]?.text).toBe('SLOSOVÁNÍ: 1 (ÚT) 08.09.2026');
      expect(radky[2]?.text).toBe('1: 23 30 33 37 47 02 03 NT');
      expect(radky[4]?.text).toBe('3: 04 06 07 12 33 01 11 NT');
    });
  }
});
