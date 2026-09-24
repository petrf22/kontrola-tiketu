import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { souhrnBilance, type Tiket, type VysledekSlosovani } from '@kontrola-tiketu/jadro';
import { EJ_2026_09_08 } from '../../../knihovny/jadro/test/fixtures/eurojackpot';
import { Detail } from './detail';
import { Seznam } from './seznam';
import { NovyTiket } from './novy-tiket';
import { Stav } from '../data/stav';
import { ULOZISTE } from '../data/tokeny';
import { UlozisteVPameti } from '../data/uloziste';
import { sRozsahem } from '../data/kontrola';
import { sUpravenouCenou } from '../data/zobrazeniTiketu';
import { prectiTiket } from '@kontrola-tiketu/ocr';
import { tiketEJ } from '../../../knihovny/ocr/test/pomocnici';
import { NactenaCisla, NaskenovanyTiket } from '../data/sken';

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

  it('běžící tiket bez výhry se liší od neúplného výsledku', async () => {
    const bezVyhry = { hra: 'eurojackpot', cisla: [2, 3, 5, 6, 7], eurocisla: [1, 2] } as const;
    await stav.ulozTiket({
      ...tiket, id: 'virtualni', sloupce: [bezVyhry],
      kontrola: { od: '2026-09-08', do: null, cenaZaSlosovaniKc: null },
    });
    await stav.ulozTiket({
      ...tiket, id: 'papirovy', sloupce: [bezVyhry], slosovani: { ...tiket.slosovani, pocet: 2 },
    });
    const f = TestBed.createComponent(Seznam);
    await f.whenStable();
    const castka = (id: string) =>
      (f.nativeElement.querySelector(`.tikety a[href="/tiket/${id}"] .castka`) as HTMLElement).textContent;
    expect(castka('virtualni')).toContain('zatím bez výhry');
    expect(castka('papirovy')).toContain('Výsledek zatím neúplný');
    expect(castka('papirovy')).toContain('Chybí 1 slosování');
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
