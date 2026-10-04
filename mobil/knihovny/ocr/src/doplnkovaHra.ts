/**
 * Čtení kódu doplňkové hry z tiketu.
 *
 * Z čárového kódu ho vzít nejde — je v šifrovaném bloku a ten se podle zadání neláme.
 * Na tiketu je ale vytištěný, takže ho umí přečíst OCR.
 *
 * Podoba ověřená na tiketech (Eurojackpot 9. 9. 2026, všechny tři hry 14. 9. 2026):
 * `Extra 6:  845991  ANO`, `Šance:  229087  ANO`, `Eurošance:  18546  ANO`.
 *
 * Kód je vytištěný vždy. Jestli se doplňková hra vsadila, říká až `ANO`/`NE` na konci řádku —
 * kód tiketu s `NE` se nesmí vyplnit, jinak by aplikace hlásila výhry, které nejsou.
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

/** Co se o doplňkové hře přečetlo z tiketu. */
export interface DoplnkovaHraZTiketu {
  /** Kód, nebo `null`, když se nenašel nebo je na tiketu `NE`. */
  readonly kod: string | null;
  /** `true` = `ANO`, `false` = `NE`, `null` = nepřečetlo se. */
  readonly vsazena: boolean | null;
}

/** `ANO` se připouští i s nulou místo O — tak ho rozpoznávač občas přečte. */
const ANO = /(?<!\p{L})an[o0](?!\p{L})/iu;
const NE = /(?<!\p{L})ne(?!\p{L})/iu;

/**
 * Najde kód doplňkové hry a údaj, zda byla vsazena.
 *
 * Nikdy nehádá: když se kód správné délky za popiskem nenajde, vrátí `kod: null` a uživatel ho
 * doplní ručně. Vymyšlený kód by tiše znehodnotil vyhodnocení doplňkové hry. `ANO`/`NE` se hledá
 * jen za kódem — před ním na řádku nic takového není.
 */
export function prectiDoplnkovouHru(radky: readonly string[], hra: Hra): DoplnkovaHraZTiketu {
  const popisek = POPISKY_DOPLNKOVE_HRY[hra];
  const kod = vzorKodu(DELKA_KODU_DOPLNKOVE_HRY[hra]);

  for (const radek of radky) {
    const nalez = popisek.exec(radek);
    if (nalez === null) continue;

    // Hledá se jen za popiskem, ať se nesebere něco z jiné části řádku.
    const zbytek = radek.slice(nalez.index + nalez[0].length);
    const opraveny = zbytek.replace(/./gsu, (z) => ZAMENY[z] ?? z);

    const cislice = kod.exec(opraveny);
    if (cislice === null) continue;

    // Záměny jsou znak za znak, takže pozice v opraveném i původním zbytku sedí.
    const zaKodem = zbytek.slice(cislice.index + cislice[0].length);
    const vsazena = ANO.test(zaKodem) ? true : NE.test(zaKodem) ? false : null;

    return { kod: vsazena === false ? null : cislice[0].replace(/[^0-9]/g, ''), vsazena };
  }

  return { kod: null, vsazena: null };
}

/** Jen kód doplňkové hry — `null` i tehdy, když je na tiketu `NE`. */
export function prectiKodDoplnkoveHry(radky: readonly string[], hra: Hra): string | null {
  return prectiDoplnkovouHru(radky, hra).kod;
}
