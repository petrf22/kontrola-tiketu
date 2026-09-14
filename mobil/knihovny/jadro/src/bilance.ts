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
}

export interface SouhrnBilance {
  readonly celkem: PolozkaBilance;
  readonly podleHry: Readonly<Record<Hra, PolozkaBilance>>;
}

const PRAZDNA: PolozkaBilance = { vsazenoKc: 0, vyhranoKc: 0, tiketu: 0, tiketuBezCeny: 0, nejistych: 0 };

function pricti(polozka: PolozkaBilance, vysledek: VysledekTiketu): PolozkaBilance {
  return {
    vsazenoKc: polozka.vsazenoKc + (vysledek.vsazenoKc ?? 0),
    vyhranoKc: polozka.vyhranoKc + vysledek.celkemKc,
    tiketu: polozka.tiketu + 1,
    tiketuBezCeny: polozka.tiketuBezCeny + (vysledek.vsazenoKc === null ? 1 : 0),
    nejistych: polozka.nejistych + (vysledek.soucetJisty ? 0 : 1),
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
    celkem = pricti(celkem, vysledek);
    podleHry[tiket.hra] = pricti(podleHry[tiket.hra], vysledek);
  }

  return { celkem, podleHry };
}
