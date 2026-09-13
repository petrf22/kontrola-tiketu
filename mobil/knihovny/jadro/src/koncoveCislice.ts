/**
 * Pravidlo koncových číslic, společné pro Šanci (Sportka) i Extra 6 (Eurojackpot).
 *
 * Obě doplňkové hry se vyhodnocují stejně: porovnává se koncové šestičíslí sázenky
 * s vylosovaným šestičíslím a rozhoduje délka shodného konce. Sedmé pořadí je zvláštní —
 * získá ho ten, kdo koncové číslo netrefil, ale trefil některé z jeho sousedních čísel.
 *
 * Herní plán, Sportka bod 13 a Eurojackpot bod 13.
 */

import type { PoradiKoncoveCislice } from './model.js';

/** Délka shodného konce → pořadí. Index odpovídá počtu shodných číslic. */
const PODLE_DELKY: readonly (PoradiKoncoveCislice | null)[] = [
  null,
  'koncove-cislo',
  'dvojcisli',
  'trojcisli',
  'ctyrcisli',
  'peticisli',
  'sestecisli',
];

/** Vrátí, kolik číslic od konce se shoduje. */
export function delkaShodnehoKonce(sazenka: string, vylosovane: string): number {
  const max = Math.min(sazenka.length, vylosovane.length);
  let shoda = 0;
  while (
    shoda < max &&
    sazenka[sazenka.length - 1 - shoda] === vylosovane[vylosovane.length - 1 - shoda]
  ) {
    shoda++;
  }
  return shoda;
}

/**
 * Sousední čísla ke koncovému číslu jsou čísla o jednu vyšší a nižší, cyklicky:
 * k nule patří 1 a 9, k devítce 8 a 0 (herní plán, bod 2).
 */
export function sousedniCislice(cislice: string): [string, string] {
  const d = Number(cislice);
  return [String((d + 1) % 10), String((d + 9) % 10)];
}

/**
 * Určí výherní pořadí doplňkové hry, nebo `null`.
 *
 * Vyplácí se pouze nejvyšší dosažené pořadí; protože se pořadí určuje délkou shodného konce,
 * vychází to samo — delší shoda vždy přebije kratší.
 */
export function urciPoradiKoncoveCislice(
  sazenka: string,
  vylosovane: string,
): PoradiKoncoveCislice | null {
  const shoda = delkaShodnehoKonce(sazenka, vylosovane);
  if (shoda > 0) {
    return PODLE_DELKY[Math.min(shoda, PODLE_DELKY.length - 1)] ?? null;
  }

  const koncoveSazenky = sazenka.at(-1);
  const koncoveVylosovane = vylosovane.at(-1);
  if (koncoveSazenky === undefined || koncoveVylosovane === undefined) return null;

  return sousedniCislice(koncoveSazenky).includes(koncoveVylosovane) ? 'sousedni-cislo' : null;
}
