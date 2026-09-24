import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
    tlacitko.click();
    await f.whenStable();
    expect(poriz).toHaveBeenCalledTimes(2);
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
