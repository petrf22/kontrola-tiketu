/**
 * Vstup pro skládání tiketu.
 *
 * Záměrně to není typ z ML Kitu. Knihovna nesmí na ML Kitu záviset, aby šla testovat bez
 * zařízení a aby se dala vyměnit rozpoznávací vrstva. Aplikace si výstup ML Kitu na tenhle
 * tvar převede — je to pár řádků a všechno podstatné se pak dá otestovat na stole.
 */

export interface Ramecek {
  /** Levý okraj v pixelech snímku. */
  readonly x: number;
  /** Horní okraj v pixelech snímku. */
  readonly y: number;
  readonly sirka: number;
  readonly vyska: number;
}

export interface RozpoznanyText {
  readonly text: string;
  readonly ramecek: Ramecek;
  /**
   * Náklon textu ve stupních, pokud ho rozpoznávač uvádí (ML Kit ho u řádku dává).
   * Když chybí, odhadne se z rozložení rámečků.
   */
  readonly uhel?: number;
}

export function stred(ramecek: Ramecek): { x: number; y: number } {
  return { x: ramecek.x + ramecek.sirka / 2, y: ramecek.y + ramecek.vyska / 2 };
}

export function median(hodnoty: readonly number[]): number {
  if (hodnoty.length === 0) return 0;
  const serazene = [...hodnoty].sort((a, b) => a - b);
  const stred = Math.floor(serazene.length / 2);
  return serazene.length % 2 === 1
    ? serazene[stred]!
    : (serazene[stred - 1]! + serazene[stred]!) / 2;
}
