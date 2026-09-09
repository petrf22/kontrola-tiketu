import { describe, expect, it } from 'vitest';
import {
  ChybaCarovehoKodu,
  lokalniId,
  NEJMENSI_DELKA,
  prectiCarovyKod,
} from '../src/index.js';

const SERIOVE_CISLO = '12396064434434021234';
const CISLO_KLUBOVE_KARTY = '9876543210';

/**
 * Sestaví payload podle struktury popsané v zadání (ověřeno na reálném tiketu, 121 bajtů).
 * Šifrovaný blok je nahrazený náhodnými bajty — jeho obsah nás nezajímá a nezkoumá se.
 */
function payload(
  zmeny: { magic?: string; serioveCislo?: string; bezKarty?: boolean } = {},
): Uint8Array {
  const bajty = new Uint8Array(zmeny.bezKarty === true ? 109 : 121);
  const zapis = (od: number, text: string) => {
    for (let i = 0; i < text.length; i++) bajty[od + i] = text.charCodeAt(i);
  };

  zapis(0, zmeny.magic ?? 'RBF16M');
  bajty.set([0x13, 0x00, 0x02, 0x00, 0x01], 6);
  for (let i = 11; i < 83; i++) bajty[i] = (i * 37) % 256; // šifrovaný blok, jen výplň
  bajty.set([0x02, 0x01, 0x00, 0x16, 0x01, 0x00], 83);
  zapis(89, zmeny.serioveCislo ?? SERIOVE_CISLO);
  if (zmeny.bezKarty !== true) {
    bajty.set([0x0b, 0x01], 109);
    zapis(111, CISLO_KLUBOVE_KARTY);
  }
  return bajty;
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
    expect(() => prectiCarovyKod(payload({ magic: 'XXXXXX' }))).toThrow(/RBF16M/);
  });

  it('odmítne příliš krátký payload', () => {
    expect(() => prectiCarovyKod(new Uint8Array(50))).toThrow(/109/);
    expect(NEJMENSI_DELKA).toBe(109);
  });

  it('pozná, že se na místě sériového čísla změnil formát', () => {
    expect(() => prectiCarovyKod(payload({ serioveCislo: 'ABCDEFGHIJKLMNOPQRST' }))).toThrow(
      /dvacet číslic/,
    );
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
    const b = payload();
    for (let i = 11; i < 83; i++) b[i] = 0xff;
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
    const jiny = payload({ serioveCislo: '99996064434434021234' });
    expect(lokalniId(prectiCarovyKod(payload()))).not.toBe(lokalniId(prectiCarovyKod(jiny)));
  });
});
