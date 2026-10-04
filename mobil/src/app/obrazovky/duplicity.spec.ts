import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { CenikHry, Tiket } from '@kontrola-tiketu/jadro';
import { EJ_2026_09_04, EJ_2026_09_08 } from '../../../knihovny/jadro/test/fixtures/eurojackpot';
import { Detail } from './detail';
import { NovyTiket } from './novy-tiket';
import { DuplicitniTiket, Stav } from '../data/stav';
import { ULOZISTE } from '../data/tokeny';
import { UlozisteVPameti } from '../data/uloziste';

// Ceník z test/fixtures/vysledky-2026-35-az-37.json.
const CENY: CenikHry[] = [{ hra: 'eurojackpot', platnostOd: '2014-10-10', sloupecKc: 60, doplnkovaHraKc: 40, zdroj: 'fixtura' }];

/** Uložený první sken: přečetl jen jedno slosování a čárový kód ne. */
const prvniSken: Tiket = {
  id: 'rucni-prvni', nazev: 'práce', hra: 'eurojackpot',
  sloupce: [{ hra: 'eurojackpot', cisla: [47, 14, 27, 34, 1], eurocisla: [4, 1] }],
  slosovani: { prvni: '2026-09-04', pocet: 1, dny: null }, kodDoplnkoveHry: null, cenaKc: null, vlozeno: '2026-09-04T12:00:00Z',
};

async function klikni<T>(f: ComponentFixture<T>, text: string) {
  const button = [...(f.nativeElement as HTMLElement).querySelectorAll('button')].find(b => b.textContent?.trim() === text);
  expect(button, text).toBeDefined();
  button!.click();
  await f.whenStable();
}

function vypln(f: ComponentFixture<unknown>, selektor: string, hodnota: string) {
  const pole = (f.nativeElement as HTMLElement).querySelector(selektor) as HTMLInputElement;
  expect(pole, selektor).not.toBeNull();
  pole.value = hodnota;
  pole.dispatchEvent(new Event('input', { bubbles: true }));
}

const text = (f: ComponentFixture<unknown>) => ((f.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');

describe('Duplicitní tikety a cena', () => {
  let stav: Stav;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: ULOZISTE, useClass: UlozisteVPameti }] });
    stav = TestBed.inject(Stav);
    stav.tahy.set([EJ_2026_09_04, EJ_2026_09_08]);
    stav.ceny.set(CENY);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  async function formular(prvni: string, pocet: number) {
    const f = TestBed.createComponent(NovyTiket);
    await f.whenStable();
    vypln(f, '[data-cesta="slosovani.prvni"]', prvni);
    vypln(f, '[data-cesta="slosovani.pocet"]', String(pocet));
    vypln(f, '.sloupec input:not(.euro)', '1 14 27 34 47');
    vypln(f, '.sloupec .euro', '1 4');
    await f.whenStable();
    return f;
  }

  it('Stav duplicitu neuloží, s nahrazením ano a název převezme', async () => {
    await stav.ulozTiket(prvniSken);
    const uplny: Tiket = { ...prvniSken, id: 'serie-123', nazev: undefined, slosovani: { ...prvniSken.slosovani, pocet: 2 } };
    await expect(stav.ulozTiket(uplny)).rejects.toBeInstanceOf(DuplicitniTiket);
    expect(stav.tikety().map(t => t.id)).toEqual(['rucni-prvni']);
    await stav.ulozTiket(uplny, { nahradit: ['rucni-prvni'] });
    expect(stav.tikety().map(t => [t.id, t.nazev, t.slosovani.pocet])).toEqual([['serie-123', 'práce', 2]]);
  });

  it('formulář duplicitu ukáže, neuloží ji a nabídne nahrazení', async () => {
    await stav.ulozTiket(prvniSken);
    const f = await formular('2026-09-04', 2);
    expect(text(f)).toContain('Tento tiket už je uložený.');
    await klikni(f, 'Zkontrolovat tiket');
    expect(stav.tikety().map(t => t.id)).toEqual(['rucni-prvni']);
    expect(f.nativeElement.querySelector('[role=alert]').textContent).toContain('stejný tiket už je uložený');
    await klikni(f, 'Nahradit uložený tiket');
    expect(stav.tikety()).toHaveLength(1);
    expect(stav.tikety()[0]).toMatchObject({ nazev: 'práce', slosovani: { pocet: 2 } });
  });

  it('jiné slosování duplicitou není', async () => {
    await stav.ulozTiket(prvniSken);
    const f = await formular('2026-09-08', 1);
    expect(text(f)).not.toContain('Tento tiket už je uložený.');
    await klikni(f, 'Zkontrolovat tiket');
    expect(stav.tikety()).toHaveLength(2);
  });

  it('cena z ceníku se neuloží napevno', async () => {
    const f = await formular('2026-09-04', 2);
    expect((f.nativeElement.querySelector('[data-cesta="cenaKc"]') as HTMLInputElement).value).toBe('120');
    await klikni(f, 'Zkontrolovat tiket');
    expect(stav.tikety()[0]!.cenaKc).toBeNull();
    expect(stav.vysledky().get(stav.tikety()[0]!.id)!.vsazenoKc).toBe(120);
  });

  it('detail u nesedící ceny ukáže rozpis, odhadne počet slosování a umí použít ceník', async () => {
    // Vytištěných 120 Kč, ale přečtené jen jedno slosování.
    await stav.ulozTiket({ ...prvniSken, cenaKc: 120 });
    const f = TestBed.createComponent(Detail);
    f.componentRef.setInput('id', prvniSken.id);
    await f.whenStable();
    expect(text(f)).toContain('nesedí s ceníkem');
    expect(text(f)).toContain('Cena vychází na 2 slosování');
    expect(f.nativeElement.querySelector('.duplicita')).toBeNull();
    await klikni(f, 'Použít cenu podle ceníku');
    expect(stav.tikety()[0]!.cenaKc).toBeNull();
    expect(text(f)).not.toContain('nesedí s ceníkem');
  });

  it('detail i seznam označí duplicitu ze starší verze', async () => {
    const uloziste = TestBed.inject(ULOZISTE);
    await uloziste.ulozTiket({ ...prvniSken, archivovany: false });
    await uloziste.ulozTiket({ ...prvniSken, id: 'druhy', nazev: null, archivovany: false, slosovani: { ...prvniSken.slosovani, pocet: 2 } });
    await stav.nacti();
    stav.tahy.set([EJ_2026_09_04, EJ_2026_09_08]);
    const f = TestBed.createComponent(Detail);
    f.componentRef.setInput('id', 'druhy');
    await f.whenStable();
    expect(text(f)).toContain('Duplicitní tiket.');
    expect(f.nativeElement.querySelector('.duplicita a').textContent).toBe('práce');
    // Přejmenovat se dá i tiket, který duplicitu už má.
    await stav.ulozTiket({ ...stav.tikety().find(t => t.id === 'druhy')!, nazev: 'kolega' });
    expect(stav.tikety().find(t => t.id === 'druhy')!.nazev).toBe('kolega');
  });
});
