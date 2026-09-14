/**
 * Čtení kódu doplňkové hry z tiketu.
 *
 * Z čárového kódu ho vzít nejde — je v šifrovaném bloku a ten se podle zadání neláme.
 * Na tiketu je ale vytištěný, takže ho umí přečíst OCR.
 *
 * Ověřeno na reálném tiketu Eurojackpotu (9. 9. 2026), kde má podobu `Extra 6: 845991`.
 * Popisky Šance u Sportky a Eurošance u Euromilionů ověřené nejsou, proto jsou vzory
 * schválně volnější.
 */

import { DELKA_KODU_DOPLNKOVE_HRY, type Hra } from '@kontrola-tiketu/jadro';
import { ZAMENY } from './cisla.js';

/**
 * Popisek, za kterým se kód hledá.
 *
 * Eurošance musí mít předponu „euro“: tiket Euromilionů může nést i pětimístný kód Druhé šance,
 * a ten se s Eurošancí zaměnit nesmí.
 */
const POPISKY: Readonly<Record<Hra, RegExp>> = {
  eurojackpot: /extra\s*6\s*[:.]?/i,
  sportka: /[šs]ance\s*[:.]?/i,
  euromiliony: /euro\s*[šs]ance\s*[:.]?/i,
};


/**
 * Právě `delka` číslic, které nesousedí s další číslicí.
 *
 * Mezery mezi nimi se připouštějí — rozpoznávač je u monospace tisku občas rozseká.
 * Ohraničení na obou stranách brání tomu, aby se z delšího čísla ukously první číslice.
 */
function vzorKodu(delka: number): RegExp {
  return new RegExp(`(?<![0-9])(?:[0-9][ \\t]*){${delka}}(?![0-9])`);
}

/**
 * Najde kód doplňkové hry v přečtených řádcích, nebo vrátí `null`.
 *
 * Nikdy nehádá: když se kód správné délky za popiskem nenajde, vrátí `null` a uživatel ho doplní
 * ručně. Vymyšlený kód by tiše znehodnotil vyhodnocení doplňkové hry.
 */
export function prectiKodDoplnkoveHry(radky: readonly string[], hra: Hra): string | null {
  const popisek = POPISKY[hra];
  const kod = vzorKodu(DELKA_KODU_DOPLNKOVE_HRY[hra]);

  for (const radek of radky) {
    const nalez = popisek.exec(radek);
    if (nalez === null) continue;

    // Hledá se jen za popiskem, ať se nesebere něco z jiné části řádku.
    const zbytek = radek.slice(nalez.index + nalez[0].length);
    const opraveny = [...zbytek].map((z) => ZAMENY[z] ?? z).join('');

    const cislice = kod.exec(opraveny);
    if (cislice !== null) return cislice[0].replace(/[^0-9]/g, '');
  }

  return null;
}
