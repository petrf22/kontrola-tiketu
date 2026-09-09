/**
 * Stav aplikace nad úložištěm.
 *
 * Drží tikety, tahy a sazby, umí je uložit a vyhodnotit. Obrazovky se tak nemusí starat
 * o pořadí operací ani o slučování importů.
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
import { ULOZISTE } from './tokeny.js';
import { nactiVysledky, shrnutiImportu, type VysledekImportu } from './import.js';

@Injectable({ providedIn: 'root' })
export class Stav {
  private readonly uloziste = inject(ULOZISTE);

  readonly tikety = signal<readonly Tiket[]>([]);
  readonly tahy = signal<readonly Tah[]>([]);
  readonly sazby = signal<readonly SazbyExtra6[]>([]);
  readonly nacteno = signal(false);

  /** Do kdy má aplikace výsledky. Uživatel tak ví, jestli má smysl něco doimportovat. */
  readonly vysledkyDo = computed(() => this.tahy().at(-1)?.datum ?? null);

  async nacti(): Promise<void> {
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

    const slouceno = sloucTahy(this.tahy(), vysledek.tahy);
    await this.uloziste.ulozTahy(slouceno);
    this.tahy.set(slouceno);

    if (vysledek.sazbyExtra6.length > 0) {
      await this.uloziste.ulozSazby(vysledek.sazbyExtra6);
      this.sazby.set(vysledek.sazbyExtra6);
    }

    return { uspech: true, zprava: shrnutiImportu(vysledek) };
  }

  vyhodnot(tiket: Tiket): VysledekTiketu {
    return vyhodnotTiket(tiket, this.tahy(), this.sazby());
  }
}
