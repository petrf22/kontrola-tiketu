/**
 * Sestavení JSON souboru, který se importuje do aplikace.
 *
 * Formát je verzovaný, aby aplikace poznala soubor od staršího fetcheru a řekla to,
 * místo aby ho tiše přečetla špatně.
 */

import type { SazbyExtra6, Tah } from '@kontrola-tiketu/jadro';
import { serad, VERZE_FORMATU } from '@kontrola-tiketu/jadro';
import { formatujTyden, type Tyden } from './obdobi.js';
import { ZAKLADNI_URL } from './zdroje/allwyn-vyherka.js';

// Slučování tahů žije v jádře — potřebuje ho i aplikace při importu dalšího souboru.
export { serad };

export interface VystupniSoubor {
  readonly verzeFormatu: number;
  readonly vygenerovano: string;
  readonly zdroj: string;
  readonly obdobi: { readonly od: string; readonly do: string } | null;
  readonly sazbyExtra6: readonly SazbyExtra6[];
  readonly tahy: readonly Tah[];
}

export function sestavVystup(
  tahy: readonly Tah[],
  sazbyExtra6: readonly SazbyExtra6[],
  obdobi: { od: Tyden; do: Tyden } | null,
  vygenerovano: Date = new Date(),
): VystupniSoubor {
  return {
    verzeFormatu: VERZE_FORMATU,
    vygenerovano: vygenerovano.toISOString(),
    zdroj: ZAKLADNI_URL,
    obdobi:
      obdobi === null
        ? null
        : { od: formatujTyden(obdobi.od), do: formatujTyden(obdobi.do) },
    sazbyExtra6,
    tahy: serad(tahy),
  };
}
