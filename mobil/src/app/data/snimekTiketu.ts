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
import {
  prectiCarovyKod,
  prectiTiket,
  rozpoznejHru,
  slozRadky,
  zMlKit,
  type MlKitVysledek,
  type PrectenyKod,
  type RozpoznanaHra,
  type VysledekCteni,
} from '@kontrola-tiketu/ocr';

/** Pořídí snímek a vrátí cestu k dočasnému souboru. */
export type Porizovac = () => Promise<string>;

/** Rozpozná text ve snímku na dané cestě. */
export type Rozpoznavac = (cesta: string) => Promise<MlKitVysledek>;

/**
 * Přečte čárové kódy z téhož snímku.
 *
 * Popisuje se strukturálně, protože z celého výsledku čtečky nás zajímají jen bajty.
 */
export type CtenarKodu = (cesta: string) => Promise<readonly { readonly bytes?: number[] }[]>;

/** Smaže dočasný soubor. Nesmí vyhodit výjimku, která by zakryla tu původní. */
export type Uklizec = (cesta: string) => Promise<void>;

export interface Zavislosti {
  readonly poriz: Porizovac;
  readonly rozpoznej: Rozpoznavac;
  readonly prectiKody: CtenarKodu;
  readonly ukliď: Uklizec;
}

export interface VysledekSnimku {
  /** Hra poznaná z tiketu, nebo `null` s tím, co si odporovalo — pak ji volí uživatel. */
  readonly hra: RozpoznanaHra;
  /** Přečtený tiket, když je hra určená. Jinak `null` a přečte se přes `prectiJako`. */
  readonly cteni: VysledekCteni | null;
  /**
   * Přečte tentýž snímek jako zvolenou hru — bez dalšího focení. Drží jen rozpoznaný text
   * v paměti; soubor se snímkem je v tu chvíli dávno smazaný.
   */
  readonly prectiJako: (hra: Hra) => VysledekCteni;
  /** Je na snímku aspoň jeden sloupec? Na hře to nezávisí — řádek sloupce poznají všechny stejně. */
  readonly maSloupce: boolean;
  /**
   * Sériové číslo z čárového kódu na témže snímku, nebo `null`, když se kód nenašel.
   *
   * Skenovat kód zvlášť je zbytečné — na tiketu je hned pod čísly, takže když je vidět
   * celý tiket, je vidět i on.
   */
  readonly serioveCislo: string | null;
  /** Cesta k souboru, který byl mezitím smazán. Jen pro záznam v logu při ladění. */
  readonly docasnySoubor: string;
}

/**
 * Přečte první kód, který dává smysl — sériové číslo a hru z hlavičky.
 *
 * Selhání se polyká záměrně: fotka nemusí kód zachytit a to není důvod zahodit přečtená
 * čísla. Uživatel pak sériové číslo doplní naskenováním kódu zvlášť.
 */
async function zkusPrecistKod(
  cesta: string,
  prectiKody: CtenarKodu,
): Promise<PrectenyKod | null> {
  try {
    for (const kod of await prectiKody(cesta)) {
      if (kod.bytes === undefined || kod.bytes.length === 0) continue;
      try {
        // Bajty přicházejí jako znaménkové Java hodnoty, proto maskování.
        return prectiCarovyKod(Uint8Array.from(kod.bytes, (b) => b & 0xff));
      } catch {
        continue; // cizí kód na snímku, zkusíme další
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Pořídí snímek, přečte z něj tiket a dočasný soubor po sobě uklidí.
 *
 * Úklid běží i tehdy, když rozpoznávání selže. To je celý smysl téhle funkce — kdyby se
 * volalo napřímo z obrazovky, stačila by jedna neošetřená cesta a snímek tiketu by zůstal
 * ležet na disku.
 */
export async function nactiTiketZeSnimku(zavislosti: Zavislosti): Promise<VysledekSnimku> {
  const cesta = await zavislosti.poriz();
  try {
    const utrzky = zMlKit(await zavislosti.rozpoznej(cesta));
    const kod = await zkusPrecistKod(cesta, zavislosti.prectiKody);

    const hra = rozpoznejHru(
      slozRadky(utrzky).map((r) => r.text),
      kod?.hra ?? null,
    );
    const prectiJako = (zvolena: Hra) => prectiTiket(utrzky, zvolena);
    const cteni = hra.hra === null ? null : prectiJako(hra.hra);

    return {
      hra,
      cteni,
      prectiJako,
      maSloupce: (cteni ?? prectiJako('eurojackpot')).sloupce.length > 0,
      serioveCislo: kod?.serioveCislo ?? null,
      docasnySoubor: cesta,
    };
  } finally {
    // Selhání úklidu se nesmí propsat ven místo původní chyby — jinak by se ztratil důvod,
    // proč rozpoznávání selhalo. Zaznamená se a jde se dál.
    await zavislosti.ukliď(cesta).catch(() => undefined);
  }
}
