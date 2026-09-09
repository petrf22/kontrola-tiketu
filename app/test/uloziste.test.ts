import { describe, expect, it } from 'vitest';
import type { SazbyExtra6, Tah, Tiket } from '@kontrola-tiketu/jadro';
import { UlozisteVPameti, type Uloziste } from '../src/app/data/uloziste.js';
import { EJ_2026_09_01, EJ_2026_09_08 } from '../../packages/jadro/test/fixtures/eurojackpot.js';
import { SP_2026_09_02 } from '../../packages/jadro/test/fixtures/sportka.js';

/**
 * Smlouva úložiště.
 *
 * Tohle musí splnit každá implementace. Zatím se dá spustit jen nad tou paměťovou —
 * šifrovaná běží na SQLCipheru přes nativní plugin a otestovat ji jde až na zařízení.
 * Až k tomu dojde, pustí se sem beze změny.
 */
function smlouvaUloziste(jmeno: string, vyrob: () => Uloziste): void {
  const tiket = (id: string, vlozeno: string): Tiket => ({
    id,
    hra: 'eurojackpot',
    sloupce: [{ hra: 'eurojackpot', cisla: [1, 2, 3, 4, 5], eurocisla: [1, 2] }],
    slosovani: { prvni: '2026-09-08', pocet: 1, dny: null },
    kodDoplnkoveHry: null,
    vlozeno,
  });

  const sazba: SazbyExtra6 = {
    platnostOd: '2025-09-05',
    sazkaKc: 40,
    nasobky: {
      sestecisli: 25000, peticisli: 2500, ctyrcisli: 250, trojcisli: 25,
      dvojcisli: 2.5, 'koncove-cislo': 1.5, 'sousedni-cislo': 1.5,
    },
    zdroj: 'test',
  };

  describe(`smlouva úložiště — ${jmeno}`, () => {
    it('prázdné úložiště vrací prázdné seznamy, ne chybu', async () => {
      const u = vyrob();
      expect(await u.nactiTikety()).toEqual([]);
      expect(await u.nactiTahy()).toEqual([]);
      expect(await u.nactiSazby()).toEqual([]);
    });

    it('uložený tiket se přečte beze změny', async () => {
      const u = vyrob();
      const t = tiket('a', '2026-09-01T10:00:00Z');
      await u.ulozTiket(t);
      expect(await u.nactiTikety()).toEqual([t]);
    });

    it('tikety se řadí od nejnovějšího', async () => {
      const u = vyrob();
      await u.ulozTiket(tiket('stary', '2026-09-01T10:00:00Z'));
      await u.ulozTiket(tiket('novy', '2026-09-05T10:00:00Z'));
      expect((await u.nactiTikety()).map((t) => t.id)).toEqual(['novy', 'stary']);
    });

    it('druhý sken téhož tiketu ho přepíše, nezdvojí', async () => {
      // Klíčem je lokální id ze sériového čísla — právě proto se čte čárový kód.
      const u = vyrob();
      await u.ulozTiket(tiket('stejne-id', '2026-09-01T10:00:00Z'));
      await u.ulozTiket(tiket('stejne-id', '2026-09-02T10:00:00Z'));
      const tikety = await u.nactiTikety();
      expect(tikety).toHaveLength(1);
      expect(tikety[0]?.vlozeno).toBe('2026-09-02T10:00:00Z');
    });

    it('smazání odebere jen svůj tiket', async () => {
      const u = vyrob();
      await u.ulozTiket(tiket('a', '2026-09-01T10:00:00Z'));
      await u.ulozTiket(tiket('b', '2026-09-02T10:00:00Z'));
      await u.smazTiket('a');
      expect((await u.nactiTikety()).map((t) => t.id)).toEqual(['b']);
    });

    it('smazání neexistujícího tiketu není chyba', async () => {
      const u = vyrob();
      await expect(u.smazTiket('neexistuje')).resolves.toBeUndefined();
    });

    it('tahy se uloží a přečtou', async () => {
      const u = vyrob();
      const tahy: Tah[] = [EJ_2026_09_01, SP_2026_09_02, EJ_2026_09_08];
      await u.ulozTahy(tahy);
      expect(await u.nactiTahy()).toHaveLength(3);
    });

    it('uložení prázdného seznamu tahů projde', async () => {
      const u = vyrob();
      await expect(u.ulozTahy([])).resolves.toBeUndefined();
    });

    it('sazby se uloží a přečtou', async () => {
      const u = vyrob();
      await u.ulozSazby([sazba]);
      expect(await u.nactiSazby()).toEqual([sazba]);
    });

    it('čtení nevrací odkaz na vnitřní stav — změna venku nic nerozbije', async () => {
      const u = vyrob();
      await u.ulozTahy([EJ_2026_09_01]);
      const prvni = await u.nactiTahy();
      prvni.length = 0;
      expect(await u.nactiTahy()).toHaveLength(1);
    });
  });
}

smlouvaUloziste('v paměti', () => new UlozisteVPameti());
