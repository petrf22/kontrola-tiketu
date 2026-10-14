import { describe, expect, it } from 'vitest';
import type { Tah } from '@kontrola-tiketu/jadro';
import { stavVysledku, vetaOChybejicich } from '../src/app/data/stavVysledku.js';

const tahy = (...klice: string[]): Pick<Tah, 'hra' | 'datum'>[] =>
  klice.map((k) => {
    const [hra, datum] = k.split(' ') as [Tah['hra'], string];
    return { hra, datum };
  });

// 13. 10. 2026 je úterý: losuje se Eurojackpot i Euromiliony.
const UTERY_VECER = new Date(2026, 9, 13, 21, 30);
const UTERY_RANO = new Date(2026, 9, 13, 10, 0);
const STREDA_RANO = new Date(2026, 9, 14, 8, 0);

describe('stavVysledku', () => {
  it('v úterý večer pozná, že Euromiliony jsou a Eurojackpot ještě ne', () => {
    const stav = stavVysledku(tahy('eurojackpot 2026-10-09', 'sportka 2026-10-11', 'euromiliony 2026-10-13'), UTERY_VECER);
    expect(stav).toEqual([
      { hra: 'eurojackpot', posledni: '2026-10-09', chybi: ['2026-10-13'] },
      { hra: 'sportka', posledni: '2026-10-11', chybi: [] },
      { hra: 'euromiliony', posledni: '2026-10-13', chybi: [] },
    ]);
  });

  it('dnešní losování před večerem nehlásí', () => {
    const stav = stavVysledku(tahy('eurojackpot 2026-10-09', 'euromiliony 2026-10-10'), UTERY_RANO);
    expect(stav.map((s) => s.chybi)).toEqual([[], []]);
  });

  it('včerejší losování hlásí i ráno, dnešní Sportku ještě ne', () => {
    const stav = stavVysledku(tahy('eurojackpot 2026-10-09', 'sportka 2026-10-11'), STREDA_RANO);
    expect(stav.map((s) => s.chybi)).toEqual([['2026-10-13'], []]);
  });

  it('při dlouhém výpadku vypíše jen poslední týden', () => {
    const stav = stavVysledku(tahy('sportka 2026-09-27'), STREDA_RANO);
    expect(stav[0]!.chybi).toEqual(['2026-10-07', '2026-10-09', '2026-10-11']);
  });

  it('hru bez jediného tahu vynechá', () => {
    expect(stavVysledku(tahy('sportka 2026-10-11'), UTERY_VECER).map((s) => s.hra)).toEqual(['sportka']);
    expect(stavVysledku([], UTERY_VECER)).toEqual([]);
  });
});

describe('vetaOChybejicich', () => {
  it('jedno, víc i žádné chybějící losování', () => {
    expect(vetaOChybejicich({ hra: 'eurojackpot', posledni: '2026-10-09', chybi: ['2026-10-13'] }))
      .toBe('Eurojackpot 13. 10. 2026 zatím není.');
    expect(vetaOChybejicich({ hra: 'sportka', posledni: '2026-10-04', chybi: ['2026-10-07', '2026-10-09', '2026-10-11'] }))
      .toBe('Sportka 7. 10. 2026, 9. 10. 2026 a 11. 10. 2026 zatím nejsou.');
    expect(vetaOChybejicich({ hra: 'sportka', posledni: '2026-10-11', chybi: [] })).toBe('');
  });
});
