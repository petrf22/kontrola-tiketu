import { datumPoslednihoSlosovani, type Datum, type Tah, type Tiket, type VysledekSlosovani, type VysledekTiketu } from '@kontrola-tiketu/jadro';
import { formatujDatum } from './format.js';

export type FiltrHistorie = 'vsechna' | 'vyherni' | 'neuplna';
export function neuplneSlosovani(s: VysledekSlosovani): boolean {
  return s.nejistychVyher > 0 || s.vyhry.some(v => v.vyhrada !== null);
}
export function historieTiketu(slosovani: readonly VysledekSlosovani[], filtr: FiltrHistorie): VysledekSlosovani[] {
  return slosovani.filter(s => filtr === 'vsechna' || (filtr === 'vyherni' ? s.vyhry.length > 0 : neuplneSlosovani(s)))
    .sort((a, b) => b.datum.localeCompare(a.datum));
}

/** Prázdná cena použije ceník; neplatná hodnota se nesmí tiše změnit na ceník. */
export function sUpravenouCenou(tiket: Tiket, text: string): Tiket {
  const hodnota = text.trim().replace(',', '.');
  const cena = hodnota === '' ? null : Number(hodnota);
  if (hodnota !== '' && (!/^\d+(?:\.\d+)?$/.test(hodnota) || !Number.isFinite(cena) || cena! < 0)) {
    throw new Error('Zadej nezápornou částku, nebo pole nech prázdné pro cenu podle ceníku.');
  }
  return tiket.kontrola
    ? { ...tiket, kontrola: { ...tiket.kontrola, cenaZaSlosovaniKc: cena } }
    : { ...tiket, cenaKc: cena };
}

/**
 * Proč tiket zatím nemá žádné vyhodnocené slosování; `null`, když nějaké má.
 *
 * Bez slosování by souhrn ukázal výhru 0 Kč a bilanci rovnou ceně tiketu — jako by prohrál.
 * V den slosování se losuje až večer, takže i „dnes“ se ještě čeká.
 */
export interface Cekani {
  readonly duvod: 'pred-slosovanim' | 'chybi-vysledky';
  readonly od: Datum;
}
export function cekaniNaSlosovani(tiket: Tiket, vysledek: VysledekTiketu, dnes: Datum): Cekani | null {
  if (vysledek.slosovani.length > 0) return null;
  const od = tiket.kontrola?.od ?? tiket.slosovani.prvni;
  return { duvod: od >= dnes ? 'pred-slosovanim' : 'chybi-vysledky', od };
}

/**
 * Termín tiketu pro seznam: jedno slosování jen datem, víc slosování rozsahem `od – do`,
 * virtuální tiket bez konce `od – …`. Konec papírového tiketu se dopočítá z tahů a rozvrhu,
 * takže sedí i u slosování, která teprve přijdou.
 */
export function popisTerminu(tiket: Tiket, tahy: readonly Tah[]): string {
  const k = tiket.kontrola;
  const od = k?.od ?? tiket.slosovani.prvni;
  const doData = k !== undefined ? k.do
    : tiket.slosovani.pocet <= 1 ? od
    : datumPoslednihoSlosovani(tiket.hra, tiket.slosovani, tahy);
  if (doData === null) return `${formatujDatum(od)} – …`;
  return doData === od ? formatujDatum(od) : `${formatujDatum(od)} – ${formatujDatum(doData)}`;
}

/**
 * Filtr seznamu tiketů, jak si ho aplikace pamatuje. Archiv mezi nimi schválně není — je to
 * umístění, ne priorita, a po startu v archivu by seznam vypadal prázdný.
 */
export interface FiltrSeznamu {
  readonly typ: 'vsechny' | 'papirove' | 'virtualni';
  /** Klíč z `klicNazvu`, `'*'` pro všechny názvy. */
  readonly nazev: string;
  readonly seskupit: boolean;
}
export const VYCHOZI_FILTR_SEZNAMU: FiltrSeznamu = { typ: 'vsechny', nazev: '*', seskupit: true };

/** Uložená data projdou po položkách; co nesedí (starší nebo poškozený záznam), dostane výchozí hodnotu. */
export function nactenyFiltrSeznamu(data: unknown): FiltrSeznamu {
  const d = (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>;
  return {
    typ: d['typ'] === 'papirove' || d['typ'] === 'virtualni' ? d['typ'] : VYCHOZI_FILTR_SEZNAMU.typ,
    nazev: typeof d['nazev'] === 'string' ? d['nazev'] : VYCHOZI_FILTR_SEZNAMU.nazev,
    seskupit: typeof d['seskupit'] === 'boolean' ? d['seskupit'] : VYCHOZI_FILTR_SEZNAMU.seskupit,
  };
}

/**
 * Jsou spočítaná všechna proběhlá slosování a každá výhra má jistou částku? Na rozdíl od
 * `soucetJisty` nevadí, že virtuální tiket běží dál — dosavadní výsledek je konečný.
 */
export function dosudJisty(vysledek: VysledekTiketu): boolean {
  return vysledek.chybejicichSlosovani === 0 && vysledek.slosovani.every(s => s.nejistychVyher === 0);
}

/**
 * Semafor částky výhry — stejně v seznamu, souhrnu detailu i historii slosování: výsledek, který
 * ještě není konečný, má barvu důrazu, výhra zelenou, nula tlumenou.
 */
export type SemaforVyhry = 'nehotovy' | 'vyhra' | 'nula';
export function semaforVyhry(castkaKc: number, jista: boolean): SemaforVyhry {
  return !jista ? 'nehotovy' : castkaKc > 0 ? 'vyhra' : 'nula';
}

/**
 * Semafor bilance: dokud výsledek není konečný, má barvu výhry (důraz). Pak zisk zeleně, výhra,
 * která nepokryla vsazené, barvou důrazu a žádná výhra červeně. Neznámá cena bilanci nemá.
 */
export type SemaforBilance = 'nehotovy' | 'zisk' | 'ztrata-s-vyhrou' | 'prohra' | 'nula';
export function semaforBilance(vyhraKc: number, bilanceKc: number | null, jista: boolean): SemaforBilance {
  if (!jista) return 'nehotovy';
  if (bilanceKc === null) return 'nula';
  return bilanceKc > 0 ? 'zisk' : vyhraKc > 0 ? 'ztrata-s-vyhrou' : 'prohra';
}

/** Tikety, které dosud žádné vyhodnocené slosování neměly a teď mají — čekání skončilo. */
export function noveVyhodnocene(
  pred: ReadonlyMap<string, VysledekTiketu>,
  po: ReadonlyMap<string, VysledekTiketu>,
): string[] {
  return [...po].filter(([id, v]) => v.slosovani.length > 0 && pred.get(id)?.slosovani.length === 0).map(([id]) => id);
}
