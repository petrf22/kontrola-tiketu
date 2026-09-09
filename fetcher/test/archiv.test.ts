import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  jeVArchivu,
  nactiZArchivu,
  nazevSouboru,
  seznamArchivu,
  ulozDoArchivu,
} from '../src/archiv.js';

let koren: string;

beforeEach(async () => {
  koren = await mkdtemp(join(tmpdir(), 'archiv-test-'));
});
afterEach(async () => {
  await rm(koren, { recursive: true, force: true });
});

describe('nazevSouboru', () => {
  it('doplňuje nulu v čísle týdne, aby šly soubory řadit', () => {
    expect(nazevSouboru({ hra: 'sportka', rok: 2026, tyden: 6 })).toBe('sportka-2026-06.html.gz');
    expect(nazevSouboru({ hra: 'eurojackpot', rok: 2015, tyden: 36 })).toBe(
      'eurojackpot-2015-36.html.gz',
    );
  });
});

describe('ukládání a čtení', () => {
  it('uložené se přečte beze změny', async () => {
    const souradnice = { hra: 'sportka' as const, rok: 2026, tyden: 36 };
    const html = '<html>ŠANCE STŘEDA – diakritika i nedělitelná mezera</html>';
    await ulozDoArchivu(koren, souradnice, html);
    expect(await nactiZArchivu(koren, souradnice)).toBe(html);
  });

  it('založí adresář, když ještě neexistuje', async () => {
    const hloubeji = join(koren, 'a', 'b');
    await ulozDoArchivu(hloubeji, { hra: 'sportka', rok: 2026, tyden: 1 }, 'x');
    expect(await nactiZArchivu(hloubeji, { hra: 'sportka', rok: 2026, tyden: 1 })).toBe('x');
  });

  it('chybějící záznam je null, ne výjimka — díky tomu se pozná, co dostáhnout', async () => {
    expect(await nactiZArchivu(koren, { hra: 'sportka', rok: 1990, tyden: 1 })).toBeNull();
    expect(await jeVArchivu(koren, { hra: 'sportka', rok: 1990, tyden: 1 })).toBe(false);
  });

  it('uložení podruhé přepíše', async () => {
    const s = { hra: 'eurojackpot' as const, rok: 2026, tyden: 37 };
    await ulozDoArchivu(koren, s, 'staré');
    await ulozDoArchivu(koren, s, 'nové');
    expect(await nactiZArchivu(koren, s)).toBe('nové');
  });

  it('komprimuje — archiv celé historie se má vejít do jednotek megabajtů', async () => {
    const s = { hra: 'sportka' as const, rok: 2026, tyden: 36 };
    const html = '<td class="b2 s32b">21</td>'.repeat(2000);
    await ulozDoArchivu(koren, s, html);
    const { size } = await import('node:fs/promises').then((m) => m.stat(join(koren, nazevSouboru(s))));
    expect(size).toBeLessThan(html.length / 10);
  });
});

describe('seznamArchivu', () => {
  it('neexistující archiv je prázdný seznam, ne chyba', async () => {
    expect(await seznamArchivu(join(koren, 'nic'))).toEqual([]);
  });

  it('řadí chronologicky napříč hrami', async () => {
    await ulozDoArchivu(koren, { hra: 'sportka', rok: 2026, tyden: 2 }, 'a');
    await ulozDoArchivu(koren, { hra: 'eurojackpot', rok: 2025, tyden: 50 }, 'b');
    await ulozDoArchivu(koren, { hra: 'eurojackpot', rok: 2026, tyden: 2 }, 'c');
    expect(await seznamArchivu(koren)).toEqual([
      { hra: 'eurojackpot', rok: 2025, tyden: 50 },
      { hra: 'eurojackpot', rok: 2026, tyden: 2 },
      { hra: 'sportka', rok: 2026, tyden: 2 },
    ]);
  });

  it('ignoruje cizí soubory v adresáři', async () => {
    await ulozDoArchivu(koren, { hra: 'sportka', rok: 2026, tyden: 1 }, 'a');
    await writeFile(join(koren, 'poznamky.txt'), 'nic');
    await writeFile(join(koren, 'sportka-2026.html.gz'), 'nic');
    expect(await seznamArchivu(koren)).toEqual([{ hra: 'sportka', rok: 2026, tyden: 1 }]);
  });
});
