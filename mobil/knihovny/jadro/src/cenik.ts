/**
 * Cena tiketu podle ceníku.
 *
 * Vklad na jedno slosování je cena sloupce krát počet sloupců plus cena doplňkové hry, když
 * je vsazená. Předplatné stojí tolik krát víc, kolik má slosování (herní plán, Sportka bod 14,
 * EUROJACKPOT bod 14, Euromiliony bod 10). Systémové sázky model nezná.
 *
 * Když cenu ceník nezná, výsledek je `null`, ne odhad: bilance by jinak tvrdila něco,
 * co nikdo neví.
 */

import type { CenikHry, Datum, Hra, Tiket } from './model.js';

/** Co z tiketu určuje cenu. Formulář tak může cenu spočítat dřív, než tiket vznikne. */
export type SazkaTiketu = Pick<Tiket, 'hra' | 'sloupce' | 'slosovani' | 'kodDoplnkoveHry'>;

/** Z čeho se cena tiketu skládá. Aplikace to ukazuje, když přečtená cena nesedí. */
export interface RozpisCeny {
  readonly sloupcu: number;
  readonly sloupecKc: number;
  /** Cena doplňkové hry, jen když je vsazená. */
  readonly doplnkovaHraKc: number | null;
  readonly slosovani: number;
  readonly celkemKc: number;
}

/** Ceník hry platný v daný den, nebo `null`, když je den starší než nejstarší záznam. */
export function platnyCenik(ceny: readonly CenikHry[], hra: Hra, datum: Datum): CenikHry | null {
  let platny: CenikHry | null = null;
  for (const cenik of ceny) {
    if (cenik.hra !== hra || cenik.platnostOd > datum) continue;
    if (platny === null || cenik.platnostOd > platny.platnostOd) platny = cenik;
  }
  return platny;
}

/**
 * Vklad na jedno slosování. `null`, když ceník chybí, když tiket nemá sloupce nebo když je
 * vsazená doplňková hra, kterou ceník v tu dobu nezná.
 */
export function vkladNaSlosovani(
  cenik: CenikHry | null,
  pocetSloupcu: number,
  sDoplnkovouHrou: boolean,
): number | null {
  if (cenik === null || pocetSloupcu < 1) return null;
  if (sDoplnkovouHrou && cenik.doplnkovaHraKc === null) return null;
  return cenik.sloupecKc * pocetSloupcu + (sDoplnkovouHrou ? (cenik.doplnkovaHraKc ?? 0) : 0);
}

/**
 * Rozpis ceny papírového tiketu. Celé předplatné stojí podle ceníku platného v den prvního
 * slosování, protože se platí při nákupu.
 */
export function rozpisCenyTiketu(tiket: SazkaTiketu, ceny: readonly CenikHry[]): RozpisCeny | null {
  const cenik = platnyCenik(ceny, tiket.hra, tiket.slosovani.prvni);
  const sDoplnkovouHrou = tiket.kodDoplnkoveHry !== null;
  const vklad = vkladNaSlosovani(cenik, tiket.sloupce.length, sDoplnkovouHrou);
  if (cenik === null || vklad === null || tiket.slosovani.pocet < 1) return null;
  return {
    sloupcu: tiket.sloupce.length,
    sloupecKc: cenik.sloupecKc,
    doplnkovaHraKc: sDoplnkovouHrou ? cenik.doplnkovaHraKc : null,
    slosovani: tiket.slosovani.pocet,
    celkemKc: vklad * tiket.slosovani.pocet,
  };
}

/** Cena papírového tiketu podle ceníku, nebo `null`. */
export function cenaTiketuPodleCeniku(tiket: SazkaTiketu, ceny: readonly CenikHry[]): number | null {
  return rozpisCenyTiketu(tiket, ceny)?.celkemKc ?? null;
}

/**
 * Kolik stála daná slosování, každé za cenu platnou v jeho den. Virtuální tiket bez ruční
 * ceny tak přes změnu ceníku počítá staré slosování za starou cenu a nové za novou.
 * `null`, když ceník nezná cenu kteréhokoliv z nich.
 */
export function vsazenoPodleCeniku(
  tiket: SazkaTiketu,
  datumy: readonly Datum[],
  ceny: readonly CenikHry[],
): number | null {
  let soucet = 0;
  for (const datum of datumy) {
    const vklad = vkladNaSlosovani(
      platnyCenik(ceny, tiket.hra, datum),
      tiket.sloupce.length,
      tiket.kodDoplnkoveHry !== null,
    );
    if (vklad === null) return null;
    soucet += vklad;
  }
  return soucet;
}
