/**
 * Vyhodnocení Eurojackpotu.
 *
 * Pravidla pořadí jsou z herního plánu (bod 12) a jsou stabilní. Částky se naopak vždy berou
 * z tabulky konkrétního tahu — jsou totalizátorové a mezi tahy se liší i o řády.
 */

import type {
  PoradiEurojackpot,
  SloupecEurojackpot,
  TahEurojackpot,
} from './model.js';

/**
 * Mapa shody na výherní pořadí. Klíč je `<počet hlavních>+<počet euročísel>`.
 *
 * Nejde o částky, ale o pravidla, takže tabulka v kódu být smí. Záměrně sedí na sloupec
 * „Počet uhodnutých čísel“ ve výherní listině, aby šla proti ní očima zkontrolovat.
 */
const PORADI_PODLE_SHODY: Readonly<Record<string, PoradiEurojackpot>> = {
  '5+2': 'I',
  '5+1': 'II',
  '5+0': 'III',
  '4+2': 'IV',
  '4+1': 'V',
  '3+2': 'VI',
  '4+0': 'VII',
  '2+2': 'VIII',
  '3+1': 'IX',
  '3+0': 'X',
  '1+2': 'XI',
  '2+1': 'XII',
};

export interface ShodaEurojackpot {
  /** Kolik z pěti hlavních čísel sloupce bylo vylosováno. */
  readonly hlavni: number;
  /** Kolik z dvou euročísel sloupce bylo vylosováno. */
  readonly euro: number;
  /** Která hlavní čísla se shodovala, vzestupně. Pro zvýraznění v UI. */
  readonly hlavniCisla: readonly number[];
  /** Která euročísla se shodovala, vzestupně. */
  readonly euroCisla: readonly number[];
}

export interface VysledekSloupceEurojackpot {
  readonly shoda: ShodaEurojackpot;
  /** `null`, pokud kombinace není výherní. */
  readonly poradi: PoradiEurojackpot | null;
  /**
   * Částka z tabulky tohoto tahu. `null` znamená buď nevýherní kombinaci, nebo — pokud je
   * `poradi` vyplněné — že tabulka tahu dané pořadí neobsahuje, tedy vadná vstupní data.
   */
  readonly vyseVyhryKc: number | null;
}

/** Vrátí výherní pořadí pro danou shodu, nebo `null`, pokud kombinace nevyhrává. */
export function urciPoradiEurojackpot(hlavni: number, euro: number): PoradiEurojackpot | null {
  return PORADI_PODLE_SHODY[`${hlavni}+${euro}`] ?? null;
}

function prunik(tipovane: readonly number[], vylosovane: readonly number[]): number[] {
  const vylosovanaMnozina = new Set(vylosovane);
  return tipovane.filter((c) => vylosovanaMnozina.has(c)).sort((a, b) => a - b);
}

export function porovnejEurojackpot(
  sloupec: SloupecEurojackpot,
  tah: TahEurojackpot,
): ShodaEurojackpot {
  const hlavniCisla = prunik(sloupec.cisla, tah.cisla);
  const euroCisla = prunik(sloupec.eurocisla, tah.eurocisla);
  return {
    hlavni: hlavniCisla.length,
    euro: euroCisla.length,
    hlavniCisla,
    euroCisla,
  };
}

export function vyhodnotSloupecEurojackpot(
  sloupec: SloupecEurojackpot,
  tah: TahEurojackpot,
): VysledekSloupceEurojackpot {
  const shoda = porovnejEurojackpot(sloupec, tah);
  const poradi = urciPoradiEurojackpot(shoda.hlavni, shoda.euro);
  if (poradi === null) {
    return { shoda, poradi: null, vyseVyhryKc: null };
  }
  const radek = tah.poradi.find((p) => p.klic === poradi);
  return { shoda, poradi, vyseVyhryKc: radek?.vyseVyhryKc ?? null };
}
