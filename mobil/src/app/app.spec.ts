import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, withComponentInputBinding } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { Stav } from './data/stav';

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
});
