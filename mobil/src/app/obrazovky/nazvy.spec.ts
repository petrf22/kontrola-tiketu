import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { type Tiket } from '@kontrola-tiketu/jadro';
import { EJ_2026_09_08 } from '../../../knihovny/jadro/test/fixtures/eurojackpot';
import { SP_2026_09_02 } from '../../../knihovny/jadro/test/fixtures/sportka';
import { EM_2026_09_01 } from '../../../knihovny/jadro/test/fixtures/euromiliony';
import { Stav } from '../data/stav';
import { ULOZISTE } from '../data/tokeny';
import { UlozisteVPameti } from '../data/uloziste';
import { formatujKc } from '../data/format';
import { klicNazvu } from '../data/nazvyTiketu';
import { NactenaCisla, NaskenovanyTiket } from '../data/sken';
import { prectiTiket } from '@kontrola-tiketu/ocr';
import { tiketEJ } from '../../../knihovny/ocr/test/pomocnici';
import { Detail } from './detail';
import { Seznam } from './seznam';
import { Prehled } from './prehled';
import { NovyTiket } from './novy-tiket';

const tiket: Tiket = {
  id: 'ej', hra: 'eurojackpot', nazev: 'práce',
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

describe('Pojmenování a skupiny tiketů', () => {
  let stav: Stav;
  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: ULOZISTE, useClass: UlozisteVPameti }] });
    stav = TestBed.inject(Stav);
    // Ceník z test/fixtures/vysledky-2026-35-az-37.json.
    await TestBed.inject(ULOZISTE).ulozCeny([
      { hra: 'eurojackpot', platnostOd: '2014-10-10', sloupecKc: 60, doplnkovaHraKc: 40, zdroj: 'fixtura' },
      { hra: 'sportka', platnostOd: '2024-10-02', sloupecKc: 30, doplnkovaHraKc: 30, zdroj: 'fixtura' },
      { hra: 'euromiliony', platnostOd: '2013-06-16', sloupecKc: 30, doplnkovaHraKc: 30, zdroj: 'fixtura' },
    ]);
    await TestBed.inject(ULOZISTE).ulozTahy([EJ_2026_09_08, SP_2026_09_02, EM_2026_09_01]);
    await stav.nacti();
    await stav.ulozTiket(tiket);
  });

  async function detail() {
    const f = TestBed.createComponent(Detail);
    f.componentRef.setInput('id', tiket.id);
    await f.whenStable();
    return f;
  }

  async function pridejSkupiny() {
    await stav.ulozTiket({
      ...tiket, id: 'sp', hra: 'sportka', nazev: ' PRÁCE ', archivovany: true,
      sloupce: [{ hra: 'sportka', cisla: SP_2026_09_02.tahy[0]!.cisla }],
      slosovani: { ...tiket.slosovani, prvni: SP_2026_09_02.datum },
    });
    const em: Tiket = {
      ...tiket, id: 'em', hra: 'euromiliony',
      sloupce: [{ hra: 'euromiliony', cisla: [17, 5, 28, 21, 16, 30, 1], druheOsudi: [1] }],
      slosovani: { ...tiket.slosovani, prvni: EM_2026_09_01.datum },
    };
    await stav.ulozTiket(em);
    await stav.ulozTiket({ ...em, id: 'kolega', nazev: 'kolega' });
    await stav.ulozTiket({ ...tiket, id: 'stary', nazev: null });
  }

  it('název přežije načtení a sken, lze ho přejmenovat i odstranit bez změny bilance', async () => {
    const puvodniVysledek = stav.vysledky().get(tiket.id);
    await stav.nacti();
    const { nazev: _, ...bezNazvu } = tiket;
    await stav.ulozTiket(bezNazvu);
    expect(stav.tikety()[0]?.nazev).toBe('práce');
    const f = await detail();
    await klikni(f, 'Pojmenovat tiket');
    expect(f.nativeElement.querySelector('input[name=nazev]').value).toBe('práce');
    await vypln(f, 'input[name=nazev]', '  kolega  ');
    await klikni(f, 'Uložit název');
    expect(f.nativeElement.querySelector('h2').textContent).toContain('kolega');
    expect(stav.tikety()[0]).toEqual({ ...tiket, nazev: 'kolega', archivovany: false });
    expect(stav.vysledky().get(tiket.id)).toEqual(puvodniVysledek);
    await klikni(f, 'Pojmenovat tiket');
    await vypln(f, 'input[name=nazev]', ' ');
    await klikni(f, 'Uložit název');
    await stav.nacti();
    expect(stav.tikety()[0]?.nazev).toBeNull();
  });

  it('chyba uložení zachová původní skupinu i rozepsaný název', async () => {
    const f = await detail();
    await klikni(f, 'Pojmenovat tiket');
    await vypln(f, 'input[name=nazev]', 'kolega');
    vi.spyOn(TestBed.inject(ULOZISTE), 'ulozTiket').mockRejectedValueOnce(new Error('disk'));
    await klikni(f, 'Uložit název');
    expect(stav.tikety()[0]?.nazev).toBe('práce');
    expect(f.nativeElement.querySelector('input[name=nazev]').value).toBe('kolega');
    expect(f.nativeElement.querySelector('[role=alert]').textContent).toContain('nepodařilo');
    await klikni(f, 'Uložit název');
    expect(stav.tikety()[0]?.nazev).toBe('kolega');
  });

  it('seznam seskupí hry, kombinuje filtr s archivem a umí nepojmenované tikety', async () => {
    await pridejSkupiny();
    const f = TestBed.createComponent(Seznam);
    await f.whenStable();
    expect(f.nativeElement.querySelectorAll('.nazev-skupiny')).toHaveLength(3);
    await vypln(f, 'select[name=filtr-nazvu]', klicNazvu('práce'), 'change');
    expect(f.nativeElement.querySelectorAll('.tikety li')).toHaveLength(2);
    await klikni(f, 'Archiv');
    expect(f.nativeElement.querySelectorAll('.tikety li')).toHaveLength(1);
    expect(f.nativeElement.querySelector('.tikety').textContent).toContain('Sportka');
    await klikni(f, 'Aktuální');
    await vypln(f, 'select[name=filtr-nazvu]', '', 'change');
    expect(f.nativeElement.querySelectorAll('.tikety li')).toHaveLength(1);
    await klikni(f, 'Podle data');
    expect(f.nativeElement.querySelectorAll('.nazev-skupiny')).toHaveLength(0);
  });

  it('přehled sečte všechny tři hry včetně archivu a filtruje i grafy a varování', async () => {
    await pridejSkupiny();
    const f = TestBed.createComponent(Prehled);
    await f.whenStable();
    expect(f.nativeElement.querySelectorAll('.skupiny-nazvu section')).toHaveLength(3);
    expect(f.nativeElement.querySelector('.poznamky').textContent).toContain('se stejnou sázkou');
    await vypln(f, 'select[name=filtr-nazvu]', klicNazvu('práce'), 'change');
    const vybrane = ['ej', 'sp', 'em'].map(id => stav.vysledky().get(id)!);
    const soucty = [...(f.nativeElement as HTMLElement).querySelectorAll(':scope > .souhrn-tiketu dd')].map(el => el.textContent);
    const vsazeno = vybrane.reduce((s, v) => s + v.vsazenoKc!, 0);
    const vyhrano = vybrane.reduce((s, v) => s + v.celkemKc, 0);
    expect(soucty).toEqual([formatujKc(vsazeno), formatujKc(vyhrano), formatujKc(vyhrano - vsazeno)]);
    expect(f.nativeElement.querySelectorAll('.hry section')).toHaveLength(3);
    expect(f.nativeElement.querySelector('.skupiny-nazvu .pocet').textContent).toBe('3 tikety');
    await vypln(f, 'select[name=filtr-nazvu]', klicNazvu('kolega'), 'change');
    expect(f.nativeElement.querySelectorAll('.hry section')).toHaveLength(1);
    expect(f.nativeElement.querySelector('.poznamky').textContent).not.toContain('se stejnou sázkou');
    await stav.ulozTiket({ ...stav.tikety().find(t => t.id === 'kolega')!, cenaKc: null, slosovani: { prvni: '2010-01-01', pocet: 1, dny: null } });
    await f.whenStable();
    expect(f.nativeElement.querySelector('.skupiny-nazvu').textContent).toContain('Neúplná bilance');
  });

  it('přehled odkazuje na tikety skupiny a seznam z odkazu převezme filtr', async () => {
    await pridejSkupiny();
    await stav.ulozTiket({ ...tiket, id: 'stary-archiv', nazev: 'loni', archivovany: true });
    const f = TestBed.createComponent(Prehled);
    await f.whenStable();
    const odkazy = new Map([...(f.nativeElement as HTMLElement).querySelectorAll('.skupiny-nazvu section')]
      .map(s => [s.querySelector('h4')!.textContent, s.querySelector<HTMLAnchorElement>('.akce-skupiny a')!]));
    const parametry = (nazev: string) => new URL(odkazy.get(nazev)!.href).searchParams;
    expect(parametry('práce').get('nazev')).toBe(klicNazvu('práce'));
    expect(parametry('práce').has('archiv')).toBe(false);
    expect(parametry('loni').get('archiv')).toBe('1');
    expect(parametry('Bez názvu').get('nazev')).toBe('');

    await TestBed.inject(Router).navigateByUrl(odkazy.get('práce')!.getAttribute('href')!);
    const s = TestBed.createComponent(Seznam);
    await s.whenStable();
    expect(s.nativeElement.querySelectorAll('.tikety li')).toHaveLength(2);
    expect((s.nativeElement.querySelector('select[name=filtr-nazvu]') as HTMLSelectElement).value).toBe(klicNazvu('práce'));
  });

  it('přehled bez tiketů neodkazuje na vybraný název', async () => {
    await stav.smazTiket(tiket.id);
    const f = TestBed.createComponent(Prehled);
    await f.whenStable();
    expect(f.nativeElement.querySelector('.prazdno').textContent).toContain('Zatím tu nic není');
    expect(f.nativeElement.querySelector('.prazdno').textContent).not.toContain('vybraný název');
    await stav.ulozTiket(tiket);
    await f.whenStable();
    await vypln(f, 'select[name=filtr-nazvu]', klicNazvu('práce'), 'change');
    await stav.smazTiket(tiket.id);
    await f.whenStable();
    expect(f.nativeElement.querySelector('.prazdno').textContent).toContain('Pro vybraný název');
  });

  it('název funguje u virtuálního tiketu i po archivaci a změně rozsahu', async () => {
    const kontrola = { od: EJ_2026_09_08.datum, do: null, cenaZaSlosovaniKc: null };
    await stav.ulozTiket({ ...tiket, kontrola });
    const f = await detail();
    await klikni(f, 'Pojmenovat tiket');
    await vypln(f, 'input[name=nazev]', 'kolega');
    await klikni(f, 'Uložit název');
    await klikni(f, 'Archivovat');
    expect(stav.tikety()[0]?.kontrola).toEqual(kontrola);
    expect(stav.tikety()[0]?.nazev).toBe('kolega');
    await klikni(f, 'Upravit rozsah kontroly');
    await vypln(f, '.uprava input[type=date]', '2026-09-01');
    await klikni(f, 'Uložit rozsah');
    await stav.nacti();
    expect(stav.tikety()[0]?.nazev).toBe('kolega');
    expect(stav.tikety()[0]?.archivovany).toBe(true);
    expect(stav.tikety()[0]?.kontrola?.od).toBe('2026-09-01');
  });

  it('opětovný sken předvyplní název a dovolí jej výslovně odstranit', async () => {
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    TestBed.inject(NactenaCisla).uloz(prectiTiket(tiketEJ([
      ['SLOSOVÁNÍ: 1 (ÚT)', '08.09.2026'], ['1: 23 30 33 37 47', '02 03 NT'],
    ]), 'eurojackpot'), ['hlavička']);
    TestBed.inject(NaskenovanyTiket).uloz(tiket.id, 'eurojackpot');
    const f = TestBed.createComponent(NovyTiket);
    await f.whenStable();
    expect(f.nativeElement.querySelector('input[name=nazev]').value).toBe('práce');
    await vypln(f, 'input[name=nazev]', '');
    await klikni(f, 'Zkontrolovat tiket');
    expect(stav.tikety()).toHaveLength(1);
    expect(stav.tikety()[0]?.nazev).toBeNull();
  });

  it('při přidání nabízí použité názvy a uloží zadaný název', async () => {
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    TestBed.inject(NactenaCisla).uloz(prectiTiket(tiketEJ([
      ['SLOSOVÁNÍ: 1 (ÚT)', '08.09.2026'], ['1: 23 30 33 37 47', '02 03 NT'],
    ]), 'eurojackpot'), ['hlavička']);
    TestBed.inject(NaskenovanyTiket).uloz('novy', 'eurojackpot');
    const f = TestBed.createComponent(NovyTiket);
    await f.whenStable();
    expect(f.nativeElement.querySelector('datalist option').value).toBe('práce');
    await vypln(f, 'input[name=nazev]', '  kolega  ');
    await klikni(f, 'Zkontrolovat tiket');
    expect(stav.tikety().find(t => t.id === 'novy')?.nazev).toBe('kolega');
  });
});
