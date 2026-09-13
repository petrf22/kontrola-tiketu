/**
 * Vyhodnocení Eurošance — doplňkové hry Euromilionů.
 *
 * Shoda se určuje stejně jako u Šance a Extra 6, délkou shodného konce, jen nad pěti číslicemi
 * (herní plán, Euromiliony bod 10). Dvě odchylky: Eurošance nezná sousední číslo a výhry jsou
 * pevné (bod 16), takže přicházejí zvenčí jako data — listina je nepublikuje.
 */

import type { PoradiEurosance, SazbyEurosance, TahEuromiliony } from './model.js';
import { urciPoradiKoncoveCislice } from './koncoveCislice.js';
import { vyberSazby } from './extra6.js';

/** Sazby pro datum tahu nejsou k dispozici. */
export type VyhradaEurosance = 'chybi-sazby';

export interface VysledekEurosance {
  readonly poradi: PoradiEurosance | null;
  readonly vyseVyhryKc: number | null;
  /** `null`, pokud je částka jistá. */
  readonly vyhrada: VyhradaEurosance | null;
}

/** Určí pořadí Eurošance, nebo `null`. Vyplácí se jen nejvyšší výhra (bod 17). */
export function urciPoradiEurosance(kod: string, vylosovane: string): PoradiEurosance | null {
  const poradi = urciPoradiKoncoveCislice(kod, vylosovane);
  // Sousední číslo je pořadí Šance a Extra 6, v Eurošanci nevyhrává. Šestičíslí u pěti
  // číslic nastat nemůže, ale typ to neví.
  return poradi === null || poradi === 'sousedni-cislo' || poradi === 'sestecisli' ? null : poradi;
}

export function vyhodnotEurosance(
  kod: string,
  tah: TahEuromiliony,
  sazby: readonly SazbyEurosance[],
): VysledekEurosance {
  const poradi = urciPoradiEurosance(kod, tah.eurosance);
  if (poradi === null) {
    return { poradi: null, vyseVyhryKc: null, vyhrada: null };
  }

  const platne = vyberSazby(sazby, tah.datum);
  if (platne === null) {
    return { poradi, vyseVyhryKc: null, vyhrada: 'chybi-sazby' };
  }
  return { poradi, vyseVyhryKc: platne.vyhryKc[poradi], vyhrada: null };
}
