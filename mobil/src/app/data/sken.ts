/**
 * Předání naskenovaného sériového čísla mezi obrazovkami.
 *
 * Drží se jen v paměti a po použití se zahazuje — je to průchozí údaj, ne stav aplikace.
 */

import { Injectable, signal } from '@angular/core';
import type { Hra } from '@kontrola-tiketu/jadro';
import type { VysledekCteni } from '@kontrola-tiketu/ocr';

@Injectable({ providedIn: 'root' })
export class NaskenovanyTiket {
  private readonly serioveCislo = signal<string | null>(null);
  private readonly hra = signal<Hra | null>(null);

  /** Hra je z hlavičky kódu; `null`, když ji kód neurčil. */
  uloz(cislo: string, hra: Hra | null): void {
    this.serioveCislo.set(cislo);
    this.hra.set(hra);
  }

  /**
   * Přečte, ale nezapomene.
   *
   * Uživatel může ze skenu kódu odejít vyfotit čísla a vrátit se — sériové číslo musí cestu
   * přežít, jinak by o něj přišel a tiket by dostal náhradní identifikátor.
   */
  precti(): string | null {
    return this.serioveCislo();
  }

  /** Hra z čárového kódu. Formulář ji nabídne, když nepřišel výsledek z fotky. */
  prectiHru(): Hra | null {
    return this.hra();
  }

  /** Zavolat po uložení tiketu. Průchozí údaj nemá přežívat déle, než je potřeba. */
  zapomen(): void {
    this.serioveCislo.set(null);
    this.hra.set(null);
  }
}

/**
 * Naposledy rozpoznaná čísla ze snímku. Stejně jako sériové číslo je to průchozí údaj:
 * formulář si je vyzvedne, zobrazí k potvrzení a tady po nich nic nezůstane.
 */
@Injectable({ providedIn: 'root' })
export class NactenaCisla {
  private readonly nacteno = signal<NactenyTiket | null>(null);

  /** `hraPodle` říká, čím se hra poznala — nebo že ji zvolil uživatel. Jen pro diagnostiku. */
  uloz(cteni: VysledekCteni, hraPodle: readonly string[]): void {
    this.nacteno.set({ cteni, hraPodle });
  }

  /** Vyzvedne a zároveň zapomene. */
  vyzvedni(): NactenyTiket | null {
    const vysledek = this.nacteno();
    this.nacteno.set(null);
    return vysledek;
  }
}

export interface NactenyTiket {
  readonly cteni: VysledekCteni;
  readonly hraPodle: readonly string[];
}
