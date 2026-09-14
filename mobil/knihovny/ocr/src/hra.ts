/**
 * Rozpoznání hry z tiketu.
 *
 * Podklady jsou tři tikety vyfocené 14. 9. 2026 a čárové kódy z nich. Hru prozrazuje víc věcí
 * najednou — bajt hlavičky čárového kódu, popisek doplňkové hry, logo, dny v hlavičce a pomlčka
 * ve sloupci Euromilionů. Každá z nich se dá přečíst špatně, proto se žádné nevěří slepě:
 * každý nalezený signál **zužuje množinu kandidátů** a hra se určí, jen když zbude právě jedna.
 *
 * Rozpor mezi signály ani jejich absence se nedomýšlí. Výsledek je pak `null` a hru zvolí
 * uživatel — špatně určená hra by čísla ve sloupci rozdělila jinak (5+2 × 6 × 7+1).
 */

import { DNY_LOSOVANI, type Hra } from '@kontrola-tiketu/jadro';
import { POPISKY_DOPLNKOVE_HRY } from './doplnkovaHra.js';
import { prectiHlavicku } from './tiket.js';

export interface RozpoznanaHra {
  /** Určená hra, nebo `null`, když signály chybí nebo si odporují. */
  readonly hra: Hra | null;
  /** Čím se hra poznala (nebo co si odporovalo) — krátké popisky pro diagnostiku. */
  readonly podle: readonly string[];
}

const VSECHNY: readonly Hra[] = ['eurojackpot', 'sportka', 'euromiliony'];

/**
 * Název hry z loga. Loga jsou grafická, takže vzory snesou pár znaků navíc: Eurojackpot je
 * tečkovaným písmem, Sportka má místo „o“ míč a Euromiliony stylizované „i“.
 */
const NAZVY: readonly { readonly hra: Hra; readonly vzor: RegExp }[] = [
  { hra: 'eurojackpot', vzor: /eur[o0]\s*jack\s*p\W?[o0]t/i },
  { hra: 'sportka', vzor: /(?<!\p{L})sp.{0,3}rtka/iu },
  { hra: 'euromiliony', vzor: /eur[o0]\s*mil.{0,2}[o0]ny/i },
];

const NAZVY_DOPLNKOVYCH_HER: Readonly<Record<Hra, string>> = {
  eurojackpot: 'Extra 6',
  sportka: 'Šance',
  euromiliony: 'Eurošance',
};

/**
 * Pomlčka mezi čísly sloupce — tiskne ji jen Euromiliony před číslem z druhého osudí
 * (`1: 01 07 15 22 23 25 29  -  05 NT`). Vyžaduje pořadí s dvojtečkou a několik dvojic před
 * pomlčkou, aby neprošel rozsah dat z hlavičky (`15.09.2026 - 26.09.2026`).
 */
const POMLCKA_VE_SLOUPCI = /^[\dIlOo|]{1,2}\s*[:;]\s*(?:[\dOo]{2}\s+){3,}.*[-–—]\s+[\dOo]{2}/;

interface Signal {
  readonly popis: string;
  readonly kandidati: readonly Hra[];
}

function najdiSignaly(radky: readonly string[], hraZKodu: Hra | null): Signal[] {
  const signaly: Signal[] = [];
  if (hraZKodu !== null) signaly.push({ popis: 'čárový kód', kandidati: [hraZKodu] });

  // Popisky se prověřují všechny — tiket, na kterém se najde popisek dvou her, je rozpor.
  for (const hra of VSECHNY) {
    if (radky.some((r) => POPISKY_DOPLNKOVE_HRY[hra].test(r))) {
      signaly.push({ popis: `popisek ${NAZVY_DOPLNKOVYCH_HER[hra]}`, kandidati: [hra] });
    }
  }

  for (const { hra, vzor } of NAZVY) {
    if (radky.some((r) => vzor.test(r))) signaly.push({ popis: 'název v logu', kandidati: [hra] });
  }

  // Každý den v závorce hlavičky vyřadí hry, které ten den nelosují.
  for (const den of prectiHlavicku(radky).dny ?? []) {
    signaly.push({
      popis: 'dny v hlavičce',
      kandidati: VSECHNY.filter((hra) => DNY_LOSOVANI[hra].includes(den)),
    });
  }

  if (radky.some((r) => POMLCKA_VE_SLOUPCI.test(r))) {
    signaly.push({ popis: 'pomlčka ve sloupci', kandidati: ['euromiliony'] });
  }

  return signaly;
}

/**
 * Určí hru z rozpoznaných řádků tiketu a z hry přečtené z čárového kódu.
 *
 * @param radky složené řádky tiketu (`slozRadky`), všechny včetně sloupců
 * @param hraZKodu hra z hlavičky čárového kódu, nebo `null`, když kód chybí nebo ji neurčil
 */
export function rozpoznejHru(radky: readonly string[], hraZKodu: Hra | null): RozpoznanaHra {
  const signaly = najdiSignaly(radky, hraZKodu);
  const zbyva = VSECHNY.filter((hra) => signaly.every((s) => s.kandidati.includes(hra)));
  const podle = [...new Set(signaly.map((s) => s.popis))];

  return { hra: signaly.length > 0 && zbyva.length === 1 ? zbyva[0]! : null, podle };
}
