import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { Tiket } from '@kontrola-tiketu/jadro';
import { SP_2026_09_02 } from '../../../knihovny/jadro/test/fixtures/sportka';
import { Detail } from './detail';
import { Stav } from '../data/stav';
import { ULOZISTE } from '../data/tokeny';
import { UlozisteVPameti } from '../data/uloziste';

/**
 * Sportka losuje dva tahy. Sloupec 21 5 37 40 15 1 má v prvním tahu (21 5 37 18 34 19) tři
 * shody a V. pořadí, ve druhém (40 15 34 32 24 22) dvě jiné. Sloučené shody by ukázaly pět
 * zvýrazněných čísel — tak to aplikace dělala do 4. 10. 2026 u tiketu uživatele.
 */
const tiket: Tiket = {
  id: 'sp', hra: 'sportka', sloupce: [{ hra: 'sportka', cisla: [21, 5, 37, 40, 15, 1] }],
  slosovani: { prvni: SP_2026_09_02.datum, pocet: 1, dny: null }, kodDoplnkoveHry: null, cenaKc: null,
  vlozeno: '2026-09-02T12:00:00Z',
};

it('detail Sportky ukazuje shody každého tahu zvlášť', async () => {
  TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: ULOZISTE, useClass: UlozisteVPameti }] });
  const stav = TestBed.inject(Stav);
  stav.tahy.set([SP_2026_09_02]);
  await stav.ulozTiket(tiket);
  const f = TestBed.createComponent(Detail);
  f.componentRef.setInput('id', tiket.id);
  await f.whenStable();

  const sekce = (f.nativeElement as HTMLElement).querySelector('section ol.sloupce:not(.vsazene)')!.closest('section')!;
  expect([...sekce.querySelectorAll('h3')].map(h => h.textContent?.trim())).toEqual(['1. tah', '2. tah']);
  const tahy = [...sekce.querySelectorAll('ol.sloupce')].map(ol => ({
    shody: [...ol.querySelectorAll('.kulicka.shoda')].map(k => Number(k.textContent)),
    poradi: ol.querySelector('.poradi')!.textContent?.trim(),
  }));
  expect(tahy).toEqual([
    { shody: [21, 5, 37], poradi: 'pořadí V' },
    { shody: [40, 15], poradi: '—' },
  ]);
});
