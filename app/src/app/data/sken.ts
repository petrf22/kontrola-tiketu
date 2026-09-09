/**
 * Předání naskenovaného sériového čísla mezi obrazovkami.
 *
 * Drží se jen v paměti a po použití se zahazuje — je to průchozí údaj, ne stav aplikace.
 */

import { Injectable, signal } from '@angular/core';
import type { VysledekCteni } from '@kontrola-tiketu/ocr';

@Injectable({ providedIn: 'root' })
export class NaskenovanyTiket {
  private readonly serioveCislo = signal<string | null>(null);

  uloz(cislo: string): void {
    this.serioveCislo.set(cislo);
  }

  /** Vyzvedne a zároveň zapomene. */
  vyzvedni(): string | null {
    const cislo = this.serioveCislo();
    this.serioveCislo.set(null);
    return cislo;
  }
}

/**
 * Naposledy rozpoznaná čísla ze snímku. Stejně jako sériové číslo je to průchozí údaj:
 * formulář si je vyzvedne, zobrazí k potvrzení a tady po nich nic nezůstane.
 */
@Injectable({ providedIn: 'root' })
export class NactenaCisla {
  private readonly cteni = signal<VysledekCteni | null>(null);

  uloz(vysledek: VysledekCteni): void {
    this.cteni.set(vysledek);
  }

  /** Vyzvedne a zároveň zapomene. */
  vyzvedni(): VysledekCteni | null {
    const vysledek = this.cteni();
    this.cteni.set(null);
    return vysledek;
  }
}
