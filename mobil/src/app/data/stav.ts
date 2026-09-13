/**
 * Stav aplikace nad úložištěm.
 *
 * Drží tikety, tahy a sazby, umí je uložit a vyhodnotit. Obrazovky se tak nemusí starat
 * o pořadí operací ani o slučování importů a stažení.
 */

import { Injectable, computed, inject, signal } from '@angular/core';
import {
  sloucTahy,
  vyhodnotTiket,
  type SazbyExtra6,
  type Tah,
  type Tiket,
  type VysledekTiketu,
} from '@kontrola-tiketu/jadro';
import { maTrvaleUloziste, SIT, ULOZISTE } from './tokeny.js';
import { nactiVysledky, shrnutiImportu, type VysledekImportu } from './import.js';
import { stahniVysledky, type KontrolaServeru } from './stahovani.js';
import { shrnutiStazeni, zpracujStazene } from './vysledkyZeServeru.js';

export interface Zprava {
  readonly uspech: boolean;
  readonly zprava: string;
}

@Injectable({ providedIn: 'root' })
export class Stav {
  private readonly uloziste = inject(ULOZISTE);
  private readonly sit = inject(SIT);

  readonly tikety = signal<readonly Tiket[]>([]);
  readonly tahy = signal<readonly Tah[]>([]);
  readonly sazby = signal<readonly SazbyExtra6[]>([]);
  readonly nacteno = signal(false);

  /** Proč se úložiště nepodařilo otevřít. `null`, když je všechno v pořádku. */
  readonly chybaUloziste = signal<string | null>(null);

  /** Uloží se data doopravdy, nebo jen do paměti do zavření aplikace? */
  readonly trvaleUloziste = maTrvaleUloziste();

  /** Do kdy má aplikace výsledky. Uživatel tak ví, jestli má smysl něco doimportovat. */
  readonly vysledkyDo = computed(() => this.tahy().at(-1)?.datum ?? null);

  /** Právě se stahují výsledky ze serveru. */
  readonly stahuje = signal(false);

  /** Co server hlásil o poslední kontrole losování. `null`, dokud se stažení nepovedlo. */
  readonly kontrolaServeru = signal<KontrolaServeru | null>(null);

  /** Jak dopadl poslední pokus o stažení — pro obrazovku výsledků. */
  readonly posledniStazeni = signal<Zprava | null>(null);

  async nacti(): Promise<void> {
    try {
      await this.uloziste.pripoj?.();
    } catch (chyba) {
      this.chybaUloziste.set(
        `Nepodařilo se otevřít šifrovanou databázi: ${chyba instanceof Error ? chyba.message : String(chyba)}`,
      );
      this.nacteno.set(true);
      return;
    }

    const [tikety, tahy, sazby] = await Promise.all([
      this.uloziste.nactiTikety(),
      this.uloziste.nactiTahy(),
      this.uloziste.nactiSazby(),
    ]);
    this.tikety.set(tikety);
    this.tahy.set(tahy);
    this.sazby.set(sazby);
    this.nacteno.set(true);
  }

  async ulozTiket(tiket: Tiket): Promise<void> {
    await this.uloziste.ulozTiket(tiket);
    this.tikety.set(await this.uloziste.nactiTikety());
  }

  async smazTiket(id: string): Promise<void> {
    await this.uloziste.smazTiket(id);
    this.tikety.set(await this.uloziste.nactiTikety());
  }

  /**
   * Naimportuje soubor s výsledky. Vrací větu pro uživatele — ať už se povedlo, nebo ne.
   */
  async importuj(text: string): Promise<{ uspech: boolean; zprava: string }> {
    const vysledek: VysledekImportu = nactiVysledky(text);
    if (vysledek.stav === 'chyba') {
      return { uspech: false, zprava: vysledek.duvod };
    }

    // Do úložiště jen nové tahy — úložiště je doplní, nemusí přepisovat celý seznam.
    await this.uloziste.ulozTahy(vysledek.tahy);
    this.tahy.set(sloucTahy(this.tahy(), vysledek.tahy));

    if (vysledek.sazbyExtra6.length > 0) {
      await this.uloziste.ulozSazby(vysledek.sazbyExtra6);
      this.sazby.set(vysledek.sazbyExtra6);
    }

    return { uspech: true, zprava: shrnutiImportu(vysledek) };
  }

  /**
   * Stáhne ze serveru všechny balíky výsledků, které se od minula změnily.
   *
   * Spouští se po otevření aplikace a tlačítkem na obrazovce výsledků. Selhání je běžný
   * stav — telefon bývá offline — a nesmí rozbít nic, co už aplikace má.
   */
  async stahniVysledky(): Promise<Zprava> {
    if (this.chybaUloziste() !== null) {
      return this.zapis({ uspech: false, zprava: 'Bez databáze se výsledky nemají kam uložit.' });
    }
    if (this.stahuje()) return { uspech: false, zprava: 'Stahování už běží.' };

    this.stahuje.set(true);
    try {
      const stazeno = await stahniVysledky(this.sit, await this.uloziste.nactiHashe());
      if (stazeno.stav === 'chyba') return this.zapis({ uspech: false, zprava: stazeno.duvod });

      const zpracovano = zpracujStazene(this.tahy(), stazeno.nove);
      if (zpracovano.stav === 'chyba') return this.zapis({ uspech: false, zprava: zpracovano.duvod });

      for (const balik of zpracovano.baliky) {
        await this.uloziste.ulozTahy(balik.tahy);
        if (balik.sazbyExtra6.length > 0) {
          await this.uloziste.ulozSazby(balik.sazbyExtra6);
          this.sazby.set(balik.sazbyExtra6);
        }
        // Hash až po datech: kdyby aplikace mezitím spadla, balík se příště stáhne znovu.
        await this.uloziste.ulozHash(balik.soubor, balik.hash);
        this.tahy.set(sloucTahy(this.tahy(), balik.tahy));
      }

      this.kontrolaServeru.set(stazeno.manifest.kontrola);
      return this.zapis({ uspech: true, zprava: shrnutiStazeni(zpracovano.pribylo, zpracovano.zmeneno) });
    } catch (chyba) {
      return this.zapis({
        uspech: false,
        zprava: `Výsledky se nepodařilo uložit: ${chyba instanceof Error ? chyba.message : String(chyba)}`,
      });
    } finally {
      this.stahuje.set(false);
    }
  }

  private zapis(zprava: Zprava): Zprava {
    this.posledniStazeni.set(zprava);
    return zprava;
  }

  vyhodnot(tiket: Tiket): VysledekTiketu {
    return vyhodnotTiket(tiket, this.tahy(), this.sazby());
  }
}
