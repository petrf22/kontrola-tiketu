import { describe, expect, it } from 'vitest';
import { VERZE_FORMATU } from '@kontrola-tiketu/jadro';
import { nactiVysledky, shrnutiImportu, type UspesnyImport } from '../src/app/data/import.js';
import { EJ_2026_09_01, EJ_2026_09_08 } from '../knihovny/jadro/test/fixtures/eurojackpot.js';
import { SP_2026_09_02 } from '../knihovny/jadro/test/fixtures/sportka.js';
import { EM_2026_09_08 } from '../knihovny/jadro/test/fixtures/euromiliony.js';

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

  it('přečte Euromiliony i sazby Eurošance', () => {
    const sazba = { platnostOd: '2025-09-05', sazkaKc: 30, vyhryKc: {}, zdroj: 'test' };
    const v = nactiVysledky(soubor({ tahy: [EM_2026_09_08], sazbyEurosance: [sazba] }));
    expect(v.stav).toBe('ok');
    if (v.stav !== 'ok') return;
    expect(v.tahy).toEqual([EM_2026_09_08]);
    expect(v.sazbyEurosance).toEqual([sazba]);
  });

  it('chybějící sazby Eurošance nejsou chyba', () => {
    const v = nactiVysledky(soubor());
    expect(v.stav === 'ok' && v.sazbyEurosance).toEqual([]);
  });

  it('tah hry, kterou aplikace nezná, přeskočí a zbytek přečte', () => {
    // Přibude-li na serveru další hra, aplikace kvůli ní nesmí přestat stahovat.
    const v = nactiVysledky(soubor({ tahy: [EJ_2026_09_01, { hra: 'keno', datum: '2026-09-01', cokoliv: 1 }] }));
    expect(v.stav).toBe('ok');
    if (v.stav === 'ok') expect(v.tahy).toEqual([EJ_2026_09_01]);
  });

  it('přečte ceník, starší balík bez něj a cenu hry, kterou aplikace nezná, přeskočí', () => {
    const cena = { hra: 'sportka', platnostOd: '2024-10-02', sloupecKc: 30, doplnkovaHraKc: 30, zdroj: 'test' };
    const keno = { hra: 'keno', platnostOd: '2024-10-02', sloupecKc: 20, doplnkovaHraKc: null, zdroj: 'test' };
    const v = nactiVysledky(soubor({ ceny: [cena, keno] }));
    expect(v.stav === 'ok' && v.ceny).toEqual([cena]);
    const bez = nactiVysledky(soubor());
    expect(bez.stav === 'ok' && bez.ceny).toEqual([]);
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

  it('u starší verze poradí stáhnout aktuální balík', () => {
    expect(duvod(soubor({ verzeFormatu: VERZE_FORMATU - 1 }))).toMatch(/starší.*aktuální balík/s);
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

  it('pozná tah bez uvedené hry', () => {
    expect(duvod(soubor({ tahy: [{ datum: '2026-09-01' }] }))).toMatch(/nemá uvedenou hru/);
  });

  it('pozná Euromiliony bez Eurošance', () => {
    const { eurosance, ...bezEurosance } = EM_2026_09_08;
    expect(duvod(soubor({ tahy: [bezEurosance] }))).toMatch(/Eurošanci/);
  });

  it('pozná tah, kterému pole s tabulkou výher úplně chybí', () => {
    const { poradi, ...bezPole } = EJ_2026_09_01;
    expect(duvod(soubor({ tahy: [bezPole] }))).toMatch(/tabulku výher/);
  });

  it('prázdnou tabulku přijme — u starších tahů ji Allwyn nezveřejnil', () => {
    // Vyhodnocení pak řekne „pořadí znám, částku ne“ místo aby tah zmizel.
    const bezTabulky = { ...EJ_2026_09_01, poradi: [] };
    expect(nactiVysledky(soubor({ tahy: [bezTabulky] })).stav).toBe('ok');
  });

  it('pozná Sportku bez dvojice tahů', () => {
    const jenJeden = { ...SP_2026_09_02, tahy: [SP_2026_09_02.tahy[0]] };
    expect(duvod(soubor({ tahy: [jenJeden] }))).toMatch(/dva tahy Sportky/);
  });

  it('odmítne ceník s neplatnou cenou — zkreslil by bilanci', () => {
    const cena = { hra: 'sportka', platnostOd: '2024-10-02', sloupecKc: 30, doplnkovaHraKc: null, zdroj: 'test' };
    expect(duvod(soubor({ ceny: [cena, { ...cena, sloupecKc: '30' }] }))).toBe('Cena č. 2 nemá kladnou cenu sloupce.');
    expect(duvod(soubor({ ceny: [{ ...cena, platnostOd: '2. 10. 2024' }] }))).toContain('platnostOd');
    expect(duvod(soubor({ ceny: [{ ...cena, doplnkovaHraKc: 0 }] }))).toContain('doplňkové hry');
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
