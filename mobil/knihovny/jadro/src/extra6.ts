/**
 * Vyhodnocení Extra 6 — doplňkové hry Eurojackpotu.
 *
 * Pravidlo pořadí je stejné jako u Šance, jen zdroj částek je jiný: výherní listina tabulku
 * Extra 6 nepublikuje, protože výhry jsou stanovené násobkem sázky (herní plán, bod 25).
 * Sazby proto přicházejí zvenčí jako data — v kódu nesmí být.
 */

import type {
  Datum,
  PoradiKoncoveCislice,
  SazbyExtra6,
  TahEurojackpot,
} from './model.js';
import { urciPoradiKoncoveCislice } from './koncoveCislice.js';

export type VyhradaExtra6 =
  /** Sazby pro datum tahu nejsou k dispozici. */
  | 'chybi-sazby'
  /**
   * První pořadí se při více než dvou výhrách dělí: výhra je podíl 2 000 000 Kč a počtu výher
   * (herní plán, bod 25 g). Počet výher v Extra 6 listina neuvádí, takže offline se to
   * spolehlivě spočítat nedá a uvedená částka je horní odhad.
   */
  | 'delene-prvni-poradi';

export interface VysledekExtra6 {
  readonly poradi: PoradiKoncoveCislice | null;
  readonly vyseVyhryKc: number | null;
  /** `null`, pokud je částka jistá. */
  readonly vyhrada: VyhradaExtra6 | null;
}

/** Vybere sazby platné k danému datu — tedy poslední, které začaly platit nejpozději tehdy. */
export function vyberSazby(
  sazby: readonly SazbyExtra6[],
  datum: Datum,
): SazbyExtra6 | null {
  let nejlepsi: SazbyExtra6 | null = null;
  for (const s of sazby) {
    if (s.platnostOd <= datum && (nejlepsi === null || s.platnostOd > nejlepsi.platnostOd)) {
      nejlepsi = s;
    }
  }
  return nejlepsi;
}

export function vyhodnotExtra6(
  kod: string,
  tah: TahEurojackpot,
  sazby: readonly SazbyExtra6[],
): VysledekExtra6 {
  const poradi = urciPoradiKoncoveCislice(kod, tah.extra6);
  if (poradi === null) {
    return { poradi: null, vyseVyhryKc: null, vyhrada: null };
  }

  const platne = vyberSazby(sazby, tah.datum);
  if (platne === null) {
    return { poradi, vyseVyhryKc: null, vyhrada: 'chybi-sazby' };
  }

  return {
    poradi,
    vyseVyhryKc: platne.nasobky[poradi] * platne.sazkaKc,
    vyhrada: poradi === 'sestecisli' ? 'delene-prvni-poradi' : null,
  };
}
