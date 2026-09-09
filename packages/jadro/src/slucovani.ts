/**
 * Slučování tahů z různých zdrojů.
 *
 * Potřebuje to fetcher při skládání výstupu i aplikace při importu dalšího souboru.
 * Klíčem je dvojice hra a datum — číslo tahu výherní listina neuvádí a jeden den se může
 * losovat víc her.
 */

import type { Tah } from './model.js';

/** Seřadí tahy chronologicky a zahodí duplicity. Při duplicitě vítězí pozdější záznam. */
export function serad(tahy: readonly Tah[]): Tah[] {
  const podleKlice = new Map<string, Tah>();
  for (const tah of tahy) {
    podleKlice.set(`${tah.hra}|${tah.datum}`, tah);
  }
  return [...podleKlice.values()].sort(
    (a, b) => a.datum.localeCompare(b.datum) || a.hra.localeCompare(b.hra),
  );
}

/**
 * Sloučí dosud známé tahy s nově naimportovanými.
 *
 * Novější import přepíše starší záznam téhož tahu. Je to úmyslné: opravená listina má
 * přednost před tou, kterou uživatel naimportoval dřív.
 */
export function sloucTahy(znamé: readonly Tah[], nove: readonly Tah[]): Tah[] {
  return serad([...znamé, ...nove]);
}
