import { describe, expect, it } from 'vitest';
import { ChybaArgumentu, parsujArgumenty, vyberZArchivu } from '../src/cli.js';
import { ChybaObdobi } from '../src/obdobi.js';

describe('parsujArgumenty', () => {
  it('stahni potřebuje období', () => {
    expect(() => parsujArgumenty(['stahni'])).toThrow(ChybaArgumentu);
    expect(() => parsujArgumenty(['stahni', '--od', '2026-01'])).toThrow(/--od a --do/);
  });

  it('preparsuj potřebuje výstupní soubor', () => {
    expect(() => parsujArgumenty(['preparsuj'])).toThrow(/--out/);
  });

  it('bez --hra pracuje s oběma hrami', () => {
    const a = parsujArgumenty(['stahni', '--od', '2026-01', '--do', '2026-02']);
    expect(a.hry).toEqual(['eurojackpot', 'sportka']);
  });

  it('s --hra jen s vybranou', () => {
    const a = parsujArgumenty(['stahni', '--od', '2026-01', '--do', '2026-02', '--hra', 'sportka']);
    expect(a.hry).toEqual(['sportka']);
  });

  it('odmítne neznámou hru i neznámý příkaz', () => {
    expect(() =>
      parsujArgumenty(['stahni', '--od', '2026-01', '--do', '2026-02', '--hra', 'keno']),
    ).toThrow(/Neznámá hra/);
    expect(() => parsujArgumenty(['smaz'])).toThrow(/Neznámý příkaz/);
    expect(() => parsujArgumenty([])).toThrow(ChybaArgumentu);
  });

  it('chybný týden hlásí srozumitelně', () => {
    expect(() => parsujArgumenty(['stahni', '--od', 'včera', '--do', '2026-02'])).toThrow(
      ChybaObdobi,
    );
  });

  it('výchozí archiv je absolutní, aby nezáležel na aktuálním adresáři', () => {
    const a = parsujArgumenty(['stav']);
    expect(a.archiv.startsWith('/')).toBe(true);
    expect(a.archiv).toContain('fetcher');
  });

  it('zadaný archiv má přednost', () => {
    expect(parsujArgumenty(['stav', '--archiv', 'jinde']).archiv).toBe('jinde');
  });

  it('stav si vystačí bez období', () => {
    const a = parsujArgumenty(['stav']);
    expect(a.od).toBeNull();
    expect(a.do).toBeNull();
  });
});

describe('vyberZArchivu', () => {
  const archiv = [
    { hra: 'eurojackpot' as const, rok: 2015, tyden: 10 },
    { hra: 'sportka' as const, rok: 2015, tyden: 10 },
    { hra: 'sportka' as const, rok: 2026, tyden: 35 },
    { hra: 'eurojackpot' as const, rok: 2026, tyden: 36 },
  ];

  it('bez omezení vrátí všechno', () => {
    expect(vyberZArchivu(archiv, ['eurojackpot', 'sportka'], null, null)).toEqual(archiv);
  });

  it('filtruje podle hry', () => {
    expect(vyberZArchivu(archiv, ['sportka'], null, null).map((z) => z.rok)).toEqual([2015, 2026]);
  });

  it('filtruje podle období včetně krajních týdnů', () => {
    const vybrane = vyberZArchivu(
      archiv,
      ['eurojackpot', 'sportka'],
      { rok: 2026, tyden: 35 },
      { rok: 2026, tyden: 36 },
    );
    expect(vybrane).toHaveLength(2);
  });

  it('porovnává i přes hranici roku, ne jen čísla týdnů', () => {
    // Týden 2015-10 nesmí projít filtrem 2026-05 až 2026-36, i když 10 leží mezi 5 a 36.
    const vybrane = vyberZArchivu(
      archiv,
      ['eurojackpot', 'sportka'],
      { rok: 2026, tyden: 5 },
      { rok: 2026, tyden: 36 },
    );
    expect(vybrane.every((z) => z.rok === 2026)).toBe(true);
  });

  it('hra a období se kombinují', () => {
    const vybrane = vyberZArchivu(archiv, ['sportka'], { rok: 2026, tyden: 1 }, null);
    expect(vybrane).toEqual([{ hra: 'sportka', rok: 2026, tyden: 35 }]);
  });

  it('když nic neodpovídá, vrátí prázdno — volající to hlásí jako chybu', () => {
    expect(vyberZArchivu(archiv, ['sportka'], { rok: 2030, tyden: 1 }, null)).toEqual([]);
  });
});
