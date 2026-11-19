import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { type Tiket } from '@kontrola-tiketu/jadro';
import { EJ_2026_09_08 } from '../../../knihovny/jadro/test/fixtures/eurojackpot';
import { prectiTiket } from '@kontrola-tiketu/ocr';
import { tiketEJ } from '../../../knihovny/ocr/test/pomocnici';
import { Stav } from '../data/stav';
import { ULOZISTE } from '../data/tokeny';
import { UlozisteVPameti } from '../data/uloziste';
import { formatujKc } from '../data/format';
import { klicNazvu } from '../data/nazvyTiketu';
import { NactenaCisla, NaskenovanyTiket } from '../data/sken';
import { Detail } from './detail';
import { NovyTiket } from './novy-tiket';
import { Prehled } from './prehled';
import { Seznam } from './seznam';

// Výherní sloupec z tahu 8. 9. 2026 (4+1, částka je v listině), cena podle ceníku z fixtury.
const tiket: Tiket = {
  id: 'ej', hra: 'eurojackpot', nazev: 'Práce',
  sloupce: [{ hra: 'eurojackpot', cisla: [47, 14, 27, 34, 1], eurocisla: [4, 1] }],
  slosovani: { prvni: EJ_2026_09_08.datum, pocet: 1, dny: null },
  kodDoplnkoveHry: null, cenaKc: null, vlozeno: '2026-09-08T12:00:00Z',
};

async function klikni<T>(f: ComponentFixture<T>, text: string) {
  const tlacitko = [...(f.nativeElement as HTMLElement).querySelectorAll('button')].find(b => b.textContent?.trim() === text);
  expect(tlacitko, text).toBeDefined();
  tlacitko!.click();
  await f.whenStable();
}

async function vypln<T>(f: ComponentFixture<T>, selektor: string, hodnota: string, udalost = 'input') {
  const pole = f.nativeElement.querySelector(selektor) as HTMLInputElement;
  expect(pole).not.toBeNull();
  pole.value = hodnota;
  pole.dispatchEvent(new Event(udalost, { bubbles: true }));
  await f.whenStable();
}

describe('Skupinové sázení', () => {
  let stav: Stav;
  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: ULOZISTE, useClass: UlozisteVPameti }] });
    stav = TestBed.inject(Stav);
    await TestBed.inject(ULOZISTE).ulozCeny([
      { hra: 'eurojackpot', platnostOd: '2014-10-10', sloupecKc: 60, doplnkovaHraKc: 40, zdroj: 'fixtura' },
    ]);
    await TestBed.inject(ULOZISTE).ulozTahy([EJ_2026_09_08]);
    await stav.nacti();
  });

  /** `shodne`: stejné sloupce jako `tiket`, takže uložení vyvolá duplicitu. */
  function naskenuj(id: string, shodne = false) {
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    TestBed.inject(NactenaCisla).uloz(prectiTiket(tiketEJ([
      ['SLOSOVÁNÍ: 1 (ÚT)', '08.09.2026'],
      shodne ? ['1: 01 14 27 34 47', '01 04 NT'] : ['1: 23 30 33 37 47', '02 03 NT'],
    ]), 'eurojackpot'), ['hlavička']);
    TestBed.inject(NaskenovanyTiket).uloz(id, 'eurojackpot');
  }

  it('skupina se uloží, přežije načtení a jeden člen ji smaže', async () => {
    await stav.ulozSkupinu('  Práce ', 5);
    await stav.nacti();
    expect(stav.skupiny()).toEqual({ [klicNazvu('práce')]: 5 });
    await stav.ulozSkupinu('PRÁCE', 1);
    await stav.nacti();
    expect(stav.skupiny()).toEqual({});
    await stav.ulozSkupinu(null, 5);
    await stav.ulozSkupinu('x', 2.5);
    expect(stav.skupiny()).toEqual({});
  });

  it('poškozené nastavení skupin se zahodí', async () => {
    await TestBed.inject(ULOZISTE).ulozNastaveni('skupiny', { a: 5, b: 'x', c: 1, d: -3 });
    await stav.nacti();
    expect(stav.skupiny()).toEqual({ a: 5 });
  });

  it('nový tiket: počet členů se uloží k tiketu i ke skupině a příště se předvyplní podle názvu', async () => {
    naskenuj('prvni');
    let f = TestBed.createComponent(NovyTiket);
    await f.whenStable();
    expect(f.nativeElement.querySelector('input[name=clenu]').value).toBe('');
    await vypln(f, 'input[name=nazev]', 'Práce');
    await vypln(f, 'input[name=clenu]', '5');
    await klikni(f, 'Zkontrolovat tiket');
    expect(stav.tikety().find(t => t.id === 'prvni')?.clenu).toBe(5);
    expect(stav.skupiny()[klicNazvu('práce')]).toBe(5);

    f.destroy();
    naskenuj('druhy');
    f = TestBed.createComponent(NovyTiket);
    await f.whenStable();
    await vypln(f, 'input[name=nazev]', 'práce');
    expect(f.nativeElement.querySelector('input[name=clenu]').value).toBe('5');
    // Ruční přepis má přednost a další změna názvu ho už nepřepíše.
    await vypln(f, 'input[name=clenu]', '3');
    await vypln(f, 'input[name=nazev]', 'Práce ');
    expect(f.nativeElement.querySelector('input[name=clenu]').value).toBe('3');
  });

  it('tiket bez skupiny nemá clenu a zrušením počtu se skupina smaže', async () => {
    await stav.ulozSkupinu('Práce', 5);
    naskenuj('novy');
    const f = TestBed.createComponent(NovyTiket);
    await f.whenStable();
    await vypln(f, 'input[name=nazev]', 'Práce');
    await vypln(f, 'input[name=clenu]', '1');
    await klikni(f, 'Zkontrolovat tiket');
    expect(stav.tikety().find(t => t.id === 'novy')?.clenu).toBeUndefined();
    expect(stav.skupiny()).toEqual({});
  });

  it('detail: úprava počtu členů ukáže vklad, výhru a bilanci na jednoho', async () => {
    await stav.ulozTiket(tiket);
    const f = TestBed.createComponent(Detail);
    f.componentRef.setInput('id', tiket.id);
    await f.whenStable();
    expect(f.nativeElement.querySelector('[data-test=na-jednoho]')).toBeNull();
    await klikni(f, 'Pojmenovat tiket');
    await vypln(f, 'input[name=clenu]', '5');
    await klikni(f, 'Uložit název');

    const v = stav.vysledky().get(tiket.id)!;
    expect(stav.tikety()[0]?.clenu).toBe(5);
    expect(stav.skupiny()[klicNazvu('Práce')]).toBe(5);
    const text = f.nativeElement.querySelector('[data-test=na-jednoho]').textContent.replace(/\s/g, ' ');
    expect(text.replace(/ /g, ' ')).toContain(formatujKc(v.vsazenoKc! / 5).replace(/ /g, ' '));
    expect(f.nativeElement.querySelector('[data-test=clenove]').textContent).toContain('5 členů');

    // Vynechání počtu znamená „sázím sám“; původní hodnota se nedědí.
    await klikni(f, 'Pojmenovat tiket');
    await vypln(f, 'input[name=clenu]', '');
    await klikni(f, 'Uložit název');
    expect(stav.tikety()[0]?.clenu).toBeUndefined();
    expect(f.nativeElement.querySelector('[data-test=na-jednoho]')).toBeNull();
  });

  it('seznam ukáže počet členů a bilanci na jednoho', async () => {
    await stav.ulozTiket({ ...tiket, clenu: 5 });
    await stav.ulozSkupinu('Práce', 5);
    const f = TestBed.createComponent(Seznam);
    await f.whenStable();
    const v = stav.vysledky().get(tiket.id)!;
    const text = (f.nativeElement as HTMLElement).textContent!.replace(/ /g, ' ');
    expect(text).toContain('5 členů');
    expect(text).toContain(`Na jednoho: ${v.bilanceKc! > 0 ? '+' : ''}${formatujKc(v.bilanceKc! / 5)}`.replace(/ /g, ' '));
  });

  it('přehled: skupina a celek mají podíl na jednoho, bez skupinových tiketů se neukazuje', async () => {
    await stav.ulozTiket(tiket);
    let f = TestBed.createComponent(Prehled);
    await f.whenStable();
    expect(f.nativeElement.querySelector('[data-test=muj-podil]')).toBeNull();
    expect(f.nativeElement.querySelector('[data-test=na-jednoho]')).toBeNull();
    f.destroy();

    await stav.ulozTiket({ ...tiket, clenu: 5 });
    f = TestBed.createComponent(Prehled);
    await f.whenStable();
    const v = stav.vysledky().get(tiket.id)!;
    const podil = (f.nativeElement.querySelector('[data-test=muj-podil]') as HTMLElement).textContent!.replace(/ /g, ' ');
    expect(podil).toContain(formatujKc(v.vsazenoKc! / 5).replace(/ /g, ' '));
    expect(podil).toContain(formatujKc(v.celkemKc / 5).replace(/ /g, ' '));
    expect(f.nativeElement.querySelector('.skupiny-nazvu [data-test=na-jednoho]')).not.toBeNull();
    expect(f.nativeElement.querySelector('.skupiny-nazvu .pocet').textContent).toContain('5');
  });

  describe('ochrana historických počtů členů (review)', () => {
    it('opakovaný sken uloženého tiketu zachová jeho počet, i když je výchozí jiný', async () => {
      await stav.ulozTiket({ ...tiket, id: 'puvodni', clenu: 5 });
      await stav.ulozSkupinu('Práce', 3);
      naskenuj('puvodni');
      const f = TestBed.createComponent(NovyTiket);
      await f.whenStable();
      expect(f.nativeElement.querySelector('input[name=clenu]').value).toBe('5');
      await klikni(f, 'Zkontrolovat tiket');
      expect(stav.tikety().find(t => t.id === 'puvodni')?.clenu).toBe(5);
      expect(stav.skupiny()[klicNazvu('Práce')]).toBe(3);
    });

    it('opakovaný sken samostatné sázky nepředvyplní výchozí počet skupiny', async () => {
      await stav.ulozTiket({ ...tiket, id: 'sam' });
      await stav.ulozSkupinu('Práce', 3);
      naskenuj('sam');
      const f = TestBed.createComponent(NovyTiket);
      await f.whenStable();
      expect(f.nativeElement.querySelector('input[name=clenu]').value).toBe('');
      await klikni(f, 'Zkontrolovat tiket');
      expect(stav.tikety().find(t => t.id === 'sam')?.clenu).toBeUndefined();
    });

    it('stav: počet členů se bez výslovné žádosti nezdědí, s ní ano', async () => {
      await stav.ulozTiket({ ...tiket, clenu: 5 });
      const { clenu: _, ...bezClenu } = tiket;
      await stav.ulozTiket(bezClenu);
      expect(stav.tikety()[0]?.clenu).toBeUndefined();
      await stav.ulozTiket({ ...tiket, clenu: 5 });
      await stav.ulozTiket(bezClenu, { zdeditClenu: true });
      expect(stav.tikety()[0]?.clenu).toBe(5);
    });

    it('nahrazení duplicity s výslovnou jedničkou neřídí zděděný počet', async () => {
      await stav.ulozTiket({ ...tiket, id: 'stary-sken', clenu: 5 });
      naskenuj('novy-sken', true);
      const f = TestBed.createComponent(NovyTiket);
      await f.whenStable();
      await vypln(f, 'input[name=nazev]', 'Práce');
      await vypln(f, 'input[name=clenu]', '1');
      await klikni(f, 'Zkontrolovat tiket');
      await klikni(f, 'Nahradit uložený tiket');
      expect(stav.tikety().map(t => t.id)).toEqual(['novy-sken']);
      expect(stav.tikety()[0]?.clenu).toBeUndefined();
    });

    it('nahrazení duplicity s neplatným počtem nic nesmaže', async () => {
      await stav.ulozTiket({ ...tiket, id: 'stary-sken', clenu: 5 });
      naskenuj('novy-sken', true);
      const f = TestBed.createComponent(NovyTiket);
      await f.whenStable();
      await klikni(f, 'Zkontrolovat tiket');
      for (const spatne of ['100', '2.5']) {
        await vypln(f, 'input[name=clenu]', spatne);
        expect(f.nativeElement.querySelector('#chyba-clenu').textContent).toContain('celé číslo');
        await klikni(f, 'Nahradit uložený tiket');
        expect(stav.tikety().map(t => t.id)).toEqual(['stary-sken']);
        expect(stav.tikety()[0]?.clenu).toBe(5);
      }
    });

    it('detail: oprava názvu bez zásahu do počtu nepřepíše výchozí počet skupiny', async () => {
      await stav.ulozTiket({ ...tiket, clenu: 5 });
      await stav.ulozSkupinu('Práce', 3);
      const f = TestBed.createComponent(Detail);
      f.componentRef.setInput('id', tiket.id);
      await f.whenStable();
      await klikni(f, 'Pojmenovat tiket');
      await vypln(f, 'input[name=nazev]', 'práce');
      await klikni(f, 'Uložit název');
      expect(stav.tikety()[0]?.clenu).toBe(5);
      expect(stav.skupiny()[klicNazvu('práce')]).toBe(3);
      // Vědomá změna počtu výchozí hodnotu přepíše.
      await klikni(f, 'Pojmenovat tiket');
      await vypln(f, 'input[name=clenu]', '4');
      await klikni(f, 'Uložit název');
      expect(stav.skupiny()[klicNazvu('práce')]).toBe(4);
    });

    it('záhlaví skupiny v seznamu čte počet z tiketů, ne výchozí počet skupiny', async () => {
      await stav.ulozTiket({ ...tiket, clenu: 5, archivovany: true });
      await stav.ulozSkupinu('Práce', 3);
      const f = TestBed.createComponent(Seznam);
      await f.whenStable();
      await klikni(f, 'Archiv');
      const zahlavi = (f.nativeElement.querySelector('.nazev-skupiny') as HTMLElement).textContent!.replace(/\u00a0/g, ' ');
      expect(zahlavi).toContain('5 členů');
      expect(zahlavi).not.toContain('3 členů');
    });
  });

  it('virtuální tiket se skupinou ukáže podíl na jednoho přes celý rozsah', async () => {
    const virtualni: Tiket = {
      ...tiket, id: 'virt', clenu: 5,
      kontrola: { od: EJ_2026_09_08.datum, do: EJ_2026_09_08.datum, cenaZaSlosovaniKc: 400 },
    };
    await stav.ulozTiket(virtualni);
    const f = TestBed.createComponent(Detail);
    f.componentRef.setInput('id', 'virt');
    await f.whenStable();
    const v = stav.vysledky().get('virt')!;
    expect(v.vsazenoKc).toBe(400);
    const text = (f.nativeElement.querySelector('[data-test=na-jednoho]') as HTMLElement).textContent!.replace(/\u00a0/g, ' ');
    expect(text).toContain(formatujKc(400 / 5).replace(/\u00a0/g, ' '));
    expect(text).toContain(formatujKc(v.celkemKc / 5).replace(/\u00a0/g, ' '));
  });
});
