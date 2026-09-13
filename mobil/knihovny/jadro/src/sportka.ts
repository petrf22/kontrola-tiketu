/**
 * Vyhodnocení Sportky.
 *
 * Pravidla pořadí jsou z herního plánu (bod 12). Čísla ve sloupci jsou podle bodu 1
 * „společná pro I. a II. tah“, takže každý sloupec hraje v obou tazích vždy — není to volba
 * sázejícího a model pro to nemá žádný přepínač.
 *
 * Bonus se tady nevyhodnocuje. Jeho podmínky (plná sázenka, vsazená Šance a výhra v ní) se
 * netýkají jednoho sloupce, ale celého tiketu, takže patří do vyhodnocení tiketu.
 */

import type { PoradiSportka, SloupecSportka, SportkaTah, TahSportka } from './model.js';

export interface ShodaSportka {
  /** Kolik z šesti čísel sloupce bylo v tomto tahu vylosováno. */
  readonly cisel: number;
  /** Která čísla se shodovala, vzestupně. Pro zvýraznění v UI. */
  readonly cisla: readonly number[];
  /** Zda sloupec obsahuje dodatkové číslo. Rozhoduje jen při shodě pěti čísel. */
  readonly dodatkove: boolean;
}

export interface VysledekSloupceSportka {
  readonly poradiTahu: 1 | 2;
  readonly shoda: ShodaSportka;
  /** `null`, pokud kombinace není výherní. Bonus tato funkce nikdy nevrací. */
  readonly poradi: PoradiSportka | null;
  /**
   * Částka z tabulky tohoto tahu. `null` znamená buď nevýherní kombinaci, nebo — pokud je
   * `poradi` vyplněné — že tabulka tahu dané pořadí neobsahuje, tedy vadná vstupní data.
   */
  readonly vyseVyhryKc: number | null;
}

/**
 * Vrátí výherní pořadí pro danou shodu, nebo `null`.
 *
 * Dodatkové číslo hraje roli výhradně při shodě pěti čísel; při šesti je sloupec v I. pořadí
 * bez ohledu na ně a při čtyřech a méně se neuplatní.
 */
export function urciPoradiSportka(cisel: number, dodatkove: boolean): PoradiSportka | null {
  if (cisel === 6) return 'I';
  if (cisel === 5) return dodatkove ? 'II' : 'III';
  if (cisel === 4) return 'IV';
  if (cisel === 3) return 'V';
  return null;
}

export function porovnejSportka(sloupec: SloupecSportka, tah: SportkaTah): ShodaSportka {
  const vylosovana = new Set(tah.cisla);
  const cisla = sloupec.cisla.filter((c) => vylosovana.has(c)).sort((a, b) => a - b);
  return {
    cisel: cisla.length,
    cisla,
    dodatkove: sloupec.cisla.includes(tah.dodatkove),
  };
}

export function vyhodnotSloupecSportka(
  sloupec: SloupecSportka,
  tah: SportkaTah,
): VysledekSloupceSportka {
  const shoda = porovnejSportka(sloupec, tah);
  const poradi = urciPoradiSportka(shoda.cisel, shoda.dodatkove);
  if (poradi === null) {
    return { poradiTahu: tah.poradiTahu, shoda, poradi: null, vyseVyhryKc: null };
  }
  const radek = tah.poradi.find((p) => p.klic === poradi);
  return { poradiTahu: tah.poradiTahu, shoda, poradi, vyseVyhryKc: radek?.vyseVyhryKc ?? null };
}

/** Sloupec hraje v obou tazích slosování, takže vyhodnocení vrací vždy dvojici výsledků. */
export function vyhodnotSloupecVObouTazich(
  sloupec: SloupecSportka,
  slosovani: TahSportka,
): [VysledekSloupceSportka, VysledekSloupceSportka] {
  return [
    vyhodnotSloupecSportka(sloupec, slosovani.tahy[0]),
    vyhodnotSloupecSportka(sloupec, slosovani.tahy[1]),
  ];
}
