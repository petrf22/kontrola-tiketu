import { TestBed } from '@angular/core/testing';
import { vyhodnotTiket, type Tah, type Tiket } from '@kontrola-tiketu/jadro';
import { EJ_2026_09_04, EJ_2026_09_08 } from '../../../knihovny/jadro/test/fixtures/eurojackpot';
import { Oznameni } from './oznameni';
import { ULOZISTE } from './tokeny';
import { UlozisteVPameti } from './uloziste';

const tiket: Tiket = {
  id: 'test', hra: 'eurojackpot', sloupce: [{ hra: 'eurojackpot', cisla: [47, 14, 27, 34, 1], eurocisla: [4, 1] }],
  slosovani: { prvni: '2026-09-04', pocet: 2, dny: null }, kodDoplnkoveHry: null, cenaKc: null, vlozeno: '2026-09-04T12:00:00Z',
};
const vysledky = (tahy: readonly Tah[], t: Tiket = tiket) => new Map([[t.id, vyhodnotTiket(t, tahy, [], [])]]);

describe('Trvalá oznámení výsledků', () => {
  let uloziste: UlozisteVPameti;
  let oznameni: Oznameni;
  beforeEach(() => {
    uloziste = new UlozisteVPameti();
    TestBed.configureTestingModule({ providers: [{ provide: ULOZISTE, useValue: uloziste }] });
    oznameni = TestBed.inject(Oznameni);
  });

  it('při zavedení neohlásí historii, další slosování ohlásí i na již vyhodnoceném tiketu', async () => {
    const pred = vysledky([EJ_2026_09_04]);
    const po = vysledky([EJ_2026_09_04, EJ_2026_09_08]);
    await oznameni.nacti(pred);
    expect(oznameni.neprectene()).toEqual([]);
    await oznameni.aktualizuj(pred, po);
    expect(oznameni.neprectene()).toMatchObject([{ tiketId: tiket.id, datum: EJ_2026_09_08.datum, vyhra: true,
      castkaKc: EJ_2026_09_08.poradi.find(p => p.klic === 'V')!.vyseVyhryKc, nejista: false }]);
    const polozky = oznameni.neprectene();
    await oznameni.aktualizuj(po, po);
    expect(oznameni.neprectene()).toEqual(polozky);
    await oznameni.nastavDialog(false);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: ULOZISTE, useValue: uloziste }] });
    oznameni = TestBed.inject(Oznameni);
    await oznameni.nacti(po);
    expect(oznameni.dialog()).toBe(false);
    expect(oznameni.neprectene()).toEqual(polozky);
    await oznameni.potvrdit(polozky.map(p => p.id));
    await oznameni.nacti(po);
    expect(oznameni.neprectene()).toEqual([]);
  });

  it('doplní neznámou částku a staré potvrzení nesmaže novou verzi', async () => {
    const pred = vysledky([]);
    const neuplne = vysledky([{ ...EJ_2026_09_08, poradi: [] }]);
    const uplne = vysledky([EJ_2026_09_08]);
    await oznameni.nacti(pred);
    await oznameni.aktualizuj(pred, neuplne);
    const stare = oznameni.neprectene();
    expect(stare[0]).toMatchObject({ vyhra: true, nejista: true });
    await oznameni.aktualizuj(neuplne, uplne);
    await oznameni.potvrdit(stare.map(p => p.id));
    expect(oznameni.neprectene()).toHaveLength(1);
    expect(oznameni.neprectene()[0]).toMatchObject({ oprava: true, nejista: false });
    expect(oznameni.neprectene()[0]!.id).not.toBe(stare[0]!.id);
  });

  it('zachytí i opravu částky a návrat k předchozímu výsledku', async () => {
    const po = vysledky([EJ_2026_09_08]);
    // Simulovaná oprava používá jinou skutečnou sazbu z fixtury, žádnou smyšlenou částku.
    const oprava = vysledky([{ ...EJ_2026_09_08, poradi: EJ_2026_09_04.poradi }]);
    await oznameni.nacti(po);
    await oznameni.aktualizuj(po, oprava);
    const id = oznameni.neprectene()[0]!.id;
    await oznameni.aktualizuj(oprava, po);
    expect(oznameni.neprectene()[0]!.id).toBeGreaterThan(id);
    expect(oznameni.neprectene()[0]!.castkaKc).toBe(EJ_2026_09_08.poradi.find(p => p.klic === 'V')!.vyseVyhryKc);
  });

  it('archivovaný virtuální tiket dostává další výsledky, odstraněný z evidence zmizí', async () => {
    const t = { ...tiket, archivovany: true, kontrola: { od: tiket.slosovani.prvni, do: null, cenaZaSlosovaniKc: null } };
    const pred = vysledky([EJ_2026_09_04], t), po = vysledky([EJ_2026_09_04, EJ_2026_09_08], t);
    await oznameni.nacti(pred);
    await oznameni.aktualizuj(pred, po);
    expect(oznameni.neprectene()).toHaveLength(1);
    await oznameni.aktualizuj(po, new Map(), [t.id]);
    expect(oznameni.neprectene()).toEqual([]);
  });

  it('uživatelské založení a úprava tiketu oznámení nevytvářejí', async () => {
    const po = vysledky([EJ_2026_09_08]);
    await oznameni.nacti(new Map());
    await oznameni.aktualizuj(new Map(), po, [tiket.id]);
    expect(oznameni.neprectene()).toEqual([]);
    await oznameni.aktualizuj(po, po);
    expect(oznameni.neprectene()).toEqual([]);
  });

  it('chyba zápisu nepotvrdí výsledky a restart dožene přerušené uložení oznámení', async () => {
    const pred = vysledky([]), po = vysledky([EJ_2026_09_08]);
    await oznameni.nacti(pred);
    const zapis = vi.spyOn(uloziste, 'ulozNastaveni').mockRejectedValueOnce(new Error('disk'));
    expect(await oznameni.aktualizuj(pred, po)).toBe(false);
    expect(oznameni.chyba()).not.toBeNull();
    await oznameni.nacti(po);
    expect(oznameni.neprectene()).toHaveLength(1);
    const ids = oznameni.neprectene().map(p => p.id);
    zapis.mockRejectedValueOnce(new Error('disk'));
    expect(await oznameni.potvrdit(ids)).toBe(false);
    expect(oznameni.neprectene()).toHaveLength(1);
    expect(await oznameni.potvrdit(ids)).toBe(true);
    expect(oznameni.neprectene()).toEqual([]);
  });

  it('souběžné potvrzení a změna nastavení nepřepíší nově příchozí výsledky', async () => {
    const pred = vysledky([]), prvni = vysledky([EJ_2026_09_04]), po = vysledky([EJ_2026_09_04, EJ_2026_09_08]);
    await oznameni.nacti(pred);
    await oznameni.aktualizuj(pred, prvni);
    const ids = oznameni.neprectene().map(p => p.id);
    await Promise.all([oznameni.aktualizuj(prvni, po), oznameni.potvrdit(ids), oznameni.nastavDialog(false)]);
    expect(oznameni.neprectene().map(p => p.datum)).toEqual([EJ_2026_09_08.datum]);
    expect(oznameni.dialog()).toBe(false);
  });
});
