/**
 * Rozsah kontroly a virtuální tikety.
 *
 * Papírový tiket platí na `slosovani.pocet` tahů. Kdo sází pořád stejná čísla, může tentýž
 * tiket kontrolovat zpětně i dopředu — takový tiket je virtuální. Tady je to, co k tomu
 * potřebuje formulář (výchozí konec rozsahu) a přehled (tikety se stejnou sázkou, které by
 * se jinak započítaly dvakrát).
 */

import type { Datum, Den, Hra, RozsahSlosovani, Sloupec, Tah, Tiket } from './model.js';
import { DNY_LOSOVANI } from './validace.js';
import { vyberSlosovani } from './vyhodnoceni.js';

/** Den v týdnu podle `Date.getUTCDay()`, tedy od neděle. */
const DNY_TYDNE: readonly Den[] = ['ne', 'po', 'ut', 'st', 'ct', 'pa', 'so'];

const DEN_MS = 24 * 60 * 60 * 1000;

export function jeVirtualni(tiket: Tiket): boolean {
  return tiket.kontrola !== undefined;
}

function naMs(datum: Datum): number {
  return Date.UTC(Number(datum.slice(0, 4)), Number(datum.slice(5, 7)) - 1, Number(datum.slice(8, 10)));
}

function zMs(ms: number): Datum {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Den v týdnu pro datum `RRRR-MM-DD`. Počítá se v UTC, takže nezávisí na časové zóně. */
export function denVTydnu(datum: Datum): Den {
  return DNY_TYDNE[new Date(naMs(datum)).getUTCDay()]!;
}

/**
 * Datum posledního slosování, na které tiket z papíru platí — výchozí konec rozsahu kontroly.
 *
 * Kde aplikace tahy hry má, řídí se jimi, takže sedí i losování mimo rozvrh. Před prvním
 * a za posledním známým tahem doplní data z kalendáře podle dnů losování hry (nebo dnů
 * vybraných na tiketu). Budoucí losování mimo rozvrh tak odhadne špatně; uživatel datum
 * vidí a může ho přepsat.
 */
export function datumPoslednihoSlosovani(
  hra: Hra,
  slosovani: RozsahSlosovani,
  tahy: readonly Tah[],
): Datum {
  const { prvni, pocet, dny } = slosovani;
  const tahyHry = tahy.filter((t) => t.hra === hra).map((t) => t.datum).sort();
  const prvniZnamy = tahyHry[0];
  const posledniZnamy = tahyHry.at(-1);
  const znamy = (datum: Datum) =>
    prvniZnamy !== undefined && posledniZnamy !== undefined && datum >= prvniZnamy && datum <= posledniZnamy;

  const znameTahy = new Set(tahyHry);
  const vRozvrhu = dny ?? DNY_LOSOVANI[hra];

  let zbyva = Math.max(1, pocet);
  let ms = naMs(prvni);
  // Pojistka proti nekonečné smyčce při nesmyslném vstupu: víc než deset let dopředu nehledá.
  const mez = ms + 3660 * DEN_MS;
  let posledni = prvni;

  for (; ms <= mez; ms += DEN_MS) {
    const datum = zMs(ms);
    const losuje = znamy(datum)
      ? znameTahy.has(datum) && (dny === null || dny.includes(denVTydnu(datum)))
      : vRozvrhu.includes(denVTydnu(datum));
    if (!losuje) continue;
    posledni = datum;
    zbyva -= 1;
    if (zbyva === 0) break;
  }
  return posledni;
}

/** Porovnatelný zápis sloupce: čísla bez ohledu na pořadí, v jakém jsou na tiketu. */
function klicSloupce(sloupec: Sloupec): string {
  const serazene = (cisla: readonly number[]) => [...cisla].sort((a, b) => a - b).join('.');
  switch (sloupec.hra) {
    case 'eurojackpot':
      return `${serazene(sloupec.cisla)}+${serazene(sloupec.eurocisla)}`;
    case 'euromiliony':
      return `${serazene(sloupec.cisla)}+${serazene(sloupec.druheOsudi)}`;
    case 'sportka':
      return serazene(sloupec.cisla);
  }
}

/** Mají tikety stejnou sázku? Stejná hra, sloupce bez ohledu na pořadí a kód doplňkové hry. */
export function stejnaSazka(a: Tiket, b: Tiket): boolean {
  if (a.hra !== b.hra || a.kodDoplnkoveHry !== b.kodDoplnkoveHry) return false;
  if (a.sloupce.length !== b.sloupce.length) return false;
  const klice = (t: Tiket) => t.sloupce.map(klicSloupce).sort();
  const ka = klice(a);
  const kb = klice(b);
  return ka.every((k, i) => k === kb[i]);
}

export interface Prekryv {
  /** Druhý tiket se stejnou sázkou. */
  readonly tiketId: string;
  /** Slosování, na která se kontrolují oba. */
  readonly data: readonly Datum[];
}

/**
 * Tikety se stejnou sázkou, které se kontrolují na stejná slosování.
 *
 * Typicky virtuální tiket na každé úterý a vedle něj vyfocený papírový tiket na jedno z těch
 * úterků. Obě výhry i obě ceny se pak započítají — aplikace to jen ukáže, nerozhoduje, který
 * z tiketů platí. Klíčem výsledku je id tiketu; tiket bez překryvu ve výsledku není.
 */
export function prekryvy(tikety: readonly Tiket[], tahy: readonly Tah[]): Map<string, Prekryv[]> {
  const vysledek = new Map<string, Prekryv[]>();
  const data = new Map(tikety.map((t) => [t.id, vyberSlosovani(t, tahy).pouzite.map((tah) => tah.datum)]));

  for (const [i, a] of tikety.entries()) {
    for (const b of tikety.slice(i + 1)) {
      if (!stejnaSazka(a, b)) continue;
      const dataB = new Set(data.get(b.id));
      const spolecna = (data.get(a.id) ?? []).filter((d) => dataB.has(d));
      if (spolecna.length === 0) continue;
      vysledek.set(a.id, [...(vysledek.get(a.id) ?? []), { tiketId: b.id, data: spolecna }]);
      vysledek.set(b.id, [...(vysledek.get(b.id) ?? []), { tiketId: a.id, data: spolecna }]);
    }
  }
  return vysledek;
}
