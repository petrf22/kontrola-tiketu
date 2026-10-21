import type { WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideRouter, Router } from '@angular/router';
import { Capacitor, CapacitorException, type ExceptionCode } from '@capacitor/core';
import { prectiTiket } from '@kontrola-tiketu/ocr';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { tiketEJ } from '../../../knihovny/ocr/test/pomocnici';
import type { VysledekSnimku } from '../data/snimekTiketu';
import { chybaFotaku, FoceniZruseno, overKopiiVCache, zavislostiCapacitor, zavislostiGalerie } from '../data/snimekTiketu-capacitor';
import { SkenCisel } from './sken-cisel';

describe('Přímé focení tiketu', () => {
  afterEach(() => vi.restoreAllMocks());

  it('na telefonu otevře fotoaparát bez kliknutí a po zrušení bez chyby dovolí další pokus', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    const poriz = vi.spyOn(zavislostiCapacitor, 'poriz').mockRejectedValue(new FoceniZruseno());
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const f = TestBed.createComponent(SkenCisel);
    await f.whenStable();
    expect(poriz).toHaveBeenCalledTimes(1);
    await expect.poll(() => (f.nativeElement as HTMLElement).querySelector('button')?.disabled).toBe(false);
    expect((f.nativeElement as HTMLElement).querySelector('[role="alert"]')).toBeNull();
    const tlacitko = (f.nativeElement as HTMLElement).querySelector('button')!;
    expect(tlacitko.disabled).toBe(false);
    expect(tlacitko.textContent?.trim()).toBe('Vyfotit znovu');
    tlacitko.click();
    await f.whenStable();
    expect(poriz).toHaveBeenCalledTimes(2);
  });

  it('po přečtení nahradí snímání formulářem, aby Zpět nevedlo znovu do fotoaparátu', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    vi.spyOn(zavislostiCapacitor, 'poriz').mockRejectedValue(new Error('Focení zrušeno.'));
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const f = TestBed.createComponent(SkenCisel);
    await f.whenStable();
    const cteni = prectiTiket(tiketEJ([
      ['SLOSOVÁNÍ: 1 (ÚT)', '08.09.2026'], ['1: 23 30 33 37 47', '02 03 NT'],
    ]), 'eurojackpot');
    // Hra z fotky nepoznaná — uživatel ji zvolí a tentýž snímek se přečte znovu.
    (f.componentInstance as unknown as { nejistaHra: WritableSignal<VysledekSnimku | null> }).nejistaHra.set({
      hra: { hra: null, podle: [] } as unknown as VysledekSnimku['hra'], cteni: null, prectiJako: () => cteni,
      maSloupce: true, serioveCislo: null, docasnySoubor: '',
    });
    await f.whenStable();
    const eurojackpot = [...(f.nativeElement as HTMLElement).querySelectorAll('button')]
      .find(b => b.textContent?.trim() === 'Eurojackpot')!;
    eurojackpot.click();
    await f.whenStable();
    expect(navigate).toHaveBeenCalledWith(['/tiket/novy'], { replaceUrl: true });
  });

  it('v sérii kontrol předá formuláři, že jde jen o kontrolu', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    vi.spyOn(zavislostiCapacitor, 'poriz').mockRejectedValue(new Error('Focení zrušeno.'));
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: 'sken-cisel', component: SkenCisel }])] });
    const harness = await RouterTestingHarness.create();
    const komponenta = await harness.navigateByUrl('/sken-cisel?kontrola=1', SkenCisel);
    const el = harness.routeNativeElement!;
    expect(el.querySelector('a[href="/tiket/novy?kontrola=1"]')?.textContent).toContain('Zadat čísla ručně');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const cteni = prectiTiket(tiketEJ([
      ['SLOSOVÁNÍ: 1 (ÚT)', '08.09.2026'], ['1: 23 30 33 37 47', '02 03 NT'],
    ]), 'eurojackpot');
    (komponenta as unknown as { nejistaHra: WritableSignal<VysledekSnimku | null> }).nejistaHra.set({
      hra: { hra: null, podle: [] } as unknown as VysledekSnimku['hra'], cteni: null, prectiJako: () => cteni,
      maSloupce: true, serioveCislo: null, docasnySoubor: '',
    });
    harness.detectChanges();
    [...el.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Eurojackpot')!.click();
    await harness.fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith(['/tiket/novy'], { replaceUrl: true, queryParams: { kontrola: '1' } });
  });

  it('chybu fotoaparátu ukáže česky', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    vi.spyOn(zavislostiCapacitor, 'poriz').mockRejectedValue(new CapacitorException('Unable to process image'));
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const f = TestBed.createComponent(SkenCisel);
    await expect.poll(() => (f.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent)
      .toBe('Snímek se nepodařilo zpracovat. Zkus to znovu.');
  });

  it('zavřený fotoaparát pozná podle hlášky pluginu, odepřený přístup ohlásí česky', () => {
    const jina = 'Snímek se nepodařilo pořídit.';
    expect(chybaFotaku(new CapacitorException('User cancelled photos app'), jina)).toBeInstanceOf(FoceniZruseno);
    expect(chybaFotaku(new CapacitorException('', 'OS-PLUG-CAMR-0020' as ExceptionCode), jina)).toBeInstanceOf(FoceniZruseno);
    expect(chybaFotaku(new CapacitorException('User denied access to camera'), jina).message)
      .toContain('Bez přístupu k fotoaparátu focení nepůjde.');
    expect(chybaFotaku(new CapacitorException('Out of memory'), jina).message).toBe(jina);
  });

  it('v prohlížeči fotoaparát nespouští a nabídne ruční zadání', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);
    const poriz = vi.spyOn(zavislostiCapacitor, 'poriz');
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const f = TestBed.createComponent(SkenCisel);
    await f.whenStable();
    expect(poriz).not.toHaveBeenCalled();
    expect((f.nativeElement as HTMLElement).querySelector('a[href="/tiket/novy"]')?.textContent)
      .toContain('Zadat čísla ručně');
  });
});

describe('Vložení tiketu z obrázku', () => {
  afterEach(() => vi.restoreAllMocks());

  async function otevri(): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'z-obrazku', component: SkenCisel, data: { zdroj: 'galerie' } }])],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/z-obrazku', SkenCisel);
    return harness.routeNativeElement!;
  }

  it('na telefonu otevře výběr obrázku místo fotoaparátu a po zrušení dovolí vybrat jiný', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    const fotak = vi.spyOn(zavislostiCapacitor, 'poriz');
    const vyber = vi.spyOn(zavislostiGalerie, 'poriz').mockRejectedValue(new FoceniZruseno());
    const el = await otevri();
    expect(vyber).toHaveBeenCalledTimes(1);
    expect(fotak).not.toHaveBeenCalled();
    expect(el.querySelector('h2')?.textContent).toBe('Vložit z obrázku');
    await expect.poll(() => el.querySelector('button')?.disabled).toBe(false);
    expect(el.querySelector('[role="alert"]')).toBeNull();
    const tlacitko = el.querySelector('button')!;
    expect(tlacitko.textContent?.trim()).toBe('Vybrat jiný obrázek');
    tlacitko.click();
    await expect.poll(() => vyber.mock.calls.length).toBe(2);
  });

  it('úklid smí smazat jen kopii v cache aplikace, nikdy originál', () => {
    expect(overKopiiVCache('file:///data/user/0/cz.app/cache/IMG_1.jpg.123.jpeg'))
      .toBe('file:///data/user/0/cz.app/cache/IMG_1.jpg.123.jpeg');
    expect(() => overKopiiVCache('file:///storage/emulated/0/DCIM/IMG_1.jpg')).toThrow();
    expect(() => overKopiiVCache('content://media/external/images/1')).toThrow();
  });
});
