import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { souhrnBilance, VERZE_FORMATU, type Tah, type Tiket, type VysledekSlosovani } from '@kontrola-tiketu/jadro';
import { EJ_2026_09_04, EJ_2026_09_08 } from '../../../knihovny/jadro/test/fixtures/eurojackpot';
import { SP_2026_09_06 } from '../../../knihovny/jadro/test/fixtures/sportka';
import { EM_2026_09_08 } from '../../../knihovny/jadro/test/fixtures/euromiliony';
import { ImportVysledku } from './import-vysledku';
import { Detail } from './detail';
import { Seznam } from './seznam';
import { NovyTiket } from './novy-tiket';
import { DELKA_OZNAMENI_MS, Stav } from '../data/stav';
import { ULOZISTE } from '../data/tokeny';
import { UlozisteVPameti } from '../data/uloziste';
import { sRozsahem } from '../data/kontrola';
import { sUpravenouCenou } from '../data/zobrazeniTiketu';
import { prectiTiket } from '@kontrola-tiketu/ocr';
import { tiketEJ } from '../../../knihovny/ocr/test/pomocnici';
import { NactenaCisla, NaskenovanyTiket } from '../data/sken';
import { formatujDatum } from '../data/format';

const tiket: Tiket = {
  id: 'test', hra: 'eurojackpot', sloupce: [{ hra: 'eurojackpot', cisla: [47, 14, 27, 34, 1], eurocisla: [4, 1] }],
  slosovani: { prvni: '2026-09-08', pocet: 1, dny: null }, kodDoplnkoveHry: null, cenaKc: null, vlozeno: '2026-09-08T12:00:00Z',
};

async function klikni<T>(f: ComponentFixture<T>, text: string) {
  const button = [...(f.nativeElement as HTMLElement).querySelectorAll('button')].find(b => b.textContent?.trim() === text);
  expect(button, text).toBeDefined();
  button!.click();
  await f.whenStable();
}

describe('Správa tiketů', () => {
  let stav: Stav;
  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: ULOZISTE, useClass: UlozisteVPameti }] });
    stav = TestBed.inject(Stav);
    stav.tahy.set([EJ_2026_09_08]);
    await stav.ulozTiket(tiket);
  });

  async function detail() {
    const f = TestBed.createComponent(Detail);
    f.componentRef.setInput('id', tiket.id);
    await f.whenStable();
    return f;
  }

  it('archivace, Zpět a vrácení zachovají bilanci, kontrolu i datum přidání', async () => {
    await stav.ulozTiket({ ...tiket, kontrola: { od: '2026-09-08', do: null, cenaZaSlosovaniKc: null } });
    const bilance = souhrnBilance(stav.tikety(), stav.vysledky());
    const f = await detail();
    await klikni(f, 'Archivovat');
    expect(stav.tikety()[0]?.archivovany).toBe(true);
    expect(stav.tikety()[0]?.kontrola?.do).toBeNull();
    expect(stav.vysledky().get(tiket.id)?.pokracuje).toBe(true);
    expect(souhrnBilance(stav.tikety(), stav.vysledky())).toEqual(bilance);
    await klikni(f, 'Zpět');
    expect(stav.tikety()[0]?.archivovany).toBe(false);
    await klikni(f, 'Archivovat');
    await klikni(f, 'Vrátit z archivu');
    expect(stav.tikety()[0]?.archivovany).toBe(false);
    expect(stav.tikety()[0]?.vlozeno).toBe(tiket.vlozeno);
  });

  it('archiv přežije opětovné načtení, změnu ceny, rozsahu i nový sken', async () => {
    await stav.ulozTiket({ ...tiket, archivovany: true });
    await stav.nacti();
    let t = stav.tikety()[0]!;
    await stav.ulozTiket(sUpravenouCenou(t, '0'));
    t = stav.tikety()[0]!;
    await stav.ulozTiket(sRozsahem(t, { od: '2026-09-01', do: null, cenaZaSlosovaniKc: null }));
    expect(stav.tikety()[0]?.archivovany).toBe(true);
    await stav.ulozTiket(tiket);
    expect(stav.tikety()[0]?.archivovany).toBe(true);
  });

  it('neznámá cena není nula; oprava ceny odstraní možnost vrátit starší archivaci', async () => {
    const f = await detail();
    expect(f.nativeElement.querySelector('.souhrn-tiketu').textContent).toContain('Neznámá');
    await klikni(f, 'Archivovat');
    await klikni(f, 'Upravit cenu');
    const pole = f.nativeElement.querySelector('form input') as HTMLInputElement;
    pole.value = '0'; pole.dispatchEvent(new Event('input', { bubbles: true }));
    await klikni(f, 'Uložit cenu');
    expect(stav.tikety()[0]?.cenaKc).toBe(0);
    expect(stav.tikety()[0]?.archivovany).toBe(true);
    expect(f.nativeElement.querySelector('.souhrn-tiketu').textContent).not.toContain('Neznámá');
    expect(f.nativeElement.querySelector('.zprava-akce button')).toBeNull();
  });

  it('při chybě úložiště nehlásí úspěšnou archivaci', async () => {
    const f = await detail();
    vi.spyOn(stav, 'ulozTiket').mockRejectedValueOnce(new Error('disk'));
    await klikni(f, 'Archivovat');
    expect(stav.tikety()[0]?.archivovany).toBe(false);
    expect(f.nativeElement.querySelector('[role=alert]').textContent).toContain('nepodařilo');
    expect(f.nativeElement.querySelector('.zprava-akce')).toBeNull();
  });

  it('chyba akce smaže hlášku o úspěchu té předchozí', async () => {
    const f = await detail();
    await klikni(f, 'Archivovat');
    expect(f.nativeElement.querySelector('.zprava-akce').textContent).toContain('archivu');
    await klikni(f, 'Upravit cenu');
    const pole = f.nativeElement.querySelector('form input') as HTMLInputElement;
    pole.value = '100'; pole.dispatchEvent(new Event('input', { bubbles: true }));
    vi.spyOn(stav, 'ulozTiket').mockRejectedValueOnce(new Error('disk'));
    await klikni(f, 'Uložit cenu');
    expect(f.nativeElement.querySelector('[role=alert]').textContent).toContain('nepodařilo');
    expect(f.nativeElement.querySelector('.zprava-akce')).toBeNull();
  });

  it('u virtuálního tiketu mluví nápověda k ceně o jednom slosování', async () => {
    // Ceník opsaný z test/fixtures/vysledky-2026-35-az-37.json: sloupec 60 Kč, Extra 6 40 Kč.
    stav.ceny.set([{
      hra: 'eurojackpot', platnostOd: '2014-10-10', sloupecKc: 60, doplnkovaHraKc: 40,
      zdroj: 'Herní plán číselné loterie EUROJACKPOT, účinný od 3. 10. 2014',
    }]);
    await stav.ulozTiket({
      ...tiket, slosovani: { ...tiket.slosovani, pocet: 5 },
      kontrola: { od: '2026-09-08', do: null, cenaZaSlosovaniKc: null },
    });
    const f = await detail();
    await klikni(f, 'Upravit cenu');
    const uprava = (f.nativeElement.querySelector('form.uprava') as HTMLElement).textContent ?? '';
    expect(uprava).toContain('Cena jednoho slosování podle ceníku');
    expect(uprava).toContain('60');
    expect(uprava).not.toContain('300');
  });

  it('archivované tikety jsou dostupné pouze v archivu seznamu', async () => {
    await stav.ulozTiket({ ...tiket, archivovany: true });
    const f = TestBed.createComponent(Seznam);
    await f.whenStable();
    const filtry = f.nativeElement.querySelector('details.filtry') as HTMLDetailsElement;
    expect(filtry.open).toBe(false);
    expect(filtry.querySelector('summary')!.textContent).toContain('Aktuální');
    expect(f.nativeElement.querySelectorAll('.tikety li')).toHaveLength(0);
    await klikni(f, 'Archiv');
    expect(f.nativeElement.querySelectorAll('.tikety li')).toHaveLength(1);
    expect(filtry.querySelector('summary')!.textContent).toContain('Archiv');
  });

  it('běžící tiket bez výhry ukáže 0 Kč tlumeně, nehotový oranžově', async () => {
    const bezVyhry = { hra: 'eurojackpot', cisla: [2, 3, 5, 6, 7], eurocisla: [1, 2] } as const;
    await stav.ulozTiket({
      ...tiket, id: 'virtualni', sloupce: [bezVyhry],
      kontrola: { od: '2026-09-08', do: null, cenaZaSlosovaniKc: null },
    });
    await stav.ulozTiket({
      // Jiný sloupec: stejné sloupce na stejné slosování by byly duplicita a neuložily by se.
      ...tiket, id: 'papirovy', sloupce: [{ ...bezVyhry, cisla: [2, 3, 5, 6, 8] }], slosovani: { ...tiket.slosovani, pocet: 2 },
    });
    const f = TestBed.createComponent(Seznam);
    await f.whenStable();
    const radek = (id: string, cast: string) =>
      (f.nativeElement.querySelector(`.tikety a[href="/tiket/${id}"] ${cast}`) as HTMLElement | null)?.textContent;
    expect(radek('virtualni', '.vysledek.semafor-nula')?.trim()).toBe('0 Kč');
    expect(radek('virtualni', '.poznamka')).toContain('Další slosování ještě přijdou');
    expect(radek('papirovy', '.vysledek.semafor-nehotovy')?.trim()).toBe('0 Kč');
    expect(radek('papirovy', '.poznamka')).toContain('Chybí 1 slosování');
    const karta = (id: string) => (f.nativeElement.querySelector(`.tikety a[href="/tiket/${id}"]`) as HTMLElement).closest('li')!;
    expect(karta('papirovy').classList).toContain('nehotovy');
    expect(karta('virtualni').classList).not.toContain('nehotovy');
  });

  it('řádek seznamu: výsledek vedle hry, štítky názvu a virtuálního, úplný tiket bez poznámky', async () => {
    await stav.ulozTiket({ ...tiket, nazev: 'Práce', kontrola: { od: '2026-09-08', do: '2026-09-08', cenaZaSlosovaniKc: null } });
    // Tikety se liší sloupcem, jinak by byly duplicitní.
    const jinySloupec = (cislo: number) => [{ hra: 'eurojackpot', cisla: [2, 3, 5, 6, cislo], eurocisla: [1, 2] }] as const;
    await stav.ulozTiket({ ...tiket, id: 'papirovy', sloupce: jinySloupec(8), vlozeno: '2026-09-07T12:00:00Z' });
    const f = TestBed.createComponent(Seznam);
    await f.whenStable();
    const radek = (id: string) => f.nativeElement.querySelector(`.tikety a[href="/tiket/${id}"]`) as HTMLElement;
    const stitky = [...radek(tiket.id).querySelectorAll('.stitky .stitek')].map(e => [e.className, e.textContent?.trim()]);
    expect(stitky).toEqual([['stitek nazev-tiketu', 'Práce'], ['stitek virtualni', 'Virtuální']]);
    expect(radek(tiket.id).querySelector('.hra')!.textContent?.trim()).toBe('Eurojackpot');
    expect(radek('papirovy').querySelector('.stitky')).toBeNull();
    // Nejdřív datum, pak slosování, sloupce až na konci.
    const detail = (id: string) => radek(id).querySelector('.detail')!.textContent!.replace(/\s+/g, ' ').trim();
    expect(detail('papirovy')).toBe(`${formatujDatum('2026-09-08')} · 1 slos. · 1 sl.`);
    expect(detail(tiket.id)).toBe(`${formatujDatum('2026-09-08')} · 1 sl.`);
    await stav.ulozTiket({ ...tiket, id: 'bez-konce', sloupce: jinySloupec(9), vlozeno: '2026-09-06T12:00:00Z', kontrola: { od: '2026-09-08', do: null, cenaZaSlosovaniKc: null } });
    await f.whenStable();
    expect(detail('bez-konce')).toBe(`${formatujDatum('2026-09-08')} – … · 1 sl.`);
    for (const id of [tiket.id, 'papirovy']) {
      expect(radek(id).querySelector('.poznamka')).toBeNull();
      expect(radek(id).textContent).not.toContain('Vyhodnoceno');
    }
  });

  it('seznam si pamatuje typ, název i seskupení, archiv ne', async () => {
    await stav.ulozTiket({ ...tiket, nazev: 'Práce', kontrola: { od: '2026-09-08', do: null, cenaZaSlosovaniKc: null } });
    const f = TestBed.createComponent(Seznam);
    await f.whenStable();
    const typ = f.nativeElement.querySelector('.filtr select') as HTMLSelectElement;
    typ.value = 'virtualni';
    typ.dispatchEvent(new Event('change'));
    const nazev = f.nativeElement.querySelector('select[name=filtr-nazvu]') as HTMLSelectElement;
    nazev.value = nazev.options[1]!.value;
    nazev.dispatchEvent(new Event('change'));
    await klikni(f, 'Podle data');
    await klikni(f, 'Archiv');
    const ulozeny = { typ: 'virtualni', nazev: nazev.options[1]!.value, seskupit: false };
    expect(await TestBed.inject(ULOZISTE).nactiNastaveni('filtrSeznamu')).toEqual(ulozeny);

    stav.filtrSeznamu.set({ typ: 'vsechny', nazev: '*', seskupit: true });
    await stav.nacti();
    expect(stav.filtrSeznamu()).toEqual(ulozeny);
    const znovu = TestBed.createComponent(Seznam);
    await znovu.whenStable();
    expect(znovu.nativeElement.querySelector('summary').textContent).toContain('Aktuální · Virtuální · Práce');
    expect(znovu.nativeElement.querySelectorAll('.tikety li')).toHaveLength(1);
    expect(znovu.nativeElement.querySelectorAll('.nazev-skupiny')).toHaveLength(0);

    await stav.ulozTiket({ ...stav.tikety()[0]!, nazev: null });
    await znovu.whenStable();
    expect(znovu.nativeElement.querySelector('summary').textContent).toBe('Filtr · Aktuální · Virtuální');
  });

  it('tiket před slosováním ukazuje místo výhry a bilance „--- Kč“ a vsazená čísla bez rámečku', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 11, 12));
    try {
      await stav.ulozTiket({ ...tiket, cenaKc: 400, slosovani: { ...tiket.slosovani, prvni: '2026-09-12' } });
      const f = await detail();
      const text = (f.nativeElement as HTMLElement).textContent ?? '';
      expect(f.nativeElement.querySelector('.souhrn-tiketu').textContent).toContain('400');
      const cekajici = [...f.nativeElement.querySelectorAll('.souhrn-tiketu dd.semafor-nehotovy')].map(e => (e as HTMLElement).textContent);
      expect(cekajici).toEqual(['--- Kč', '--- Kč']);
      expect(text).toContain('zatím nebyl slosován');
      expect(f.nativeElement.querySelector('.obsah-tiketu')).toBeNull();
      const vsazene = [...f.nativeElement.querySelectorAll('.vsazene .kulicka')].map(e => Number((e as HTMLElement).textContent));
      expect(vsazene).toEqual([47, 14, 27, 34, 1, 4, 1]);
      for (const skryte of ['Historie slosování', 'Průběžný výsledek', 'Chybí výsledky', 'Součet není úplný']) {
        expect(text).not.toContain(skryte);
      }
      const s = TestBed.createComponent(Seznam);
      await s.whenStable();
      expect(s.nativeElement.querySelector('.tikety .vysledek.semafor-nehotovy').textContent.trim()).toBe('--- Kč');
      expect(s.nativeElement.querySelector('.tikety li').classList).toContain('nehotovy');
      expect(s.nativeElement.querySelector('.tikety .poznamka').textContent).toContain('Slosování od');
    } finally { vi.useRealTimers(); }
  });

  it('proběhlé slosování bez stažených výsledků odkáže na aktualizaci', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 20, 12));
    try {
      await stav.ulozTiket({ ...tiket, slosovani: { ...tiket.slosovani, prvni: '2026-09-12' } });
      const f = await detail();
      const upozorneni = f.nativeElement.querySelector('.cekani') as HTMLElement;
      expect(upozorneni.textContent).toContain('už proběhlo');
      expect(upozorneni.querySelector('a')?.textContent).toContain('Aktualizovat výsledky');
      expect(f.nativeElement.querySelector('.souhrn-tiketu').textContent).toContain('Bilance--- Kč');
    } finally { vi.useRealTimers(); }
  });

  it('historie omezuje počet řádků a filtr nemění souhrn', async () => {
    const v = stav.vysledky().get(tiket.id)!;
    const slosovani: VysledekSlosovani[] = Array.from({ length: 225 }, (_, i) => ({
      ...v.slosovani[0]!, datum: new Date(Date.UTC(2025, 0, i + 1)).toISOString().slice(0, 10),
    }));
    vi.spyOn(stav, 'vyhodnot').mockReturnValue({ ...v, slosovani });
    await stav.ulozTiket({ ...tiket, kontrola: { od: '2025-01-01', do: null, cenaZaSlosovaniKc: null } });
    const f = await detail();
    const souhrn = f.nativeElement.querySelector('.souhrn-tiketu').textContent;
    expect(f.nativeElement.querySelectorAll('.historie-radek')).toHaveLength(20);
    await klikni(f, 'Načíst dalších 20');
    expect(f.nativeElement.querySelectorAll('.historie-radek')).toHaveLength(40);
    await klikni(f, 'Neúplná');
    expect(f.nativeElement.querySelectorAll('.historie-radek')).toHaveLength(0);
    expect(f.nativeElement.querySelector('.souhrn-tiketu').textContent).toBe(souhrn);
    await klikni(f, 'Všechna');
    expect(f.nativeElement.querySelectorAll('.historie-radek')).toHaveLength(20);
  });

  it('souhrn barví výhru a bilanci jako semafor v seznamu', async () => {
    await stav.ulozTiket({ ...tiket, cenaKc: 1000 });
    const f = await detail();
    const v = stav.vysledky().get(tiket.id)!;
    const [, vyhra, bilance] = [...f.nativeElement.querySelectorAll('.souhrn-tiketu dd')] as HTMLElement[];
    expect(vyhra!.className).toBe(v.celkemKc > 0 ? 'semafor-vyhra' : 'semafor-nula');
    expect(bilance!.className).toBe(v.celkemKc > 1000 ? 'semafor-zisk' : v.celkemKc > 0 ? 'semafor-ztrata-s-vyhrou' : 'semafor-prohra');
  });

  it('výsledky, které vyhodnotí čekající tiket, to na pár sekund ohlásí', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      stav.tahy.set([EJ_2026_09_04]);
      expect(stav.vysledky().get(tiket.id)?.slosovani).toHaveLength(0);
      const soubor = JSON.stringify({
        verzeFormatu: VERZE_FORMATU, vygenerovano: '2026-09-09T06:00:00.000Z', zdroj: 'https://www.allwyn.cz/system/vyherka',
        obdobi: { od: '2026-37', do: '2026-37' }, sazbyExtra6: [], tahy: [EJ_2026_09_08],
      });
      expect((await stav.importuj(soubor)).uspech).toBe(true);
      expect(stav.oznameni()).toBe(`Tiket Eurojackpot ${formatujDatum('2026-09-08')} je vyhodnocený.`);
      vi.advanceTimersByTime(DELKA_OZNAMENI_MS);
      expect(stav.oznameni()).toBeNull();
      // Tiket už vyhodnocený byl — stejné výsledky znovu nic neohlásí.
      await stav.importuj(soubor);
      expect(stav.oznameni()).toBeNull();
    } finally { vi.useRealTimers(); }
  });

  it('tiket na jedno slosování ukáže slosování rovnou, bez rámečků, filtru a historie', async () => {
    const f = await detail();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('.obsah-tiketu')).toBeNull();
    expect(el.querySelector('.historie-radek')).toBeNull();
    expect(el.querySelector('[aria-label="Filtr historie"]')).toBeNull();
    expect(el.textContent).not.toContain('Historie slosování');
    expect(el.textContent).toContain(`Slosování ${formatujDatum('2026-09-08')}`);
    expect(el.querySelectorAll('section .sloupce .kulicka.shoda').length).toBeGreaterThan(0);
  });

  it('u víc slosování jsou vsazená čísla i tabulka výher v kartách až po kliknutí', async () => {
    stav.tahy.set([EJ_2026_09_04, EJ_2026_09_08]);
    await stav.ulozTiket({ ...tiket, kontrola: { od: '2026-09-04', do: '2026-09-08', cenaZaSlosovaniKc: null } });
    const f = await detail();
    expect((f.nativeElement.querySelector('.obsah-tiketu') as HTMLDetailsElement).open).toBe(false);
    const karty = [...f.nativeElement.querySelectorAll('.historie-radek')] as HTMLDetailsElement[];
    expect(karty).toHaveLength(2);
    expect(karty.every(k => !k.open)).toBe(true);
    for (const k of karty) {
      expect(k.querySelector('summary .castka')!.textContent).toMatch(/Kč$/);
      expect(k.querySelector('summary .castka')!.className).toMatch(/semafor-(vyhra|nula)/);
    }
    const vyhry = f.nativeElement.querySelector('.historie-radek .tabulka-vyher') as HTMLDetailsElement;
    expect(vyhry.open).toBe(false);
    expect(vyhry.querySelector('summary')!.textContent!.trim()).toBe('Tabulka výher');
    const vylosovane = [...vyhry.querySelectorAll('.osudi .kulicka')].map(e => Number(e.textContent));
    expect(vylosovane).toEqual([...EJ_2026_09_08.cisla].sort((a, b) => a - b).concat([...EJ_2026_09_08.eurocisla].sort((a, b) => a - b)));
    const tabulka = vyhry.querySelector('table') as HTMLTableElement;
    expect(tabulka.caption?.textContent).toBe('Eurojackpot');
    expect(tabulka.tBodies[0]!.rows).toHaveLength(EJ_2026_09_08.poradi.length);
  });

  it('mazání vyžaduje otevření a potvrzení dialogu', async () => {
    const f = await detail();
    const dialog = f.nativeElement.querySelector('dialog') as HTMLDialogElement;
    dialog.showModal = () => dialog.setAttribute('open', '');
    dialog.close = () => dialog.removeAttribute('open');
    const smaz = vi.spyOn(stav, 'smazTiket');
    await klikni(f, 'Smazat tiket');
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(smaz).not.toHaveBeenCalled();
    await klikni(f, 'Ponechat');
    expect(smaz).not.toHaveBeenCalled();
    await klikni(f, 'Smazat tiket');
    await klikni(f, 'Ano, smazat');
    expect(smaz).toHaveBeenCalledWith(tiket.id);
  });

  it('neplatný formulář neukládá a ukáže chybu u sloupce právě jednou', async () => {
    const f = TestBed.createComponent(NovyTiket);
    await f.whenStable();
    const uloz = vi.spyOn(stav, 'ulozTiket');
    await klikni(f, 'Zkontrolovat tiket');
    expect(uloz).not.toHaveBeenCalled();
    const chyba = f.nativeElement.querySelector('.sloupec .chyba-pole') as HTMLElement;
    expect(chyba).not.toBeNull();
    const vyskyty = [...f.nativeElement.querySelectorAll('.chyba-pole, .problemy li')]
      .filter((el: Element) => el.textContent?.trim() === chyba.textContent?.trim());
    expect(vyskyty).toHaveLength(1);
  });

  it('údaje OCR zůstanou viditelné k potvrzení a lze je opravit před uložením', async () => {
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const cteni = prectiTiket(tiketEJ([
      ['SLOSOVÁNÍ: 1 (ÚT)', '08.09.2026'], ['1: 23 30 33 37 47', '02 03 NT'],
    ]), 'eurojackpot');
    TestBed.inject(NactenaCisla).uloz(cteni, ['hlavička']);
    TestBed.inject(NaskenovanyTiket).uloz('12345678901234567890', 'eurojackpot');
    const f = TestBed.createComponent(NovyTiket);
    await f.whenStable();
    expect(f.nativeElement.querySelector('h2').textContent).toContain('Potvrdit údaje');
    const pole = f.nativeElement.querySelector('.sloupec input:not(.euro)') as HTMLInputElement;
    expect(pole.value).toContain('23');
    expect(pole.closest('details')).toBeNull();
    pole.value = '47 14 27 34 1'; pole.dispatchEvent(new Event('input', { bubbles: true }));
    await klikni(f, 'Zkontrolovat tiket');
    expect(stav.tikety().find(t => t.id === '12345678901234567890')?.sloupce[0]?.cisla).toEqual([47, 14, 27, 34, 1]);
  });
});

describe('Výsledky losování', () => {
  const nadpisy = (f: ComponentFixture<ImportVysledku>) =>
    [...(f.nativeElement as HTMLElement).querySelectorAll('.tah .hlavicka > span')].map(el => el.textContent?.trim());

  async function obrazovka(tahy: readonly Tah[]) {
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: ULOZISTE, useClass: UlozisteVPameti }] });
    TestBed.inject(Stav).tahy.set(tahy);
    const f = TestBed.createComponent(ImportVysledku);
    await f.whenStable();
    return f;
  }

  it('ukáže nejnovější tahy, filtr hry a data je zúží', async () => {
    const f = await obrazovka([EJ_2026_09_04, EJ_2026_09_08, SP_2026_09_06, EM_2026_09_08]);
    expect(nadpisy(f)).toEqual([
      `Eurojackpot · úterý ${formatujDatum('2026-09-08')}`,
      `Euromiliony · úterý ${formatujDatum('2026-09-08')}`,
      `Sportka · neděle ${formatujDatum('2026-09-06')}`,
      `Eurojackpot · pátek ${formatujDatum('2026-09-04')}`,
    ]);
    expect(f.nativeElement.querySelector('.tah summary').textContent).toContain('Extra 6');

    await klikni(f, 'Eurojackpot');
    expect(nadpisy(f)).toHaveLength(2);
    const datum = f.nativeElement.querySelector('input[type=date]') as HTMLInputElement;
    datum.value = '2026-09-07'; datum.dispatchEvent(new Event('change'));
    await f.whenStable();
    expect(nadpisy(f)).toEqual([`Eurojackpot · pátek ${formatujDatum('2026-09-04')}`]);
    await klikni(f, 'Nejnovější');
    expect(nadpisy(f)).toHaveLength(2);
  });

  it('po rozbalení je tabulka výher, starší tahy přibývají po dvaceti', async () => {
    const tahy = Array.from({ length: 25 }, (_, i) => ({ ...EJ_2026_09_08, datum: `2026-0${i < 9 ? 1 : 2}-${String((i % 9) + 10)}` }));
    const f = await obrazovka(tahy);
    expect(nadpisy(f)).toHaveLength(20);
    const tabulka = f.nativeElement.querySelector('.tah table') as HTMLTableElement;
    expect(tabulka.caption?.textContent).toBe('Eurojackpot');
    expect(tabulka.tBodies[0]!.rows).toHaveLength(EJ_2026_09_08.poradi.length);
    await klikni(f, 'Načíst dalších 20');
    expect(nadpisy(f)).toHaveLength(25);
    expect([...f.nativeElement.querySelectorAll('button')].some((b: HTMLButtonElement) => b.textContent?.includes('Načíst'))).toBe(false);
  });

  it('karta Správa má stahování a import, Přehled tahy', async () => {
    const f = await obrazovka([EJ_2026_09_08]);
    const text = () => (f.nativeElement as HTMLElement).textContent ?? '';
    expect(text()).not.toContain('Importovat ze souboru');
    await klikni(f, 'Správa');
    expect(nadpisy(f)).toEqual([]);
    expect(text()).toContain('Stáhnout výsledky');
    expect(text()).toContain('Importovat ze souboru');
    expect(text()).toContain(`Uložené výsledky do ${formatujDatum('2026-09-08')}`);
    await klikni(f, 'Přehled');
    expect(nadpisy(f)).toHaveLength(1);
  });

  it('bez tahů nabídne Přehled rovnou stažení', async () => {
    const f = await obrazovka([]);
    const stahni = vi.spyOn(TestBed.inject(Stav), 'stahniVysledky').mockResolvedValue({ uspech: true, zprava: '' });
    expect((f.nativeElement as HTMLElement).textContent).toContain('Zatím nejsou stažené žádné výsledky.');
    await klikni(f, 'Stáhnout výsledky');
    expect(stahni).toHaveBeenCalledOnce();
  });
});
