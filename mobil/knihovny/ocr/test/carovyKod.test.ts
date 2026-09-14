import { describe, expect, it } from 'vitest';
import type { Hra } from '@kontrola-tiketu/jadro';
import {
  ChybaCarovehoKodu,
  lokalniId,
  NEJMENSI_DELKA,
  prectiCarovyKod,
} from '../src/index.js';

// Zjevně vymyšlené hodnoty. Test ověřuje tvar a chování, ne konkrétní čísla, takže
// nemá smysl sem tahat nic, co by se dalo splést s údaji ze skutečného tiketu.
const SERIOVE_CISLO = '12345678901234567890';
const CISLO_KLUBOVE_KARTY = '9876543210';
const ZNACKA = [0x02, 0x01, 0x00, 0x16, 0x01, 0x00];

/**
 * Hlavičky a délky šifrovaného bloku ze skutečných tiketů (9. a 14. 9. 2026). Bajty 4–5
 * jsou taky převzaté, ale nic se z nich nečte.
 */
const TIKETY: readonly { hra: Hra; bajty45: [number, number]; hlavicka: number[]; blok: number; karta: boolean }[] = [
  { hra: 'eurojackpot', bajty45: [0x36, 0x4d], hlavicka: [0x13, 0, 2, 0, 1], blok: 72, karta: true },
  { hra: 'eurojackpot', bajty45: [0x16, 0x25], hlavicka: [0x13, 0, 2, 0, 1], blok: 32, karta: false },
  { hra: 'sportka', bajty45: [0x16, 0x2d], hlavicka: [0x0f, 0, 1, 0, 1], blok: 40, karta: false },
  { hra: 'euromiliony', bajty45: [0x16, 0x1d], hlavicka: [0x0c, 0, 1, 0, 1], blok: 24, karta: false },
];

/**
 * Sestaví payload podle struktury ze skutečných tiketů. Šifrovaný blok je nahrazený výplní —
 * jeho obsah nás nezajímá a nezkoumá se.
 */
function payload(
  zmeny: {
    magic?: string;
    serioveCislo?: string;
    bezKarty?: boolean;
    delkaBloku?: number;
    hlavicka?: readonly number[];
    blok?: (i: number) => number;
  } = {},
): Uint8Array {
  const text = (t: string) => [...t].map((z) => z.charCodeAt(0));
  const delkaBloku = zmeny.delkaBloku ?? 72;
  return Uint8Array.from([
    ...text(zmeny.magic ?? 'RBF16M'),
    ...(zmeny.hlavicka ?? [0x13, 0x00, 0x02, 0x00, 0x01]),
    ...Array.from({ length: delkaBloku }, (_, i) => zmeny.blok?.(i) ?? ((i + 11) * 37) % 256),
    ...ZNACKA,
    ...text(zmeny.serioveCislo ?? SERIOVE_CISLO),
    ...(zmeny.bezKarty === true ? [] : [0x0b, 0x01, ...text(CISLO_KLUBOVE_KARTY)]),
  ]);
}

describe('prectiCarovyKod', () => {
  it('přečte sériové číslo tiketu', () => {
    expect(prectiCarovyKod(payload()).serioveCislo).toBe(SERIOVE_CISLO);
  });

  it('vrátí bajty hlavičky pro případ, že by Allwyn formát změnil', () => {
    expect(prectiCarovyKod(payload()).verze).toBe('13 00 02 00 01');
  });

  it('poradí si s kódem bez čísla klubové karty', () => {
    expect(prectiCarovyKod(payload({ bezKarty: true })).serioveCislo).toBe(SERIOVE_CISLO);
  });

  it('odmítne cizí kód podle hlavičky', () => {
    expect(() => prectiCarovyKod(payload({ magic: 'XXXXXX' }))).toThrow(ChybaCarovehoKodu);
    expect(() => prectiCarovyKod(payload({ magic: 'XXXXXX' }))).toThrow(/RBF1/);
  });

  it('odmítne příliš krátký payload', () => {
    expect(NEJMENSI_DELKA).toBe(37);
    expect(() => prectiCarovyKod(new Uint8Array(30))).toThrow(/37/);
  });

  it('pozná, že za značkou nejsou číslice', () => {
    expect(() => prectiCarovyKod(payload({ serioveCislo: 'ABCDEFGHIJKLMNOPQRST' }))).toThrow(
      /sériové číslo/,
    );
  });

  it('odmítne kód bez značky sériového čísla', () => {
    const bezZnacky = payload();
    bezZnacky.set([0, 0, 0, 0, 0, 0], 6 + 5 + 72);
    expect(() => prectiCarovyKod(bezZnacky)).toThrow(ChybaCarovehoKodu);
  });

  it('nenechá se zmást značkou uvnitř šifrovaného bloku', () => {
    // Stejná šestice bajtů v bloku, ale bez dvaceti číslic za ní.
    const blok = (i: number) => (i >= 4 && i < 10 ? ZNACKA[i - 4]! : 0xee);
    expect(prectiCarovyKod(payload({ blok })).serioveCislo).toBe(SERIOVE_CISLO);
  });
});

describe('tikety s různě dlouhým šifrovaným blokem', () => {
  for (const tiket of TIKETY) {
    const bajty = payload({
      delkaBloku: tiket.blok,
      hlavicka: tiket.hlavicka,
      bezKarty: !tiket.karta,
    });
    bajty.set(tiket.bajty45, 4);
    const popis = `${tiket.hra}, blok ${tiket.blok} bajtů${tiket.karta ? ', s kartou' : ''}`;

    it(`${popis}: přečte sériové číslo`, () => {
      expect(prectiCarovyKod(bajty).serioveCislo).toBe(SERIOVE_CISLO);
    });

    it(`${popis}: pozná hru z hlavičky`, () => {
      expect(prectiCarovyKod(bajty).hra).toBe(tiket.hra);
    });

    it(`${popis}: číslo karty neprosákne`, () => {
      expect(JSON.stringify(prectiCarovyKod(bajty))).not.toContain(CISLO_KLUBOVE_KARTY);
    });
  }

  it('neznámý bajt hlavičky není chyba, jen hru neurčí', () => {
    const vysledek = prectiCarovyKod(payload({ hlavicka: [0x42, 0, 1, 0, 1] }));
    expect(vysledek.hra).toBeNull();
    expect(vysledek.serioveCislo).toBe(SERIOVE_CISLO);
  });
});

describe('číslo klubové karty', () => {
  it('se nedostane do výsledku — není součástí návratového typu', () => {
    const vysledek = prectiCarovyKod(payload());
    expect(JSON.stringify(vysledek)).not.toContain(CISLO_KLUBOVE_KARTY);
  });

  it('neprosákne ani přes jediné pole výsledku', () => {
    const vysledek = prectiCarovyKod(payload());
    for (const hodnota of Object.values(vysledek)) {
      expect(String(hodnota)).not.toContain(CISLO_KLUBOVE_KARTY);
    }
  });

  it('kód s kartou i bez ní dá naprosto stejný výsledek', () => {
    // Kdyby se karta někam propsala, tyhle dva výsledky by se lišily.
    expect(prectiCarovyKod(payload())).toEqual(prectiCarovyKod(payload({ bezKarty: true })));
  });
});

describe('šifrovaný blok', () => {
  it('se nezkoumá — na jeho obsahu výsledek nezávisí', () => {
    const a = payload();
    const b = payload({ blok: () => 0xff });
    expect(prectiCarovyKod(a)).toEqual(prectiCarovyKod(b));
  });
});

describe('lokalniId', () => {
  it('je odvozený ze sériového čísla, takže dva sken téhož tiketu splynou', () => {
    const prvni = lokalniId(prectiCarovyKod(payload()));
    const druhy = lokalniId(prectiCarovyKod(payload()));
    expect(prvni).toBe(druhy);
  });

  it('různé tikety mají různé id', () => {
    const jiny = payload({ serioveCislo: '99999999999999999999' });
    expect(lokalniId(prectiCarovyKod(payload()))).not.toBe(lokalniId(prectiCarovyKod(jiny)));
  });
});

/**
 * Regrese proti skutečnému tiketu.
 *
 * Struktura odpovídá payloadu, který čtečka opravdu vrátila (121 bajtů, ověřeno 9. 9. 2026
 * na reálném tiketu Eurojackpotu). Konkrétní číslice jsou nahrazené vymyšlenými — ověřuje
 * se tvar, ne obsah.
 */
describe('payload tak, jak ho vrací čtečka', () => {
  /** Bajty přicházejí z pluginu jako znaménkové Java hodnoty, tedy i záporné. */
  const znamenkoveBajty: number[] = [
    82, 66, 70, 49, 54, 77, 19, 0, 2, 0, 1,
    ...Array.from({ length: 72 }, (_, i) => (i % 2 === 0 ? -(i + 1) : i + 1)),
    2, 1, 0, 22, 1, 0,
    ...[...SERIOVE_CISLO].map((z) => z.charCodeAt(0)),
    11, 1,
    ...[...CISLO_KLUBOVE_KARTY].map((z) => z.charCodeAt(0)),
  ];

  const jakoUint8 = () => Uint8Array.from(znamenkoveBajty, (b) => b & 0xff);

  it('má 121 bajtů jako první tiket ze zadání', () => {
    expect(znamenkoveBajty).toHaveLength(121);
  });

  it('záporné bajty se převedou správně a přečte se sériové číslo i hra', () => {
    expect(prectiCarovyKod(jakoUint8())).toMatchObject({
      serioveCislo: SERIOVE_CISLO,
      hra: 'eurojackpot',
    });
  });

  it('číslo klubové karty ani odsud neprosákne', () => {
    const vysledek = prectiCarovyKod(jakoUint8());
    expect(JSON.stringify(vysledek)).not.toContain(CISLO_KLUBOVE_KARTY);
  });

  it('bez maskování by se šifrovaný blok rozsypal — proto se maskuje', () => {
    // Uint8Array.from bez převodu zápornou hodnotu ořízne jinak; tenhle test drží důvod,
    // proč je v obrazovce skenu `b & 0xff`.
    const spatne = Uint8Array.from(znamenkoveBajty.map((b) => (b < 0 ? 0 : b)));
    expect(prectiCarovyKod(spatne).serioveCislo).toBe(SERIOVE_CISLO); // hlavička i značka drží
    expect(spatne[11]).not.toBe(jakoUint8()[11]); // ale šifrovaný blok už ne
  });
});
