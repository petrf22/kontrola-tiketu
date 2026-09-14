import { describe, expect, it, vi } from 'vitest';
import type { MlKitVysledek } from '@kontrola-tiketu/ocr';
import { nactiTiketZeSnimku, type Zavislosti } from '../src/app/data/snimekTiketu.js';

/**
 * Ukládání snímku na disk je vědomá odchylka od původního zadání (viz
 * docs/ocr-a-carovy-kod.md). Podmínkou bylo, že soubor vždycky zmizí — a přesně to
 * tyhle testy hlídají. Bez nich je odchylka jen slib.
 */

/** Payload tiketu tak, jak ho čtečka vrací — znaménkové Java bajty. */
const BAJTY_KODU: number[] = [
  82, 66, 70, 49, 54, 77, 19, 0, 2, 0, 1,
  ...Array.from({ length: 72 }, (_, i) => (i % 2 === 0 ? -(i + 1) : i + 1)),
  2, 1, 0, 22, 1, 0,
  ...[...'12345678901234567890'].map((z) => z.charCodeAt(0)),
  11, 1,
  ...[...'9876543210'].map((z) => z.charCodeAt(0)),
];

const VYSLEDEK: MlKitVysledek = {
  blocks: [
    {
      lines: [
        {
          text: '1: 23 30 33 37 47',
          boundingBox: { left: 40, top: 90, right: 240, bottom: 110 },
        },
        {
          text: '02 03 NT',
          boundingBox: { left: 400, top: 90, right: 496, bottom: 110 },
        },
      ],
    },
  ],
};

function zavislosti(prepis: Partial<Zavislosti> = {}) {
  const smazano: string[] = [];
  const zaklad: Zavislosti = {
    poriz: async () => '/data/user/0/cz.petrf22.kontrolatiketu/cache/snimek.jpg',
    rozpoznej: async () => VYSLEDEK,
    prectiKody: async () => [{ bytes: BAJTY_KODU }],
    ukliď: async (cesta) => {
      smazano.push(cesta);
    },
    ...prepis,
  };
  return { z: zaklad, smazano };
}

describe('nactiTiketZeSnimku', () => {
  it('přečte sloupce ze snímku', async () => {
    const { z } = zavislosti();
    const { cteni } = await nactiTiketZeSnimku(z);
    expect(cteni?.sloupce[0]?.cisla).toEqual([23, 30, 33, 37, 47]);
    expect(cteni?.sloupce[0]?.druheOsudi).toEqual([2, 3]);
  });

  it('smaže dočasný soubor po úspěšném rozpoznání', async () => {
    const { z, smazano } = zavislosti();
    const { docasnySoubor } = await nactiTiketZeSnimku(z);
    expect(smazano).toEqual([docasnySoubor]);
  });

  it('smaže dočasný soubor i když rozpoznávání selže', async () => {
    // Tohle je ta podstatná záruka: snímek tiketu nesmí zůstat ležet na disku.
    const { z, smazano } = zavislosti({
      rozpoznej: async () => {
        throw new Error('ML Kit selhal');
      },
    });
    await expect(nactiTiketZeSnimku(z)).rejects.toThrow('ML Kit selhal');
    expect(smazano).toHaveLength(1);
  });

  it('selhání úklidu nezakryje původní chybu', async () => {
    const { z } = zavislosti({
      rozpoznej: async () => {
        throw new Error('ML Kit selhal');
      },
      ukliď: async () => {
        throw new Error('soubor se nepodařilo smazat');
      },
    });
    // Uživatel se musí dozvědět, proč selhalo rozpoznávání, ne že se nepovedl úklid.
    await expect(nactiTiketZeSnimku(z)).rejects.toThrow('ML Kit selhal');
  });

  it('když se snímek nepodaří pořídit, nemá se co uklízet', async () => {
    const ukliď = vi.fn(async () => {});
    const { z } = zavislosti({
      poriz: async () => {
        throw new Error('uživatel sken zrušil');
      },
      ukliď,
    });
    await expect(nactiTiketZeSnimku(z)).rejects.toThrow('zrušil');
    expect(ukliď).not.toHaveBeenCalled();
  });

  it('prázdný snímek nedá vymyšlený tiket', async () => {
    const { z, smazano } = zavislosti({ rozpoznej: async () => ({ blocks: [] }) });
    const { cteni, maSloupce } = await nactiTiketZeSnimku(z);
    expect(cteni?.sloupce).toEqual([]);
    expect(maSloupce).toBe(false);
    expect(smazano).toHaveLength(1);
  });
});

describe('čárový kód z téže fotky', () => {
  it('přečte sériové číslo spolu s čísly, takže se neskenuje dvakrát', async () => {
    const { z } = zavislosti();
    const { cteni, serioveCislo } = await nactiTiketZeSnimku(z);
    expect(cteni?.sloupce[0]?.cisla).toEqual([23, 30, 33, 37, 47]);
    expect(serioveCislo).toBe('12345678901234567890');
  });

  it('když fotka kód nezachytí, čísla se nezahodí', async () => {
    const { z } = zavislosti({ prectiKody: async () => [] });
    const { maSloupce, prectiJako, serioveCislo } = await nactiTiketZeSnimku(z);
    expect(serioveCislo).toBeNull();
    expect(maSloupce).toBe(true);
    expect(prectiJako('eurojackpot').sloupce).toHaveLength(1);
  });

  it('selhání čtečky kódů nesmí shodit celé rozpoznání', async () => {
    const { z, smazano } = zavislosti({
      prectiKody: async () => {
        throw new Error('čtečka selhala');
      },
    });
    const { maSloupce, serioveCislo } = await nactiTiketZeSnimku(z);
    expect(serioveCislo).toBeNull();
    expect(maSloupce).toBe(true);
    expect(smazano).toHaveLength(1); // úklid proběhl i tak
  });

  it('cizí kód na snímku se přeskočí', async () => {
    const cizi = [...'NECOJINEHO'].map((z) => z.charCodeAt(0));
    const { z } = zavislosti({ prectiKody: async () => [{ bytes: cizi }, { bytes: BAJTY_KODU }] });
    expect((await nactiTiketZeSnimku(z)).serioveCislo).toBe('12345678901234567890');
  });

  it('číslo klubové karty z fotky neprosákne', async () => {
    const { z } = zavislosti();
    const vysledek = await nactiTiketZeSnimku(z);
    expect(JSON.stringify(vysledek)).not.toContain('9876543210');
  });
});

describe('hra z téže fotky', () => {
  /** Rozpoznaný text tiketu Sportky s popiskem Šance, bez čárového kódu. */
  const SPORTKA: MlKitVysledek = {
    blocks: [
      {
        lines: [
          { text: '1: 05 12 23 31 40 49 NT', boundingBox: { left: 40, top: 90, right: 320, bottom: 110 } },
          { text: 'Šance: 654321', boundingBox: { left: 40, top: 130, right: 200, bottom: 150 } },
        ],
      },
    ],
  };

  it('pozná hru z čárového kódu a rovnou tiket přečte', async () => {
    const { z } = zavislosti();
    const { hra, cteni } = await nactiTiketZeSnimku(z);
    expect(hra).toEqual({ hra: 'eurojackpot', podle: ['čárový kód'] });
    expect(cteni?.hra).toBe('eurojackpot');
  });

  it('bez kódu pozná hru z popisku doplňkové hry', async () => {
    const { z } = zavislosti({ rozpoznej: async () => SPORTKA, prectiKody: async () => [] });
    const { hra, cteni } = await nactiTiketZeSnimku(z);
    expect(hra.hra).toBe('sportka');
    expect(cteni?.sloupce[0]?.cisla).toEqual([5, 12, 23, 31, 40, 49]);
    expect(cteni?.kodDoplnkoveHry).toBe('654321');
  });

  it('rozpor mezi kódem a textem nechá hru na uživateli a snímek jde přečíst znovu', async () => {
    // Kód Eurojackpotu, text Sportky.
    const { z, smazano } = zavislosti({ rozpoznej: async () => SPORTKA });
    const vysledek = await nactiTiketZeSnimku(z);
    expect(vysledek.hra.hra).toBeNull();
    expect(vysledek.cteni).toBeNull();
    expect(smazano).toHaveLength(1);
    // Volba uživatele se přečte z paměti, bez dalšího snímku.
    expect(vysledek.prectiJako('sportka').sloupce[0]?.cisla).toEqual([5, 12, 23, 31, 40, 49]);
  });
});
