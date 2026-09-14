/**
 * Čtení kódu doplňkové hry z tiketu.
 *
 * Z čárového kódu ho vzít nejde — je v šifrovaném bloku a ten se podle zadání neláme.
 * Na tiketu je ale vytištěný, takže ho umí přečíst OCR.
 *
 * Podoba ověřená na tiketech (Eurojackpot 9. 9. 2026, všechny tři hry 14. 9. 2026):
 * `Extra 6:  845991  ANO`, `Šance:  229087  ANO`, `Eurošance:  18546  ANO`.
 */

import { DELKA_KODU_DOPLNKOVE_HRY, type Hra } from '@kontrola-tiketu/jadro';
import { ZAMENY } from './cisla.js';

/**
 * Popisek doplňkové hry. Podle něj se čte kód a pozná i hra (`hra.ts`).
 *
 * Pozor na dvě pasti:
 * - všechny tři tikety mají nahoře reklamu `EXTRA ŠANCE NA VÝHRU S ALLWYN KLUBEM.` — ta nesmí
 *   projít jako Šance ani jako Extra 6,
 * - „Šance“ je obsažená v „Eurošance“ (i rozdělené mezerou) a v „Druhé šanci“.
 */
export const POPISKY_DOPLNKOVE_HRY: Readonly<Record<Hra, RegExp>> = {
  eurojackpot: /(?<!\p{L})extra\s*6\s*[:.]?/iu,
  sportka: /(?<!\p{L})(?<!eur[o0]\s*)(?<!extra\s*)(?<!druh[áa]\s*)[šs]ance(?!\s*na\s)\s*[:.]?/iu,
  euromiliony: /(?<!\p{L})eur[o0]\s*[šs]ance\s*[:.]?/iu,
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
  const popisek = POPISKY_DOPLNKOVE_HRY[hra];
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
