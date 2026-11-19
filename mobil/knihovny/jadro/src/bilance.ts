/**
 * Souhrn vsazeného a vyhraného přes všechny tikety.
 *
 * Aby hráč na první pohled viděl, kolik prosázel a kolik vyhrál — celkem i po hrách.
 * Neznámá cena se nepočítá jako nula: nula by tvrdila, že tiket byl zadarmo, a bilance by
 * vyšla lepší, než je. Takový tiket se jen počítá do `tiketuBezCeny`.
 */

import type { Hra, Tiket } from './model.js';
import type { VysledekTiketu } from './vyhodnoceni.js';

export interface PolozkaBilance {
  /** Součet známých vsazených částek. */
  readonly vsazenoKc: number;
  /** Součet známých výher. */
  readonly vyhranoKc: number;
  readonly tiketu: number;
  /** Tikety, jejichž vsazená částka není známá. Jejich výhry se započítají. */
  readonly tiketuBezCeny: number;
  /** Tikety, jejichž součet výher není konečný — chybí výsledky, pokračují nebo mají výhradu. */
  readonly nejistych: number;
  /**
   * Podíl jednoho člena: součet po tiketech `vsazenoKc / clenu`. Tikety bez `clenu` dělí jedničkou,
   * takže bez skupinových tiketů se rovná `vsazenoKc`. Dělí se po tiketech, protože počet členů
   * se mezi tikety může lišit.
   */
  readonly vsazenoNaClenaKc: number;
  /** Podíl jednoho člena na výhrách (viz `vsazenoNaClenaKc`). */
  readonly vyhranoNaClenaKc: number;
  /** Kolik z `tiketu` je skupinových (`clenu` ≥ 2). */
  readonly skupinovych: number;
}

export interface SouhrnBilance {
  readonly celkem: PolozkaBilance;
  readonly podleHry: Readonly<Record<Hra, PolozkaBilance>>;
}

const PRAZDNA: PolozkaBilance = {
  vsazenoKc: 0,
  vyhranoKc: 0,
  tiketu: 0,
  tiketuBezCeny: 0,
  nejistych: 0,
  vsazenoNaClenaKc: 0,
  vyhranoNaClenaKc: 0,
  skupinovych: 0,
};

/** Počet členů tiketu; chybějící nebo nesmyslná hodnota znamená „sázím sám“. */
export function clenuTiketu(tiket: Pick<Tiket, 'clenu'>): number {
  const clenu = tiket.clenu;
  return clenu !== undefined && Number.isInteger(clenu) && clenu >= 2 ? clenu : 1;
}

/**
 * Počet členů, pokud ho mají všechny tikety stejný a je větší než 1; jinak `null` (různé počty
 * nebo samostatné sázky se ve společném záhlaví neukazují).
 */
export function spolecnyPocetClenu(tikety: readonly Pick<Tiket, 'clenu'>[]): number | null {
  const pocty = new Set(tikety.map(clenuTiketu));
  const [n] = pocty;
  return pocty.size === 1 && n !== undefined && n > 1 ? n : null;
}

function pricti(polozka: PolozkaBilance, tiket: Tiket, vysledek: VysledekTiketu): PolozkaBilance {
  const clenu = clenuTiketu(tiket);
  return {
    vsazenoKc: polozka.vsazenoKc + (vysledek.vsazenoKc ?? 0),
    vyhranoKc: polozka.vyhranoKc + vysledek.celkemKc,
    tiketu: polozka.tiketu + 1,
    tiketuBezCeny: polozka.tiketuBezCeny + (vysledek.vsazenoKc === null ? 1 : 0),
    nejistych: polozka.nejistych + (vysledek.soucetJisty ? 0 : 1),
    vsazenoNaClenaKc: polozka.vsazenoNaClenaKc + (vysledek.vsazenoKc ?? 0) / clenu,
    vyhranoNaClenaKc: polozka.vyhranoNaClenaKc + vysledek.celkemKc / clenu,
    skupinovych: polozka.skupinovych + (clenu > 1 ? 1 : 0),
  };
}

/**
 * @param vysledky Vyhodnocení tiketů podle id. Tiket bez vyhodnocení se přeskočí.
 */
export function souhrnBilance(
  tikety: readonly Tiket[],
  vysledky: ReadonlyMap<string, VysledekTiketu>,
): SouhrnBilance {
  let celkem = PRAZDNA;
  const podleHry: Record<Hra, PolozkaBilance> = {
    eurojackpot: PRAZDNA,
    sportka: PRAZDNA,
    euromiliony: PRAZDNA,
  };

  for (const tiket of tikety) {
    const vysledek = vysledky.get(tiket.id);
    if (vysledek === undefined) continue;
    celkem = pricti(celkem, tiket, vysledek);
    podleHry[tiket.hra] = pricti(podleHry[tiket.hra], tiket, vysledek);
  }

  return { celkem, podleHry };
}
