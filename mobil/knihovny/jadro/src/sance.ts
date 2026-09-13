/**
 * Vyhodnocení Šance — samostatného losování, které se sází spolu se Sportkou.
 *
 * Částky jsou dnes pevné, ale nebyly vždy: v roce 2015 bylo první pořadí totalizátorové
 * (2 575 470 Kč) a sedmé pořadí vůbec neexistovalo. Proto se i tady bere částka z listiny
 * konkrétního tahu, ne z herního plánu.
 */

import type { LosovaniSance, PoradiKoncoveCislice } from './model.js';
import { urciPoradiKoncoveCislice } from './koncoveCislice.js';

export interface VysledekSance {
  readonly poradi: PoradiKoncoveCislice | null;
  /** Vylosovaný podřetězec, kterým bylo pořadí získáno. U sousedního čísla `null`. */
  readonly vzor: string | null;
  /**
   * Částka z tabulky tohoto losování. `null` znamená buď nevýherní kód, nebo — pokud je
   * `poradi` vyplněné — že losování dané pořadí nemá. To je legitimní u starších tahů,
   * kde sedmé pořadí ještě neexistovalo.
   */
  readonly vyseVyhryKc: number | null;
}

export function vyhodnotSance(kod: string, losovani: LosovaniSance): VysledekSance {
  const poradi = urciPoradiKoncoveCislice(kod, losovani.cislice);
  if (poradi === null) {
    return { poradi: null, vzor: null, vyseVyhryKc: null };
  }
  const radek = losovani.poradi.find((p) => p.klic === poradi);
  return {
    poradi,
    vzor: radek?.vzor ?? null,
    vyseVyhryKc: radek?.vyseVyhryKc ?? null,
  };
}

/**
 * Rozpozná situaci, kdy pravidla pořadí přiznávají, ale tabulka tahu ho neobsahuje.
 * Sdílené pro všechny hry — signalizuje buď starší pravidla, nebo neúplná vstupní data.
 */
export function chybiVTabulce(vysledek: {
  readonly poradi: string | null;
  readonly vyseVyhryKc: number | null;
}): boolean {
  return vysledek.poradi !== null && vysledek.vyseVyhryKc === null;
}
