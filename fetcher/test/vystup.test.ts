import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { VERZE_FORMATU, type Tah } from '@kontrola-tiketu/jadro';
import { parsujListinu } from '../src/zdroje/allwyn-vyherka.js';
import { serad, sestavVystup } from '../src/vystup.js';

function listina(jmeno: string): Tah[] {
  const cesta = new URL(`fixtures/${jmeno}.html.gz`, import.meta.url);
  return parsujListinu(gunzipSync(readFileSync(cesta)).toString('utf8'));
}

describe('serad', () => {
  const ej = listina('eurojackpot-2026-36');
  const sp = listina('sportka-2026-36');

  it('řadí chronologicky napříč hrami', () => {
    const serazene = serad([...sp, ...ej]);
    expect(serazene.map((t) => t.datum)).toEqual([
      '2026-09-01',
      '2026-09-02',
      '2026-09-04',
      '2026-09-04',
      '2026-09-06',
    ]);
  });

  it('nespojí tahy různých her ze stejného dne', () => {
    // 4. 9. 2026 se losoval Eurojackpot i Sportka.
    const ctvrtyZari = serad([...sp, ...ej]).filter((t) => t.datum === '2026-09-04');
    expect(ctvrtyZari.map((t) => t.hra).sort()).toEqual(['eurojackpot', 'sportka']);
  });

  it('zahodí duplicity, které vznikají překryvem stažených období', () => {
    const serazene = serad([...ej, ...ej, ...ej]);
    expect(serazene).toHaveLength(ej.length);
  });

  it('při duplicitě si nechá poslední záznam', () => {
    const prvni = ej[0]!;
    const upraveny = { ...prvni, vsazenoKc: 42 } as Tah;
    expect(serad([prvni, upraveny])[0]?.vsazenoKc).toBe(42);
  });
});

describe('sestavVystup', () => {
  const tahy = listina('eurojackpot-2026-37');
  const cas = new Date('2026-09-09T06:00:00Z');

  it('nese verzi formátu, aby aplikace poznala starší soubor', () => {
    const vystup = sestavVystup(tahy, [], null, cas);
    expect(vystup.verzeFormatu).toBe(VERZE_FORMATU);
  });

  it('uvádí zdroj a čas vygenerování', () => {
    const vystup = sestavVystup(tahy, [], null, cas);
    expect(vystup.zdroj).toBe('https://www.allwyn.cz/system/vyherka');
    expect(vystup.vygenerovano).toBe('2026-09-09T06:00:00.000Z');
  });

  it('zapisuje období ve tvaru RRRR-TT', () => {
    const vystup = sestavVystup(tahy, [], {
      od: { rok: 2026, tyden: 1 },
      do: { rok: 2026, tyden: 37 },
    }, cas);
    expect(vystup.obdobi).toEqual({ od: '2026-01', do: '2026-37' });
  });

  it('přibaluje sazby Extra 6, protože je listina nepublikuje', () => {
    const sazby = JSON.parse(
      readFileSync(new URL('../../data/sazby-extra6.json', import.meta.url), 'utf8'),
    ).sazby;
    const vystup = sestavVystup(tahy, sazby, null, cas);
    expect(vystup.sazbyExtra6).toHaveLength(1);
    expect(vystup.sazbyExtra6[0]?.sazkaKc).toBe(40);
  });

  it('projde serializací beze ztráty', () => {
    const vystup = sestavVystup(tahy, [], null, cas);
    expect(JSON.parse(JSON.stringify(vystup))).toEqual(vystup);
  });
});
