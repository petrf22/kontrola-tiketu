import { describe, expect, it } from 'vitest';
import {
  ChybaObdobi,
  formatujTyden,
  parsujTyden,
  tydnuVRoce,
  tydnyOdDo,
} from '../src/obdobi.js';

describe('tydnuVRoce', () => {
  it('pozná roky s 53 ISO týdny', () => {
    // Ověřeno proti ISO kalendáři: 53 týdnů má rok, jehož 1. leden je čtvrtek,
    // nebo přestupný rok začínající ve středu.
    expect(tydnuVRoce(2015)).toBe(53); // 1. 1. čtvrtek
    expect(tydnuVRoce(2020)).toBe(53); // přestupný, 1. 1. středa
    expect(tydnuVRoce(2026)).toBe(53); // 1. 1. čtvrtek
    expect(tydnuVRoce(2016)).toBe(52); // přestupný, ale 1. 1. pátek
    expect(tydnuVRoce(2024)).toBe(52); // přestupný, 1. 1. pondělí
    expect(tydnuVRoce(2025)).toBe(52);
    expect(tydnuVRoce(2027)).toBe(52);
  });
});

describe('parsujTyden', () => {
  it('přečte tvar RRRR-TT i bez vedoucí nuly', () => {
    expect(parsujTyden('2026-36')).toEqual({ rok: 2026, tyden: 36 });
    expect(parsujTyden('2026-6')).toEqual({ rok: 2026, tyden: 6 });
  });

  it('odmítne nesmyslný tvar', () => {
    expect(() => parsujTyden('2026')).toThrow(ChybaObdobi);
    expect(() => parsujTyden('36-2026')).toThrow(ChybaObdobi);
    expect(() => parsujTyden('')).toThrow(ChybaObdobi);
  });

  it('odmítne týden, který v daném roce neexistuje', () => {
    expect(() => parsujTyden('2027-53')).toThrow(/52 týdnů/);
    expect(parsujTyden('2026-53')).toEqual({ rok: 2026, tyden: 53 });
    expect(() => parsujTyden('2026-0')).toThrow(ChybaObdobi);
  });
});

describe('formatujTyden', () => {
  it('doplní vedoucí nulu', () => {
    expect(formatujTyden({ rok: 2026, tyden: 6 })).toBe('2026-06');
  });
});

describe('tydnyOdDo', () => {
  it('vyjmenuje týdny v jednom roce', () => {
    expect(tydnyOdDo({ rok: 2026, tyden: 35 }, { rok: 2026, tyden: 37 })).toEqual([
      { rok: 2026, tyden: 35 },
      { rok: 2026, tyden: 36 },
      { rok: 2026, tyden: 37 },
    ]);
  });

  it('jeden týden je taky období', () => {
    expect(tydnyOdDo({ rok: 2026, tyden: 1 }, { rok: 2026, tyden: 1 })).toHaveLength(1);
  });

  it('přechází přes hranici roku a respektuje 53. týden', () => {
    const tydny = tydnyOdDo({ rok: 2015, tyden: 52 }, { rok: 2016, tyden: 2 });
    expect(tydny).toEqual([
      { rok: 2015, tyden: 52 },
      { rok: 2015, tyden: 53 },
      { rok: 2016, tyden: 1 },
      { rok: 2016, tyden: 2 },
    ]);
  });

  it('u roku s 52 týdny 53. přeskočí', () => {
    const tydny = tydnyOdDo({ rok: 2025, tyden: 52 }, { rok: 2026, tyden: 1 });
    expect(tydny).toEqual([
      { rok: 2025, tyden: 52 },
      { rok: 2026, tyden: 1 },
    ]);
  });

  it('celý rok se vyjmenuje podle svého skutečného počtu týdnů', () => {
    expect(tydnyOdDo({ rok: 2026, tyden: 1 }, { rok: 2026, tyden: 53 })).toHaveLength(53);
    expect(tydnyOdDo({ rok: 2027, tyden: 1 }, { rok: 2027, tyden: 52 })).toHaveLength(52);
  });

  it('obrácené období je chyba, ne prázdný seznam', () => {
    expect(() => tydnyOdDo({ rok: 2026, tyden: 10 }, { rok: 2026, tyden: 9 })).toThrow(ChybaObdobi);
  });
});
