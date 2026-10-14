import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { Stav } from './data/stav';
import type { Tah } from '@kontrola-tiketu/jadro';
import { formatujDatum } from './data/format';

describe('Hlavní navigace', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [App], providers: [provideRouter(routes, withComponentInputBinding())] });
    vi.spyOn(TestBed.inject(Stav), 'nacti').mockResolvedValue();
    vi.spyOn(TestBed.inject(Stav), 'stahniVysledky').mockResolvedValue({ uspech: true, zprava: 'Hotovo' });
  });

  it('zobrazí název a tři oddělené navigační cíle', async () => {
    const f = TestBed.createComponent(App);
    await f.whenStable();
    expect(f.nativeElement.querySelector('h1').textContent).toContain('Kontrola tiketu');
    expect([...f.nativeElement.querySelectorAll('nav a')].map((a: any) => a.textContent.trim())).toEqual(['Tikety', 'Přehled', 'Další']);
  });

  it('podstránky výsledků patří pod Další a detail pod Tikety', async () => {
    const f = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/import');
    await f.whenStable();
    expect(f.nativeElement.querySelector('nav [aria-current=page]').textContent).toBe('Další');
    await router.navigateByUrl('/tiket/test');
    await f.whenStable();
    expect(f.nativeElement.querySelector('nav [aria-current=page]').textContent).toBe('Tikety');
  });

  it('patička ukáže výsledky každé hry zvlášť a chybějící losování', async () => {
    // Úterý večer: Euromiliony už jsou, Eurojackpot ještě ne.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 13, 21, 30));
    try {
      const tahy = [{ hra: 'eurojackpot', datum: '2026-10-09' }, { hra: 'euromiliony', datum: '2026-10-13' }];
      TestBed.inject(Stav).tahy.set(tahy as unknown as Tah[]);
      const f = TestBed.createComponent(App);
      await f.whenStable();
      const paticka = f.nativeElement.querySelector('footer').textContent;
      expect(paticka).toContain(`Výsledky: Eurojackpot ${formatujDatum('2026-10-09')} · Euromiliony ${formatujDatum('2026-10-13')}.`);
      expect(paticka).toContain(`Eurojackpot ${formatujDatum('2026-10-13')} zatím není.`);
      expect(paticka).not.toContain('Euromiliony 13. 10. 2026 zatím');
    } finally {
      vi.useRealTimers();
    }
  });
});
