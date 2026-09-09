import { describe, expect, it, vi } from 'vitest';
import type { MlKitVysledek } from '@kontrola-tiketu/ocr';
import { nactiTiketZeSnimku, type Zavislosti } from '../src/app/data/snimekTiketu.js';

/**
 * Ukládání snímku na disk je vědomá odchylka od původního zadání (viz
 * docs/ocr-a-carovy-kod.md). Podmínkou bylo, že soubor vždycky zmizí — a přesně to
 * tyhle testy hlídají. Bez nich je odchylka jen slib.
 */

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
    const { cteni } = await nactiTiketZeSnimku('eurojackpot', z);
    expect(cteni.sloupce[0]?.cisla).toEqual([23, 30, 33, 37, 47]);
    expect(cteni.sloupce[0]?.eurocisla).toEqual([2, 3]);
  });

  it('smaže dočasný soubor po úspěšném rozpoznání', async () => {
    const { z, smazano } = zavislosti();
    const { docasnySoubor } = await nactiTiketZeSnimku('eurojackpot', z);
    expect(smazano).toEqual([docasnySoubor]);
  });

  it('smaže dočasný soubor i když rozpoznávání selže', async () => {
    // Tohle je ta podstatná záruka: snímek tiketu nesmí zůstat ležet na disku.
    const { z, smazano } = zavislosti({
      rozpoznej: async () => {
        throw new Error('ML Kit selhal');
      },
    });
    await expect(nactiTiketZeSnimku('eurojackpot', z)).rejects.toThrow('ML Kit selhal');
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
    await expect(nactiTiketZeSnimku('eurojackpot', z)).rejects.toThrow('ML Kit selhal');
  });

  it('když se snímek nepodaří pořídit, nemá se co uklízet', async () => {
    const ukliď = vi.fn(async () => {});
    const { z } = zavislosti({
      poriz: async () => {
        throw new Error('uživatel sken zrušil');
      },
      ukliď,
    });
    await expect(nactiTiketZeSnimku('eurojackpot', z)).rejects.toThrow('zrušil');
    expect(ukliď).not.toHaveBeenCalled();
  });

  it('prázdný snímek nedá vymyšlený tiket', async () => {
    const { z, smazano } = zavislosti({ rozpoznej: async () => ({ blocks: [] }) });
    const { cteni } = await nactiTiketZeSnimku('eurojackpot', z);
    expect(cteni.sloupce).toEqual([]);
    expect(smazano).toHaveLength(1);
  });
});
