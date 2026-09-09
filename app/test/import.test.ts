import { describe, expect, it } from 'vitest';
import { VERZE_FORMATU } from '@kontrola-tiketu/jadro';
import { nactiVysledky, shrnutiImportu, type UspesnyImport } from '../src/app/data/import.js';
import { EJ_2026_09_01, EJ_2026_09_08 } from '../../packages/jadro/test/fixtures/eurojackpot.js';
import { SP_2026_09_02 } from '../../packages/jadro/test/fixtures/sportka.js';

function soubor(zmeny: Record<string, unknown> = {}): string {
  return JSON.stringify({
    verzeFormatu: VERZE_FORMATU,
    vygenerovano: '2026-09-09T06:00:00.000Z',
    zdroj: 'https://www.allwyn.cz/system/vyherka',
    obdobi: { od: '2026-35', do: '2026-37' },
    sazbyExtra6: [],
    tahy: [EJ_2026_09_01, SP_2026_09_02, EJ_2026_09_08],
    ...zmeny,
  });
}

describe('nactiVysledky — platný soubor', () => {
  const vysledek = nactiVysledky(soubor());

  it('načte tahy i metadata', () => {
    expect(vysledek.stav).toBe('ok');
    if (vysledek.stav !== 'ok') return;
    expect(vysledek.tahy).toHaveLength(3);
    expect(vysledek.vygenerovano).toBe('2026-09-09T06:00:00.000Z');
    expect(vysledek.obdobi).toEqual({ od: '2026-35', do: '2026-37' });
  });

  it('chybějící sazby Extra 6 nejsou chyba — jádro si s tím poradí', () => {
    const bezSazeb = nactiVysledky(soubor({ sazbyExtra6: undefined }));
    expect(bezSazeb.stav).toBe('ok');
    if (bezSazeb.stav === 'ok') expect(bezSazeb.sazbyExtra6).toEqual([]);
  });

  it('chybějící období nezabrání importu', () => {
    const bezObdobi = nactiVysledky(soubor({ obdobi: undefined }));
    expect(bezObdobi.stav).toBe('ok');
    if (bezObdobi.stav === 'ok') expect(bezObdobi.obdobi).toBeNull();
  });
});

describe('nactiVysledky — vadný soubor', () => {
  const duvod = (text: string) => {
    const v = nactiVysledky(text);
    return v.stav === 'chyba' ? v.duvod : '(prošlo)';
  };

  it('odmítne, co není JSON', () => {
    expect(duvod('tohle není json')).toMatch(/není platný JSON/);
  });

  it('odmítne cizí JSON bez verze formátu', () => {
    expect(duvod('{"neco":"jineho"}')).toMatch(/verzi formátu/);
  });

  it('u starší verze poradí aktualizovat fetcher', () => {
    expect(duvod(soubor({ verzeFormatu: VERZE_FORMATU - 1 }))).toMatch(/starší.*fetcher/s);
  });

  it('u novější verze poradí aktualizovat aplikaci', () => {
    expect(duvod(soubor({ verzeFormatu: VERZE_FORMATU + 1 }))).toMatch(/novější.*aplikaci/s);
  });

  it('odmítne soubor bez tahů', () => {
    expect(duvod(soubor({ tahy: undefined }))).toMatch(/seznam tahů/);
    expect(duvod(soubor({ tahy: [] }))).toMatch(/žádný tah/);
  });

  it('odmítne pole místo objektu', () => {
    expect(duvod('[]')).toMatch(/čekal se objekt/);
  });

  it('pozná tah s neznámou hrou', () => {
    expect(duvod(soubor({ tahy: [{ hra: 'keno', datum: '2026-09-01' }] }))).toMatch(/neznámou hru/);
  });

  it('pozná tah bez tabulky výher — bez ní se nedá spočítat výhra', () => {
    const bezTabulky = { ...EJ_2026_09_01, poradi: [] };
    expect(duvod(soubor({ tahy: [bezTabulky] }))).toMatch(/tabulku výher/);
  });

  it('pozná Sportku bez dvojice tahů', () => {
    const jenJeden = { ...SP_2026_09_02, tahy: [SP_2026_09_02.tahy[0]] };
    expect(duvod(soubor({ tahy: [jenJeden] }))).toMatch(/dva tahy Sportky/);
  });

  it('řekne, který tah je vadný', () => {
    expect(duvod(soubor({ tahy: [EJ_2026_09_01, { hra: 'sportka', datum: 'včera' }] }))).toMatch(
      /Tah č. 2/,
    );
  });
});

describe('shrnutiImportu', () => {
  it('řekne, kolik čeho a za jaké období se načetlo', () => {
    const vysledek = nactiVysledky(soubor()) as UspesnyImport;
    const shrnuti = shrnutiImportu(vysledek);
    expect(shrnuti).toContain('3 tahů');
    expect(shrnuti).toContain('1. 9. 2026');
    expect(shrnuti).toContain('eurojackpot: 2');
    expect(shrnuti).toContain('sportka: 1');
  });
});
