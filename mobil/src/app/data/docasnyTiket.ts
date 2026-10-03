/**
 * Tiket zadaný jen ke kontrole — typicky cizí, který uživatel nechce mít mezi svými.
 *
 * Drží se jen v paměti a nikdy se nedostane do úložiště: proto tenhle modul schválně
 * neimportuje `ULOZISTE` ani `Stav` (hlídá to `test/docasnyTiket.test.ts`). Obrazovka
 * výsledku ho zapomene při odchodu; zavření aplikace ho smaže taky.
 */

import { Injectable, signal } from '@angular/core';
import type { Tiket } from '@kontrola-tiketu/jadro';

@Injectable({ providedIn: 'root' })
export class DocasnyTiket {
  private readonly drzeny = signal<Tiket | null>(null);

  readonly tiket = this.drzeny.asReadonly();

  uloz(tiket: Tiket): void {
    this.drzeny.set(tiket);
  }

  zapomen(): void {
    this.drzeny.set(null);
  }
}
