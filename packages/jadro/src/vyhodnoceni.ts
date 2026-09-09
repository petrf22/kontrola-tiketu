/**
 * Vyhodnocení celého tiketu proti dostupným tahům.
 *
 * Tady se skládá dohromady to, co jednotlivé hry umí samy, a řeší se dvě věci, které
 * na úroveň jednoho sloupce nepatří: výběr slosování, na která tiket platí, a Bonus Sportky,
 * jehož podmínky se týkají celé sázenky.
 */

import type {
  Datum,
  SloupecEurojackpot,
  SloupecSportka,
  Tah,
  TahEurojackpot,
  TahSportka,
  Tiket,
  SazbyExtra6,
} from './model.js';
import { vyhodnotSloupecEurojackpot, type VysledekSloupceEurojackpot } from './eurojackpot.js';
import { vyhodnotSloupecVObouTazich, type VysledekSloupceSportka } from './sportka.js';
import { vyhodnotSance } from './sance.js';
import { vyhodnotExtra6, type VyhradaExtra6 } from './extra6.js';

/** Počet sloupců, který herní plán považuje za plnou sázenku Sportky (bod 11). */
export const PLNA_SAZENKA_SPORTKA = 8;

export type ZdrojVyhry = 'sloupec' | 'doplnkova-hra' | 'bonus';

/** Jedna výhra, plochá a rovnou zobrazitelná. */
export interface Vyhra {
  readonly zdroj: ZdrojVyhry;
  /** Pořadí sloupce na tiketu, počítáno od nuly. `null` u doplňkové hry. */
  readonly indexSloupce: number | null;
  /** Sportka: ve kterém z dvojice tahů. `null` u Eurojackpotu a doplňkové hry. */
  readonly poradiTahu: 1 | 2 | null;
  readonly poradi: string;
  /** `null`, pokud částku nešlo určit — viz `vyhrada`. */
  readonly castkaKc: number | null;
  readonly vyhrada: VyhradaExtra6 | 'chybi-v-tabulce' | null;
}

export type VysledekSloupceTiketu =
  | { readonly hra: 'eurojackpot'; readonly index: number; readonly vysledek: VysledekSloupceEurojackpot }
  | {
      readonly hra: 'sportka';
      readonly index: number;
      readonly vysledky: readonly [VysledekSloupceSportka, VysledekSloupceSportka];
    };

export interface VysledekSlosovani {
  readonly datum: Datum;
  readonly sloupce: readonly VysledekSloupceTiketu[];
  readonly vyhry: readonly Vyhra[];
  /** Součet výher, u kterých je částka známá. */
  readonly celkemKc: number;
  /** Kolik výher má neznámou částku. Dokud je nenulové, součet je neúplný. */
  readonly nejistychVyher: number;
}

export interface VysledekTiketu {
  readonly tiketId: string;
  readonly slosovani: readonly VysledekSlosovani[];
  readonly celkemKc: number;
  /**
   * Výhra minus cena tiketu. `null`, když cena není známá.
   *
   * Záporná hodnota znamená ztrátu. Je to jen informace pro uživatele — na vyhodnocení
   * výher nemá vliv.
   */
  readonly bilanceKc: number | null;
  /** Kolik slosování z rozsahu tiketu nebylo mezi dodanými tahy. */
  readonly chybejicichSlosovani: number;
  /**
   * `true`, jen když jsou k dispozici všechna slosování tiketu a u žádné výhry není výhrada.
   * Jinak je `celkemKc` dolní odhad a UI to musí říct — „nevyhrál jsi“ a „zatím nevím“
   * nejsou totéž.
   */
  readonly soucetJisty: boolean;
}

/** Vybere tahy, na které tiket platí: podle hry, data, vybraných dnů a počtu slosování. */
export function vyberSlosovani(
  tiket: Tiket,
  tahy: readonly Tah[],
): { readonly pouzite: readonly Tah[]; readonly chybi: number } {
  const dny = tiket.slosovani.dny;
  const vhodne = tahy
    .filter((t) => t.hra === tiket.hra)
    .filter((t) => t.datum >= tiket.slosovani.prvni)
    .filter((t) => dny === null || dny.includes(t.den))
    .sort((a, b) => a.datum.localeCompare(b.datum));

  const pouzite = vhodne.slice(0, tiket.slosovani.pocet);
  return { pouzite, chybi: Math.max(0, tiket.slosovani.pocet - pouzite.length) };
}

/**
 * Splňuje tiket vstupní podmínky Bonusu Sportky? Herní plán, bod 11: plná sázenka osmi
 * sloupců a zároveň vsazená Šance.
 *
 * Systémové sázky (systém 8 až 15), které herní plán uznává také, model zatím nezná —
 * u nich Bonus nepřizná.
 */
export function splnujePodminkyBonusu(tiket: Tiket): boolean {
  return (
    tiket.hra === 'sportka' &&
    tiket.sloupce.length === PLNA_SAZENKA_SPORTKA &&
    tiket.kodDoplnkoveHry !== null
  );
}

function vyhraZeSloupce(
  index: number,
  poradiTahu: 1 | 2 | null,
  poradi: string,
  castkaKc: number | null,
): Vyhra {
  return {
    zdroj: 'sloupec',
    indexSloupce: index,
    poradiTahu,
    poradi,
    castkaKc,
    vyhrada: castkaKc === null ? 'chybi-v-tabulce' : null,
  };
}

function vyhodnotEurojackpot(
  tiket: Tiket,
  tah: TahEurojackpot,
  sazby: readonly SazbyExtra6[],
): VysledekSlosovani {
  const sloupce: VysledekSloupceTiketu[] = [];
  const vyhry: Vyhra[] = [];

  for (const [index, sloupec] of tiket.sloupce.entries()) {
    if (sloupec.hra !== 'eurojackpot') continue;
    const vysledek = vyhodnotSloupecEurojackpot(sloupec as SloupecEurojackpot, tah);
    sloupce.push({ hra: 'eurojackpot', index, vysledek });
    if (vysledek.poradi !== null) {
      vyhry.push(vyhraZeSloupce(index, null, vysledek.poradi, vysledek.vyseVyhryKc));
    }
  }

  if (tiket.kodDoplnkoveHry !== null) {
    const extra = vyhodnotExtra6(tiket.kodDoplnkoveHry, tah, sazby);
    if (extra.poradi !== null) {
      vyhry.push({
        zdroj: 'doplnkova-hra',
        indexSloupce: null,
        poradiTahu: null,
        poradi: extra.poradi,
        castkaKc: extra.vyseVyhryKc,
        vyhrada: extra.vyhrada,
      });
    }
  }

  return sestav(tah.datum, sloupce, vyhry);
}

function vyhodnotSportka(tiket: Tiket, tah: TahSportka): VysledekSlosovani {
  const sloupce: VysledekSloupceTiketu[] = [];
  const vyhry: Vyhra[] = [];

  for (const [index, sloupec] of tiket.sloupce.entries()) {
    if (sloupec.hra !== 'sportka') continue;
    const vysledky = vyhodnotSloupecVObouTazich(sloupec as SloupecSportka, tah);
    sloupce.push({ hra: 'sportka', index, vysledky });
    for (const v of vysledky) {
      if (v.poradi !== null) {
        vyhry.push(vyhraZeSloupce(index, v.poradiTahu, v.poradi, v.vyseVyhryKc));
      }
    }
  }

  // Šance je samostatné losování se svou vlastní logikou, nezávislé na sloupcích.
  const vysledekSance =
    tiket.kodDoplnkoveHry !== null && tah.sance !== null
      ? vyhodnotSance(tiket.kodDoplnkoveHry, tah.sance)
      : null;

  if (vysledekSance?.poradi != null) {
    vyhry.push({
      zdroj: 'doplnkova-hra',
      indexSloupce: null,
      poradiTahu: null,
      poradi: vysledekSance.poradi,
      castkaKc: vysledekSance.vyseVyhryKc,
      vyhrada: vysledekSance.vyseVyhryKc === null ? 'chybi-v-tabulce' : null,
    });
  }

  // Bonus: k výhře v I. pořadí, pokud tiket splňuje podmínky a Šance vyhrála mimo 7. pořadí.
  const sanceOpravnujeKBonusu =
    vysledekSance?.poradi != null && vysledekSance.poradi !== 'sousedni-cislo';

  if (splnujePodminkyBonusu(tiket) && sanceOpravnujeKBonusu) {
    for (const s of sloupce) {
      if (s.hra !== 'sportka') continue;
      for (const v of s.vysledky) {
        if (v.poradi !== 'I') continue;
        const radek = tah.tahy[v.poradiTahu - 1]?.poradi.find((p) => p.klic === 'bonus');
        vyhry.push({
          zdroj: 'bonus',
          indexSloupce: s.index,
          poradiTahu: v.poradiTahu,
          poradi: 'bonus',
          castkaKc: radek?.vyseVyhryKc ?? null,
          vyhrada: radek === undefined ? 'chybi-v-tabulce' : null,
        });
      }
    }
  }

  return sestav(tah.datum, sloupce, vyhry);
}

function sestav(
  datum: Datum,
  sloupce: readonly VysledekSloupceTiketu[],
  vyhry: readonly Vyhra[],
): VysledekSlosovani {
  return {
    datum,
    sloupce,
    vyhry,
    celkemKc: vyhry.reduce((s, v) => s + (v.castkaKc ?? 0), 0),
    nejistychVyher: vyhry.filter((v) => v.castkaKc === null || v.vyhrada !== null).length,
  };
}

export function vyhodnotTiket(
  tiket: Tiket,
  tahy: readonly Tah[],
  sazby: readonly SazbyExtra6[] = [],
): VysledekTiketu {
  const { pouzite, chybi } = vyberSlosovani(tiket, tahy);

  const slosovani = pouzite.map((tah) =>
    tah.hra === 'eurojackpot'
      ? vyhodnotEurojackpot(tiket, tah, sazby)
      : vyhodnotSportka(tiket, tah),
  );

  const nejistych = slosovani.reduce((s, v) => s + v.nejistychVyher, 0);

  const celkemKc = slosovani.reduce((s, v) => s + v.celkemKc, 0);

  return {
    tiketId: tiket.id,
    slosovani,
    celkemKc,
    bilanceKc: tiket.cenaKc === null ? null : celkemKc - tiket.cenaKc,
    chybejicichSlosovani: chybi,
    soucetJisty: chybi === 0 && nejistych === 0,
  };
}
