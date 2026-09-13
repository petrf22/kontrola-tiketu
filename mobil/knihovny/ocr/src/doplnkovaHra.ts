/**
 * Čtení kódu doplňkové hry z tiketu.
 *
 * Z čárového kódu ho vzít nejde — je v šifrovaném bloku a ten se podle zadání neláme.
 * Na tiketu je ale vytištěný, takže ho umí přečíst OCR.
 *
 * Ověřeno na reálném tiketu Eurojackpotu (9. 9. 2026), kde má podobu `Extra 6: 845991`.
 * Popisek Šance u Sportky ověřený není, proto je vzor schválně volnější.
 */

import type { Hra } from '@kontrola-tiketu/jadro';

/** Popisek, za kterým se kód hledá. */
const POPISKY: Readonly<Record<Hra, RegExp>> = {
  eurojackpot: /extra\s*6\s*[:.]?/i,
  sportka: /[šs]ance\s*[:.]?/i,
};

/** Záměny termotisku. Vedoucí nula přečtená jako písmeno O by změnila celý kód. */
const ZAMENY: Readonly<Record<string, string>> = {
  O: '0', o: '0', Q: '0', D: '0',
  I: '1', l: '1', '|': '1', i: '1',
  S: '5', s: '5', B: '8', Z: '2', z: '2', G: '6',
};

/**
 * Šest číslic, které nesousedí s další číslicí.
 *
 * Mezery mezi nimi se připouštějí — rozpoznávač je u monospace tisku občas rozseká.
 * Ohraničení na obou stranách brání tomu, aby se z delšího čísla ukously první šestky.
 */
const SESTICISLI = /(?<![0-9])(?:[0-9][ \t]*){6}(?![0-9])/;

/**
 * Najde kód doplňkové hry v přečtených řádcích, nebo vrátí `null`.
 *
 * Nikdy nehádá: když se šest číslic za popiskem nenajde, vrátí `null` a uživatel kód doplní
 * ručně. Vymyšlený kód by tiše znehodnotil vyhodnocení doplňkové hry.
 */
export function prectiKodDoplnkoveHry(radky: readonly string[], hra: Hra): string | null {
  const popisek = POPISKY[hra];

  for (const radek of radky) {
    const nalez = popisek.exec(radek);
    if (nalez === null) continue;

    // Hledá se jen za popiskem, ať se nesebere něco z jiné části řádku.
    const zbytek = radek.slice(nalez.index + nalez[0].length);
    const opraveny = [...zbytek].map((z) => ZAMENY[z] ?? z).join('');

    const cislice = SESTICISLI.exec(opraveny);
    if (cislice !== null) return cislice[0].replace(/[^0-9]/g, '');
  }

  return null;
}
