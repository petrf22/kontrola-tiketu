import type { WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { prectiTiket } from '@kontrola-tiketu/ocr';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { tiketEJ } from '../../../knihovny/ocr/test/pomocnici';
import type { VysledekSnimku } from '../data/snimekTiketu';
import { zavislostiCapacitor } from '../data/snimekTiketu-capacitor';
import { SkenCisel } from './sken-cisel';

describe('Přímé focení tiketu', () => {
  afterEach(() => vi.restoreAllMocks());

  it('na telefonu otevře fotoaparát bez kliknutí a po zrušení dovolí další pokus', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    const poriz = vi.spyOn(zavislostiCapacitor, 'poriz').mockRejectedValue(new Error('Focení zrušeno.'));
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const f = TestBed.createComponent(SkenCisel);
    await f.whenStable();
    expect(poriz).toHaveBeenCalledTimes(1);
    await expect.poll(() => f.nativeElement.textContent).toContain('Focení zrušeno.');
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
