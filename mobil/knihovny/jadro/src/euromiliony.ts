/**
 * Vyhodnocení Euromilionů.
 *
 * Pravidla pořadí jsou z herního plánu (Euromiliony, bod 9). Částky se vždy berou z tabulky
 * konkrétního tahu — jsou totalizátorové stejně jako u Eurojackpotu.
 */

import type {
  PoradiEuromiliony,
  SloupecEuromiliony,
  TahEuromiliony,
} from './model.js';

/**
 * Mapa shody na výherní pořadí. Klíč je `<počet čísel z 1. osudí>+<shoda v 2. osudí>`.
 *
 * Listina ve sloupci „Počet uhodnutých čísel“ píše `7`, `6`, … bez `+0`; tady je nula
 * vypsaná, aby klíč měl vždy stejný tvar. Kombinace 3+0, 2+0 a méně nevyhrávají.
 */
const PORADI_PODLE_SHODY: Readonly<Record<string, PoradiEuromiliony>> = {
  '7+1': 'I',
  '7+0': 'II',
  '6+1': 'III',
  '6+0': 'IV',
  '5+1': 'V',
  '5+0': 'VI',
  '4+1': 'VII',
  '4+0': 'VIII',
  '3+1': 'IX',
  '2+1': 'X',
};

export interface ShodaEuromiliony {
  /** Kolik ze sedmi čísel sloupce bylo vylosováno z prvního osudí. */
  readonly hlavni: number;
  /** Shoda v druhém osudí: 1, nebo 0. */
  readonly druhe: number;
  /** Která čísla z prvního osudí se shodovala, vzestupně. Pro zvýraznění v UI. */
  readonly hlavniCisla: readonly number[];
  /** Které číslo z druhého osudí se shodovalo (nejvýš jedno). */
  readonly druheCisla: readonly number[];
}

export interface VysledekSloupceEuromiliony {
  readonly shoda: ShodaEuromiliony;
  /** `null`, pokud kombinace není výherní. */
  readonly poradi: PoradiEuromiliony | null;
  /**
   * Částka z tabulky tohoto tahu. `null` znamená buď nevýherní kombinaci, nebo — pokud je
   * `poradi` vyplněné — že tabulka tahu dané pořadí neobsahuje.
   */
  readonly vyseVyhryKc: number | null;
}

/** Vrátí výherní pořadí pro danou shodu, nebo `null`, pokud kombinace nevyhrává. */
export function urciPoradiEuromiliony(hlavni: number, druhe: number): PoradiEuromiliony | null {
  return PORADI_PODLE_SHODY[`${hlavni}+${druhe}`] ?? null;
}

function prunik(tipovane: readonly number[], vylosovane: readonly number[]): number[] {
  const vylosovanaMnozina = new Set(vylosovane);
  return tipovane.filter((c) => vylosovanaMnozina.has(c)).sort((a, b) => a - b);
}

export function porovnejEuromiliony(
  sloupec: SloupecEuromiliony,
  tah: TahEuromiliony,
): ShodaEuromiliony {
  const hlavniCisla = prunik(sloupec.cisla, tah.cisla);
  const druheCisla = prunik(sloupec.druheOsudi, [tah.druheOsudi]);
  return {
    hlavni: hlavniCisla.length,
    druhe: druheCisla.length,
    hlavniCisla,
    druheCisla,
  };
}

export function vyhodnotSloupecEuromiliony(
  sloupec: SloupecEuromiliony,
  tah: TahEuromiliony,
): VysledekSloupceEuromiliony {
  const shoda = porovnejEuromiliony(sloupec, tah);
  const poradi = urciPoradiEuromiliony(shoda.hlavni, shoda.druhe);
  if (poradi === null) {
    return { shoda, poradi: null, vyseVyhryKc: null };
  }
  const radek = tah.poradi.find((p) => p.klic === poradi);
  return { shoda, poradi, vyseVyhryKc: radek?.vyseVyhryKc ?? null };
}
