import { describe, expect, it } from 'vitest';
import { ChybaArgumentu, parsujArgumenty } from '../src/cli.js';
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
