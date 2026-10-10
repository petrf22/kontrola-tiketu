import { TestBed } from '@angular/core/testing';
import { VERZE_FORMATU, type Tiket } from '@kontrola-tiketu/jadro';
import { EJ_2026_09_04, EJ_2026_09_08 } from '../../../knihovny/jadro/test/fixtures/eurojackpot';
import { Stav } from './stav';
import { ULOZISTE } from './tokeny';
import { UlozisteVPameti } from './uloziste';

const tiket: Tiket = {
  id: 'test', hra: 'eurojackpot', sloupce: [{ hra: 'eurojackpot', cisla: [47, 14, 27, 34, 1], eurocisla: [4, 1] }],
  slosovani: { prvni: '2026-09-04', pocet: 2, dny: null }, kodDoplnkoveHry: null, cenaKc: null, vlozeno: '2026-09-04T12:00:00Z',
};
const soubor = JSON.stringify({
  verzeFormatu: VERZE_FORMATU, vygenerovano: '2026-09-09T06:00:00.000Z', zdroj: 'https://www.allwyn.cz/system/vyherka',
  obdobi: { od: '2026-37', do: '2026-37' }, sazbyExtra6: [], tahy: [EJ_2026_09_08],
});
const kolo = () => new Promise(resolve => setTimeout(resolve));

describe('Stav a upozornění na nové výsledky', () => {
  let uloziste: UlozisteVPameti;
  let stav: Stav;
  beforeEach(async () => {
    uloziste = new UlozisteVPameti();
    TestBed.configureTestingModule({ providers: [{ provide: ULOZISTE, useValue: uloziste }] });
    stav = TestBed.inject(Stav);
    stav.tahy.set([EJ_2026_09_04]);
    await stav.ulozTiket(tiket);
  });

  it('uložení tiketu uprostřed importu neumlčí výhru z nového tahu', async () => {
    const aktualizuj = stav.oznameni.aktualizuj.bind(stav.oznameni);
    let pust!: () => void;
    const ceka = new Promise<void>(resolve => { pust = resolve; });
    vi.spyOn(stav.oznameni, 'aktualizuj').mockImplementationOnce(async (...a) => { await ceka; return aktualizuj(...a); });
    const import_ = stav.importuj(soubor);
    await kolo();
    const uprava = stav.ulozTiket({ ...tiket, nazev: 'Přejmenovaný' });
    await kolo();
    pust();
    await Promise.all([import_, uprava]);
    expect(stav.oznameni.neprectene()).toMatchObject([{ tiketId: tiket.id, datum: EJ_2026_09_08.datum, vyhra: true }]);
  });

  // Krátký tiket zná jen 4. 9.; rozšíření rozsahu na virtuální dodá výsledek 8. 9. úpravou, ne stažením.
  const kratky: Tiket = { ...tiket, slosovani: { ...tiket.slosovani, pocet: 1 } };
  const virtualni: Tiket = { ...kratky, kontrola: { od: '2026-09-01', do: null, cenaZaSlosovaniKc: null } };

  it('chyba při mazání nahrazeného tiketu nezpůsobí falešné hlášení rozšířeného rozsahu', async () => {
    stav.tahy.set([EJ_2026_09_04, EJ_2026_09_08]);
    await stav.ulozTiket(kratky);
    await stav.ulozTiket({ ...kratky, id: 'jiny', sloupce: [{ hra: 'eurojackpot', cisla: [1, 2, 3, 4, 5], eurocisla: [1, 2] }] });
    expect(stav.oznameni.neprectene()).toEqual([]);
    vi.spyOn(uloziste, 'smazTiket').mockRejectedValueOnce(new Error('disk'));
    await expect(stav.ulozTiket(virtualni, { nahradit: ['jiny'] })).rejects.toThrow('disk');
    expect(stav.tikety().find(t => t.id === tiket.id)?.kontrola).toEqual(virtualni.kontrola);
    await stav.oznameni.aktualizuj(stav.vysledky(), stav.vysledky());
    expect(stav.oznameni.neprectene()).toEqual([]);
  });

  it('ani selhané načtení tiketů po uložení nezpůsobí falešné hlášení', async () => {
    stav.tahy.set([EJ_2026_09_04, EJ_2026_09_08]);
    await stav.ulozTiket(kratky);
    vi.spyOn(uloziste, 'nactiTikety').mockRejectedValueOnce(new Error('disk'));
    await expect(stav.ulozTiket(virtualni)).rejects.toThrow('disk');
    expect(stav.tikety().find(t => t.id === tiket.id)?.kontrola).toEqual(virtualni.kontrola);
    await stav.oznameni.aktualizuj(stav.vysledky(), stav.vysledky());
    expect(stav.oznameni.neprectene()).toEqual([]);
  });
});
