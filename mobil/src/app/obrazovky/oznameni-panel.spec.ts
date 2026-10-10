import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { type Tiket, vyhodnotTiket } from '@kontrola-tiketu/jadro';
import { EJ_2026_09_08 } from '../../../knihovny/jadro/test/fixtures/eurojackpot';
import { Stav } from '../data/stav';
import { Oznameni } from '../data/oznameni';
import { OznameniPanel } from './oznameni-panel';
import { Dialogy } from './dialog';

@Component({ template: '' })
class Prazdna {}
const tiket: Tiket = {
  id: 'test', hra: 'eurojackpot', sloupce: [{ hra: 'eurojackpot', cisla: [47, 14, 27, 34, 1], eurocisla: [4, 1] }],
  slosovani: { prvni: '2026-09-08', pocet: 1, dny: null }, kodDoplnkoveHry: null, cenaKc: null, vlozeno: '2026-09-08T12:00:00Z',
};

describe('Zobrazení nových výsledků', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', component: Prazdna }])] });
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });
  afterEach(() => { TestBed.resetTestingModule(); vi.restoreAllMocks(); });

  async function priprav(cesta = '/') {
    await TestBed.inject(Router).navigateByUrl(cesta);
    const stav = TestBed.inject(Stav);
    stav.tikety.set([tiket]);
    stav.nacteno.set(true);
    await stav.oznameni.nacti(new Map());
    const f = TestBed.createComponent(OznameniPanel);
    await f.whenStable();
    const dialog = f.nativeElement.querySelector('dialog') as HTMLDialogElement;
    dialog.showModal = () => { dialog.open = true; };
    dialog.close = () => { dialog.open = false; };
    return f;
  }
  async function vyhra() {
    await TestBed.inject(Oznameni).aktualizuj(new Map(), new Map([[tiket.id, vyhodnotTiket(tiket, [EJ_2026_09_08], [], [])]]));
  }
  async function vykresli(f: ReturnType<typeof TestBed.createComponent<OznameniPanel>>) {
    await f.whenStable();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await f.whenStable();
  }
  it('otevře výhru, Zpět ji odloží a během stejného spuštění znovu neotevře', async () => {
    const f = await priprav();
    await vyhra(); await vykresli(f);
    const dialog = f.nativeElement.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    expect(dialog.textContent).toContain('Výhra');
    TestBed.inject(Dialogy).zpet();
    await vykresli(f);
    expect(dialog.open).toBe(false);
    expect(TestBed.inject(Oznameni).neprectene()).toHaveLength(1);
    await TestBed.inject(Router).navigateByUrl('/prehled');
    await vykresli(f);
    expect(dialog.open).toBe(false);
  });

  it('odloží výhru při zadávání a úpravě, pak ji zobrazí', async () => {
    const f = await priprav('/tiket/novy');
    // Formulář i detail v úpravě to hlásí přes Dialogy.upravuje, panel trasy nezná.
    TestBed.inject(Dialogy).upravuje.set(true);
    await vyhra(); await vykresli(f);
    const dialog = f.nativeElement.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.open).toBe(false);
    await TestBed.inject(Router).navigateByUrl('/tiket/test');
    await vykresli(f);
    expect(dialog.open).toBe(false);
    TestBed.inject(Dialogy).upravuje.set(false);
    await vykresli(f);
    expect(dialog.open).toBe(true);
  });

  it('režim panelu ani výsledek bez výhry dialog neotevřou', async () => {
    const f = await priprav();
    await TestBed.inject(Oznameni).nastavDialog(false);
    await vyhra(); await vykresli(f);
    expect(f.nativeElement.querySelector('dialog').open).toBe(false);
    expect(f.nativeElement.querySelector('.panel').textContent).toContain('výhra');
    const o = TestBed.inject(Oznameni);
    await o.potvrdit(o.neprectene().map(p => p.id));
    await o.nastavDialog(true);
    const bezVyhry: Tiket = { ...tiket, id: 'bez-vyhry', sloupce: [{ hra: 'eurojackpot', cisla: [1, 2, 3, 5, 6], eurocisla: [1, 2] }] };
    await o.aktualizuj(new Map(), new Map([[bezVyhry.id, vyhodnotTiket(bezVyhry, [EJ_2026_09_08], [], [])]]));
    await vykresli(f);
    expect(f.nativeElement.querySelector('dialog').open).toBe(false);
    expect(f.nativeElement.querySelector('.panel').textContent).toContain('Nové výsledky tiketů');
  });

  it('potvrzení dialogu odstraní zobrazené položky', async () => {
    const f = await priprav();
    await vyhra(); await vykresli(f);
    const button = [...f.nativeElement.querySelectorAll('dialog button')].find((b: any) => b.textContent.trim() === 'Rozumím') as HTMLButtonElement;
    button.click(); await vykresli(f);
    expect(TestBed.inject(Oznameni).neprectene()).toEqual([]);
    expect(f.nativeElement.querySelector('dialog').open).toBe(false);
  });

  it('varování o neúspěšném stažení jde zavřít a další neúspěch ho vrátí', async () => {
    const f = await priprav();
    const stav = TestBed.inject(Stav);
    const varovani = () => f.nativeElement.querySelector('.varovani') as HTMLElement | null;
    stav.posledniStazeni.set({ uspech: false, zprava: 'offline' });
    await vykresli(f);
    const zavrit = [...varovani()!.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Zavřít')!;
    zavrit.click(); await vykresli(f);
    expect(varovani()).toBeNull();
    stav.posledniStazeni.set({ uspech: false, zprava: 'offline' });
    await vykresli(f);
    expect(varovani()).not.toBeNull();
  });
});
