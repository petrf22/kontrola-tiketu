import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { Tiket } from '@kontrola-tiketu/jadro';
import { EJ_2026_09_04, EJ_2026_09_08 } from '../../../knihovny/jadro/test/fixtures/eurojackpot';
import { Detail } from './detail';
import { NovyTiket } from './novy-tiket';
import { DocasnyTiket } from '../data/docasnyTiket';
import { Stav } from '../data/stav';
import { ULOZISTE } from '../data/tokeny';
import { UlozisteVPameti } from '../data/uloziste';
import { formatujDatum, formatujKc, pocetSlosovani } from '../data/format';

const tiket: Tiket = {
  id: 'cizi', hra: 'eurojackpot', sloupce: [{ hra: 'eurojackpot', cisla: [47, 14, 27, 34, 1], eurocisla: [4, 1] }],
  slosovani: { prvni: '2026-09-08', pocet: 1, dny: null }, kodDoplnkoveHry: null, cenaKc: null, vlozeno: '2026-09-08T12:00:00Z',
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

const text = (f: ComponentFixture<unknown>) => (f.nativeElement as HTMLElement).textContent ?? '';

describe('Kontrola bez uložení', () => {
  let stav: Stav;
  let navigate: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: ULOZISTE, useClass: UlozisteVPameti }] });
    stav = TestBed.inject(Stav);
    stav.tahy.set([EJ_2026_09_04, EJ_2026_09_08]);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 20, 12));
  });
  afterEach(() => vi.useRealTimers());

  /** Formulář vyplněný tiketem z testu; `jenKontrola` přepne volbu nad tlačítkem. */
  async function formular(prvni: string, pocet: number, jenKontrola = true) {
    const f = TestBed.createComponent(NovyTiket);
    await f.whenStable();
    vypln(f, '[data-cesta="slosovani.prvni"]', prvni);
    vypln(f, '[data-cesta="slosovani.pocet"]', String(pocet));
    vypln(f, '.sloupec input:not(.euro)', '47 14 27 34 1');
    vypln(f, '.sloupec .euro', '4 1');
    if (jenKontrola) (f.nativeElement.querySelectorAll('input[name=ulozeni]')[1] as HTMLInputElement).click();
    await f.whenStable();
    return f;
  }

  it('výchozí volba je uložení mezi mé tikety', async () => {
    const f = await formular('2026-09-08', 1, false);
    const volby = f.nativeElement.querySelectorAll('input[name=ulozeni]') as NodeListOf<HTMLInputElement>;
    expect(volby[0]!.checked).toBe(true);
    expect(volby[1]!.checked).toBe(false);
    await klikni(f, 'Zkontrolovat tiket');
    expect(stav.tikety()).toHaveLength(1);
    expect(navigate.mock.calls[0]![0]).toEqual(['/tiket', stav.tikety()[0]!.id]);
  });

  it('vylosovaný tiket zkontroluje bez uložení a přejde na výsledek místo formuláře', async () => {
    const f = await formular('2026-09-08', 1);
    expect(text(f)).toContain('Tiket se neuloží');
    expect(f.nativeElement.querySelector('app-nazev-tiketu')).toBeNull();
    const uloz = vi.spyOn(stav, 'ulozTiket');
    await klikni(f, 'Zkontrolovat tiket');
    expect(uloz).not.toHaveBeenCalled();
    expect(stav.tikety()).toHaveLength(0);
    expect(navigate).toHaveBeenCalledWith(['/kontrola'], { replaceUrl: true });
    expect(TestBed.inject(DocasnyTiket).tiket()?.sloupce[0]?.cisla).toEqual([47, 14, 27, 34, 1]);
  });

  it('tiket před slosováním nezkontroluje a upozorní, že by se zapomněl', async () => {
    const f = await formular('2026-09-22', 1);
    expect(f.nativeElement.querySelector('.nelze-zkontrolovat').textContent).toContain('ještě nebyl slosován');
    await klikni(f, 'Zkontrolovat tiket');
    expect(navigate).not.toHaveBeenCalled();
    expect(TestBed.inject(DocasnyTiket).tiket()).toBeNull();
  });

  it('proběhlé slosování bez stažených výsledků odkáže na aktualizaci', async () => {
    const f = await formular('2026-09-15', 1);
    const upozorneni = f.nativeElement.querySelector('.nelze-zkontrolovat') as HTMLElement;
    expect(upozorneni.textContent).toContain('zatím nejsou');
    expect(upozorneni.querySelector('a')?.textContent).toContain('Aktualizovat výsledky');
    await klikni(f, 'Zkontrolovat tiket');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('částečně vylosovaný tiket zkontroluje s varováním', async () => {
    const f = await formular('2026-09-08', 2);
    expect(text(f)).toContain(`Zkontroluje se 1 z ${pocetSlosovani(2)}`);
    await klikni(f, 'Zkontrolovat tiket');
    expect(navigate).toHaveBeenCalledWith(['/kontrola'], { replaceUrl: true });
  });

  it('za období od–do zkontroluje všechna slosování v rozsahu', async () => {
    const f = await formular('2026-09-08', 1);
    expect(f.nativeElement.querySelector('details:has(.rozsah)').open).toBe(true);
    vypln(f, '[data-cesta="kontrola.od"]', '2026-09-04');
    // Jedno slosování předvyplní jen svůj den (úterý); páteční tah se musí přidat.
    (f.nativeElement.querySelector('input[name=dny][value=pa]') as HTMLInputElement).click();
    await f.whenStable();
    expect(f.nativeElement.querySelector('.upozorneni')).toBeNull();
    await klikni(f, 'Zkontrolovat tiket');
    const docasny = TestBed.inject(DocasnyTiket).tiket()!;
    expect(docasny.kontrola).toEqual({ od: '2026-09-04', do: '2026-09-08', cenaZaSlosovaniKc: null });
    expect(stav.vyhodnot(docasny).slosovani.map(s => s.datum)).toEqual(['2026-09-04', '2026-09-08']);
  });

  it('rozsah bez konce upozorní, že se kontroluje jen do posledního staženého losování', async () => {
    const f = await formular('2026-09-08', 1);
    vypln(f, '[data-cesta="kontrola.do"]', '');
    await f.whenStable();
    expect(text(f)).toContain(`do posledního staženého losování (${formatujDatum('2026-09-08')})`);
  });

  describe('výsledek', () => {
    async function vysledek() {
      TestBed.inject(DocasnyTiket).uloz(tiket);
      const f = TestBed.createComponent(Detail);
      f.componentRef.setInput('docasny', true);
      await f.whenStable();
      return f;
    }

    it('ukáže vyhodnocení a upozornění, odchodem tiket zapomene', async () => {
      const f = await vysledek();
      expect(text(f)).toContain('Odchodem z této obrazovky se tiket i vsazená čísla odstraní');
      expect(text(f)).not.toContain('Akce tiketu');
      expect(f.nativeElement.querySelector('.souhrn-tiketu').textContent)
        .toContain(formatujKc(stav.vyhodnot(tiket).celkemKc));
      f.destroy();
      expect(TestBed.inject(DocasnyTiket).tiket()).toBeNull();
      expect(stav.tikety()).toHaveLength(0);
    });

    it('„Přesto uložit“ tiket uloží a přejde na jeho detail', async () => {
      const f = await vysledek();
      await klikni(f, 'Přesto uložit mezi mé tikety');
      expect(stav.tikety().map(t => t.id)).toEqual([tiket.id]);
      expect(TestBed.inject(DocasnyTiket).tiket()).toBeNull();
      expect(navigate).toHaveBeenCalledWith(['/tiket', tiket.id], { replaceUrl: true });
    });

    it('bez tiketu v paměti řekne, že už byl zapomenut', async () => {
      const f = TestBed.createComponent(Detail);
      f.componentRef.setInput('docasny', true);
      await f.whenStable();
      expect(text(f)).toContain('už byl zapomenut');
    });
  });
});
