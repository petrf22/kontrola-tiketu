/**
 * Předání naskenovaného sériového čísla mezi obrazovkami.
 *
 * Drží se jen v paměti a po použití se zahazuje — je to průchozí údaj, ne stav aplikace.
 */

import { Injectable, signal } from '@angular/core';

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
