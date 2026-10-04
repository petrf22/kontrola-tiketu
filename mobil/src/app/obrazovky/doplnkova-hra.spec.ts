import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { prectiTiket } from '@kontrola-tiketu/ocr';
import { tiketEJ } from '../../../knihovny/ocr/test/pomocnici';
import { ROVNE, SPORTKA_14_9, SPORTKA_BEZ_SANCE } from '../../../knihovny/ocr/test/tiketyZFotek';
import { Stav } from '../data/stav';
import { ULOZISTE } from '../data/tokeny';
import { UlozisteVPameti } from '../data/uloziste';
import { NactenaCisla, NaskenovanyTiket } from '../data/sken';
import { NovyTiket } from './novy-tiket';

/** Řádky tiketu Sportky ze 14. 9. 2026 s jiným koncem řádku Šance. */
function sKoncemSance(konec: string[]): string[][] {
  return SPORTKA_14_9.map((radek) => (radek[1] === 'ANO' ? [radek[0]!, ...konec] : [...radek]));
}

describe('Doplňková hra podle ANO / NE na tiketu', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: ULOZISTE, useClass: UlozisteVPameti }] });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  async function formular(radky: readonly string[][]) {
    TestBed.inject(NactenaCisla).uloz(prectiTiket(tiketEJ(radky), 'sportka', ROVNE), ['hlavička']);
    TestBed.inject(NaskenovanyTiket).uloz('sance', 'sportka');
    const f = TestBed.createComponent(NovyTiket);
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    return { f, el, kod: el.querySelector<HTMLInputElement>('input[data-cesta=kodDoplnkoveHry]')! };
  }

  it('u NE kód nevyplní, řekne proč a uloží tiket bez Šance', async () => {
    const { el, kod, f } = await formular(SPORTKA_BEZ_SANCE);
    expect(kod.value).toBe('');
    expect(el.querySelector('.doplnkova-ne')?.textContent).toContain('NE');
    expect(el.querySelector('.doplnkova-nevim')).toBeNull();

    const ulozit = [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Zkontrolovat tiket')!;
    ulozit.click();
    await f.whenStable();
    const stav = TestBed.inject(Stav);
    await stav.nacti();
    expect(stav.tikety().find((t) => t.id === 'sance')?.kodDoplnkoveHry).toBeNull();
  });

  it('u ANO kód vyplní bez upozornění', async () => {
    const { el, kod } = await formular(SPORTKA_14_9);
    expect(kod.value).toBe('654321');
    expect(el.querySelector('.doplnkova-ne')).toBeNull();
    expect(el.querySelector('.doplnkova-nevim')).toBeNull();
  });

  it('bez čitelného ANO/NE kód vyplní a upozorní, dokud ho uživatel nezmění', async () => {
    const { el, kod, f } = await formular(sKoncemSance([]));
    expect(kod.value).toBe('654321');
    expect(el.querySelector('.doplnkova-nevim')?.textContent).toContain('ANO/NE');

    kod.value = '';
    kod.dispatchEvent(new Event('input', { bubbles: true }));
    await f.whenStable();
    expect(el.querySelector('.doplnkova-nevim')).toBeNull();
  });
});
