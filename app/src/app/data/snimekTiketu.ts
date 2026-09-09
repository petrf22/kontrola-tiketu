/**
 * Pořízení a rozpoznání snímku tiketu.
 *
 * !!! ODCHYLKA OD PŮVODNÍHO ZADÁNÍ, vědomá a odsouhlasená.
 *
 * Zadání původně žádalo, aby se snímky zpracovávaly jen ve streamu a nikdy se neukládaly
 * ani do cache. Dostupný plugin ML Kitu ale umí jen `processImage({ path })`, tedy potřebuje
 * soubor na disku. Rozhodnutí padlo povolit dočasný soubor v privátní cache aplikace.
 * Podrobnosti a zamítnuté varianty jsou v docs/ocr-a-carovy-kod.md.
 *
 * Z toho plyne jediná věc, na které tady záleží: **soubor musí zmizet vždy.** Při úspěchu,
 * při chybě rozpoznávání i při výjimce. Proto je celý postup v jedné funkci s `finally`
 * a s vyměnitelnými závislostmi, aby na to šel napsat test.
 */

import type { Hra } from '@kontrola-tiketu/jadro';
import { prectiTiket, zMlKit, type MlKitVysledek, type VysledekCteni } from '@kontrola-tiketu/ocr';

/** Pořídí snímek a vrátí cestu k dočasnému souboru. */
export type Porizovac = () => Promise<string>;

/** Rozpozná text ve snímku na dané cestě. */
export type Rozpoznavac = (cesta: string) => Promise<MlKitVysledek>;

/** Smaže dočasný soubor. Nesmí vyhodit výjimku, která by zakryla tu původní. */
export type Uklizec = (cesta: string) => Promise<void>;

export interface Zavislosti {
  readonly poriz: Porizovac;
  readonly rozpoznej: Rozpoznavac;
  readonly ukliď: Uklizec;
}

export interface VysledekSnimku {
  readonly cteni: VysledekCteni;
  /** Cesta k souboru, který byl mezitím smazán. Jen pro záznam v logu při ladění. */
  readonly docasnySoubor: string;
}

/**
 * Pořídí snímek, přečte z něj tiket a dočasný soubor po sobě uklidí.
 *
 * Úklid běží i tehdy, když rozpoznávání selže. To je celý smysl téhle funkce — kdyby se
 * volalo napřímo z obrazovky, stačila by jedna neošetřená cesta a snímek tiketu by zůstal
 * ležet na disku.
 */
export async function nactiTiketZeSnimku(
  hra: Hra,
  zavislosti: Zavislosti,
): Promise<VysledekSnimku> {
  const cesta = await zavislosti.poriz();
  try {
    const vysledek = await zavislosti.rozpoznej(cesta);
    return { cteni: prectiTiket(zMlKit(vysledek), hra), docasnySoubor: cesta };
  } finally {
    // Selhání úklidu se nesmí propsat ven místo původní chyby — jinak by se ztratil důvod,
    // proč rozpoznávání selhalo. Zaznamená se a jde se dál.
    await zavislosti.ukliď(cesta).catch(() => undefined);
  }
}
