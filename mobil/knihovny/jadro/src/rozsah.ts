/**
 * Rozsah kontroly a virtuální tikety.
 *
 * Papírový tiket platí na `slosovani.pocet` tahů. Kdo sází pořád stejná čísla, může tentýž
 * tiket kontrolovat zpětně i dopředu — takový tiket je virtuální. Tady je to, co k tomu
 * potřebuje formulář (výchozí konec rozsahu) a kontrola duplicit: dva tikety se stejnými
 * sloupci na totéž slosování by se započítaly dvakrát, proto se takový tiket uložit nedá.
 */

import type { Datum, Den, Hra, RozsahSlosovani, Sloupec, Tah, Tiket } from './model.js';
import { DNY_LOSOVANI } from './validace.js';

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
 * Data slosování hry od `od` dál, na která tiket se dny `dny` platí.
 *
 * Kde aplikace tahy hry má, řídí se jimi, takže sedí i losování mimo rozvrh. Před prvním
 * a za posledním známým tahem doplní data z kalendáře podle dnů losování hry (nebo dnů
 * vybraných na tiketu). Budoucí losování mimo rozvrh tak odhadne špatně.
 */
function* slosovaniPodleRozvrhu(
  hra: Hra,
  od: Datum,
  dny: readonly Den[] | null,
  tahy: readonly Tah[],
): Generator<Datum> {
  const tahyHry = tahy.filter((t) => t.hra === hra).map((t) => t.datum).sort();
  const prvniZnamy = tahyHry[0];
  const posledniZnamy = tahyHry.at(-1);
  const znamy = (datum: Datum) =>
    prvniZnamy !== undefined && posledniZnamy !== undefined && datum >= prvniZnamy && datum <= posledniZnamy;

  const znameTahy = new Set(tahyHry);
  const vRozvrhu = dny ?? DNY_LOSOVANI[hra];

  let ms = naMs(od);
  // Pojistka proti nekonečné smyčce při nesmyslném vstupu: víc než deset let dopředu nehledá.
  const mez = ms + 3660 * DEN_MS;
  for (; ms <= mez; ms += DEN_MS) {
    const datum = zMs(ms);
    const losuje = znamy(datum)
      ? znameTahy.has(datum) && (dny === null || dny.includes(denVTydnu(datum)))
      : vRozvrhu.includes(denVTydnu(datum));
    if (losuje) yield datum;
  }
}

/**
 * Datum posledního slosování, na které tiket z papíru platí — výchozí konec rozsahu kontroly.
 * Uživatel datum vidí a může ho přepsat.
 */
export function datumPoslednihoSlosovani(
  hra: Hra,
  slosovani: RozsahSlosovani,
  tahy: readonly Tah[],
): Datum {
  const { prvni, pocet, dny } = slosovani;
  let zbyva = Math.max(1, pocet);
  let posledni = prvni;
  for (const datum of slosovaniPodleRozvrhu(hra, prvni, dny, tahy)) {
    posledni = datum;
    zbyva -= 1;
    if (zbyva === 0) break;
  }
  return posledni;
}

/**
 * Všechna slosování, na která tiket platí — i ta, která ještě nemají výsledky. `null` u
 * virtuálního tiketu bez konce.
 */
function planovanaSlosovani(tiket: Tiket, tahy: readonly Tah[]): Datum[] | null {
  const { kontrola, slosovani } = tiket;
  if (kontrola?.do === null) return null;
  const data: Datum[] = [];
  for (const datum of slosovaniPodleRozvrhu(tiket.hra, kontrola?.od ?? slosovani.prvni, slosovani.dny, tahy)) {
    if (kontrola === undefined ? data.length >= Math.max(1, slosovani.pocet) : datum > kontrola.do) break;
    data.push(datum);
  }
  return data;
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

/**
 * Mají tikety stejné sloupce? Stejná hra a stejná čísla bez ohledu na pořadí sloupců i čísel.
 *
 * Kód doplňkové hry se schválně neporovnává: duplicitu určují vsazená čísla a rozpoznávač
 * kód z fotky občas přečte jinak — dva skeny téhož tiketu by se pak za duplicitu nepovažovaly.
 */
export function stejneSloupce(a: Tiket, b: Tiket): boolean {
  if (a.hra !== b.hra || a.sloupce.length !== b.sloupce.length) return false;
  const klice = (t: Tiket) => t.sloupce.map(klicSloupce).sort();
  const ka = klice(a);
  const kb = klice(b);
  return ka.every((k, i) => k === kb[i]);
}

/**
 * Slosování, na která platí oba tikety. U dvou tiketů bez konce stačí ukázat, že se potkají:
 * vrátí společná slosování od pozdějšího začátku do posledního známého tahu, nejméně dva týdny.
 */
export function spolecnaSlosovani(a: Tiket, b: Tiket, tahy: readonly Tah[]): Datum[] {
  if (a.hra !== b.hra) return [];
  const planA = planovanaSlosovani(a, tahy);
  const planB = planovanaSlosovani(b, tahy);
  if (planA !== null && planB !== null) {
    const setB = new Set(planB);
    return planA.filter((d) => setB.has(d));
  }
  if (planA !== null || planB !== null) {
    const [omezeny, bezKonce] = planA !== null ? [planA, b] : [planB!, a];
    return omezeny.filter((d) => platiBezKonce(bezKonce, d, tahy));
  }
  const od = [a.kontrola!.od, b.kontrola!.od].sort()[1]!;
  const posledniZnamy = tahy.reduce((max, t) => (t.hra === a.hra && t.datum > max ? t.datum : max), '');
  const doData = [zMs(naMs(od) + 13 * DEN_MS), posledniZnamy].sort()[1]!;
  const vysledek: Datum[] = [];
  for (const datum of slosovaniPodleRozvrhu(a.hra, od, a.slosovani.dny, tahy)) {
    if (datum > doData) break;
    if (platiBezKonce(b, datum, tahy)) vysledek.push(datum);
  }
  return vysledek;
}

/** Platí virtuální tiket bez konce na dané slosování? */
function platiBezKonce(tiket: Tiket, datum: Datum, tahy: readonly Tah[]): boolean {
  const od = tiket.kontrola!.od;
  if (datum < od) return false;
  return slosovaniPodleRozvrhu(tiket.hra, datum, tiket.slosovani.dny, tahy).next().value === datum;
}

export interface Prekryv {
  /** Druhý tiket se stejnými sloupci. */
  readonly tiketId: string;
  /** Slosování, na která platí oba. */
  readonly data: readonly Datum[];
}

/**
 * Uložené tikety, se kterými by `tiket` byl duplicitní: stejné sloupce aspoň na jedno společné
 * slosování. Výhry i ceny by se pak započítaly dvakrát. Tiket se stejným id se nepočítá —
 * to je tentýž tiket, uložení ho přepíše.
 */
export function duplicity(tiket: Tiket, ostatni: readonly Tiket[], tahy: readonly Tah[]): Prekryv[] {
  const vysledek: Prekryv[] = [];
  for (const jiny of ostatni) {
    if (jiny.id === tiket.id || !stejneSloupce(tiket, jiny)) continue;
    const data = spolecnaSlosovani(tiket, jiny, tahy);
    if (data.length > 0) vysledek.push({ tiketId: jiny.id, data });
  }
  return vysledek;
}

/**
 * Duplicitní tikety mezi uloženými. Nové duplicity se uložit nedají, ale ty z doby před
 * kontrolou v databázi zůstaly — aplikace je ukáže, aby uživatel jeden z dvojice smazal.
 * Klíčem výsledku je id tiketu; tiket bez duplicity ve výsledku není.
 */
export function prekryvy(tikety: readonly Tiket[], tahy: readonly Tah[]): Map<string, Prekryv[]> {
  const vysledek = new Map<string, Prekryv[]>();
  for (const [i, a] of tikety.entries()) {
    for (const p of duplicity(a, tikety.slice(i + 1), tahy)) {
      vysledek.set(a.id, [...(vysledek.get(a.id) ?? []), p]);
      vysledek.set(p.tiketId, [...(vysledek.get(p.tiketId) ?? []), { tiketId: a.id, data: p.data }]);
    }
  }
  return vysledek;
}
