/**
 * Složení přečtených řádků na sloupce tiketu.
 *
 * Výsledek je návrh, ne hotová věc. Zadání žádá, aby uživatel čísla vždycky potvrdil
 * v editovatelné podobě, takže se tady nic nezahazuje ani nedopočítává: co se přečte
 * špatně, projde dál jako problém k opravě, a ruční zadání je plnohodnotná cesta,
 * ne nouzovka.
 */

import type { Den, Hra, Sloupec, Tiket } from '@kontrola-tiketu/jadro';
import { zkontrolujSloupec, type Problem } from '@kontrola-tiketu/jadro';
import { prectiCislaSloupce, prectiCislo, ZAMENY, type NactenaHodnota } from './cisla.js';
import { prectiCenu } from './cena.js';
import { prectiKodDoplnkoveHry } from './doplnkovaHra.js';
import { slozRadky, type NastaveniSkladani } from './radky.js';
import type { RozpoznanyText } from './model.js';

/**
 * Kolik čísel se čeká ve sloupci které hry. Druhé osudí jsou u Eurojackpotu euročísla,
 * u Euromilionů jedno číslo z 1–5; Sportka ho nemá.
 */
const OCEKAVANO: Readonly<Record<Hra, { cisla: number; druheOsudi: number }>> = {
  eurojackpot: { cisla: 5, druheOsudi: 2 },
  sportka: { cisla: 6, druheOsudi: 0 },
  euromiliony: { cisla: 7, druheOsudi: 1 },
};

const DNY: Readonly<Record<string, Den>> = {
  PO: 'po',
  ÚT: 'ut',
  UT: 'ut',
  ST: 'st',
  ČT: 'ct',
  CT: 'ct',
  PÁ: 'pa',
  PA: 'pa',
  SO: 'so',
  NE: 'ne',
};

/** Řádek sloupce začíná pořadím a dvojtečkou. Písmena se připouštějí kvůli záměnám. */
const ZACATEK_SLOUPCE = /^([\dIlOo|]{1,2})\s*[:;.]/;
/** Dny v závorce za počtem slosování: `(ÚT)`, `(ÚT,PÁ)`, `(ST, PA, NE)`. */
const DNY_V_ZAVORCE = /\(\s*([A-ZÁ-Ž]{2}(?:\s*[,.]\s*[A-ZÁ-Ž]{2})*)\s*\)/u;
/**
 * Počet slosování hned za popiskem: `SLOSOVÁNÍ: 4`. Tiket Euromilionů závorku se dny nemá,
 * takže počet se nesmí hledat jen před ní. Za číslem nesmí pokračovat další číslice ani tečka,
 * aby se při ztraceném počtu nevzal začátek data.
 */
const POCET_ZA_POPISKEM = /SL[O0]S[O0]V\S*\s*[:;.]?\s*([\dIlOo|]{1,2})(?![\p{L}\p{N}.,])/iu;
/** Záloha, když se popisek nepřečetl: číslo před závorkou se dny. */
const POCET_PRED_ZAVORKOU = /([\dIlOo|]{1,2})\s*\(/;
/** Řádek hlavičky. Nula místo písmene O se připouští — rozpoznávač to plete oběma směry. */
const SLOSOVANI = /SL[O0]S[O0]V/i;

/** Znak, který je buď číslice, nebo písmeno, za které ji rozpoznávač umí zaměnit. */
const CISLICE = `[\\d${Object.keys(ZAMENY).join('')}]`;
/**
 * Datum `08.09.2026` i v podobách, jaké z termotisku vrací rozpoznávač: `O8.09.2O26`,
 * `08. 09. 2026`, `08,09.2026`. Ohraničení brání tomu, aby se datum vykouslo z delšího textu.
 */
const DATUM = new RegExp(
  `(?<![\\p{L}\\p{N}])(${CISLICE}{2})\\s*[.,]\\s*(${CISLICE}{2})\\s*[.,]\\s*(${CISLICE}{4})(?![\\p{L}\\p{N}])`,
  'u',
);

export interface Hlavicka {
  /** Na kolik slosování tiket platí. Údaj je jen návrh — uživatel ho potvrzuje. */
  readonly pocetSlosovani: number | null;
  /**
   * Dny ze závorky v hlavičce, nebo `null`, když tam závorka není (Euromiliony ji netisknou).
   * Na tiketech ze 14. 9. 2026 to jsou vsazené dny: Sportka `6 (ST,PA,NE)` od středy do neděle
   * za dva týdny vychází přesně na šest slosování.
   */
  readonly dny: readonly Den[] | null;
  /** První slosování v ISO tvaru. */
  readonly datum: string | null;
}

export interface NactenySloupec {
  /** Pořadí sloupce vytištěné na tiketu, nebo `null`, když se nepřečetlo. */
  readonly poradi: number | null;
  readonly cisla: readonly number[];
  /** Euročísla (Eurojackpot) nebo číslo z druhého osudí (Euromiliony); u Sportky prázdné. */
  readonly druheOsudi: readonly number[];
  /** Útržky, u kterých bylo potřeba opravit záměnu písmene za číslici — k zvýraznění v UI. */
  readonly opravene: readonly string[];
  /** Původní text řádku, ať má uživatel co porovnat s papírem. */
  readonly text: string;
  readonly problemy: readonly Problem[];
}

export interface VysledekCteni {
  readonly hra: Hra;
  readonly hlavicka: Hlavicka;
  readonly sloupce: readonly NactenySloupec[];
  /**
   * Kód doplňkové hry přečtený z tiketu, nebo `null`. Z čárového kódu ho vzít nejde —
   * je v šifrovaném bloku — ale vytištěný na tiketu je.
   */
  readonly kodDoplnkoveHry: string | null;
  /** Cena tiketu přečtená z tiketu, nebo `null`. */
  readonly cenaKc: number | null;
  /** Řádky, které nevypadaly jako sloupec ani jako hlavička. Pro ladění a pro jistotu. */
  readonly nepouziteRadky: readonly string[];
}

/**
 * Najde v řádku datum a vrátí ho v ISO tvaru, nebo `null`.
 *
 * Záměny se opravují, ale výsledek musí být skutečné datum — `38.19.2026` není překlep, který
 * by šlo domyslet, a vymyšlené datum by tiket tiše vyhodnotilo proti jinému tahu.
 */
function najdiDatum(radek: string): string | null {
  const nalez = DATUM.exec(radek);
  if (nalez === null) return null;
  // Aspoň polovina číslic musí být skutečná, jinak by se datum dalo „opravit“ z písmen.
  if ((nalez[0].match(/\d/g) ?? []).length < 4) return null;

  const [den, mesic, rok] = [nalez[1]!, nalez[2]!, nalez[3]!].map((cast) =>
    Number([...cast].map((z) => ZAMENY[z] ?? z).join('')),
  ) as [number, number, number];

  const datum = new Date(Date.UTC(rok, mesic - 1, den));
  const platne =
    rok >= 2000 && rok <= 2099 && datum.getUTCMonth() === mesic - 1 && datum.getUTCDate() === den;
  if (!platne) return null;

  return `${rok}-${String(mesic).padStart(2, '0')}-${String(den).padStart(2, '0')}`;
}

/** Dny ze závorky. Nepřečtené dny se vynechají; když nezbude žádný, vrátí `null`. */
function prectiDny(hlavicka: string): readonly Den[] | null {
  const zavorka = DNY_V_ZAVORCE.exec(hlavicka);
  if (zavorka === null) return null;
  const dny = zavorka[1]!
    .split(/\s*[,.]\s*/)
    .map((zkratka) => DNY[zkratka])
    .filter((den): den is Den => den !== undefined);
  return dny.length === 0 ? null : [...new Set(dny)];
}

/**
 * Přečte hlavičku `SLOSOVÁNÍ: 1 (ÚT)   08.09.2026`.
 *
 * Na tiketu může být i jiné datum (podání sázky), takže se nebere první nalezené. Rozhoduje
 * řádek se `SLOSOVÁNÍ`; když rozpoznávač odtrhl datum do vedlejšího řádku, vezme se datum
 * nejbližší k němu. Teprve bez řádku `SLOSOVÁNÍ` rozhoduje první datum shora.
 */
function prectiHlavicku(radky: readonly string[]): Hlavicka {
  const indexSlosovani = radky.findIndex((r) => SLOSOVANI.test(r));
  const sDatem = radky
    .map((radek, index) => ({ radek, index, datum: najdiDatum(radek) }))
    .filter((r) => r.datum !== null);

  const kotva = indexSlosovani === -1 ? 0 : indexSlosovani;
  const nejblizsi = [...sDatem].sort(
    (a, b) => Math.abs(a.index - kotva) - Math.abs(b.index - kotva) || a.index - b.index,
  )[0];

  const hlavicka = indexSlosovani === -1 ? nejblizsi?.radek : radky[indexSlosovani];
  if (hlavicka === undefined) return { pocetSlosovani: null, dny: null, datum: null };

  const pocet = POCET_ZA_POPISKEM.exec(hlavicka) ?? POCET_PRED_ZAVORKOU.exec(hlavicka);

  return {
    pocetSlosovani: pocet === null ? null : (prectiCislo(pocet[1]!)?.hodnota ?? null),
    dny: prectiDny(hlavicka),
    datum: nejblizsi?.datum ?? null,
  };
}

function rozdelCisla(
  hodnoty: readonly NactenaHodnota[],
  hra: Hra,
): { cisla: number[]; druheOsudi: number[] } {
  const ocekavano = OCEKAVANO[hra];
  const cisla = hodnoty.slice(0, ocekavano.cisla).map((h) => h.hodnota);
  const zbytek = hodnoty.slice(ocekavano.cisla).map((h) => h.hodnota);

  // Přebývající čísla se nezahazují. Připojí se tam, kde je kontrola počtu odhalí,
  // aby o nich uživatel věděl a mohl je opravit.
  return ocekavano.druheOsudi === 0
    ? { cisla: [...cisla, ...zbytek], druheOsudi: [] }
    : { cisla, druheOsudi: zbytek };
}

function jakoSloupecTiketu(
  hra: Hra,
  cisla: readonly number[],
  druheOsudi: readonly number[],
): Sloupec {
  switch (hra) {
    case 'eurojackpot':
      return { hra, cisla, eurocisla: druheOsudi };
    case 'euromiliony':
      return { hra, cisla, druheOsudi };
    case 'sportka':
      return { hra, cisla };
  }
}

function jakoSloupec(text: string, hra: Hra): NactenySloupec | null {
  const zacatek = ZACATEK_SLOUPCE.exec(text);
  if (zacatek === null) return null;

  // Pořadí smí mít jednu číslici, čísla sloupce jsou vytištěná vždy jako dvojice — proto se
  // čtou každé zvlášť a pořadí se neplete do pravidla dvou cifer.
  const poradi = prectiCislo(zacatek[1]!);
  const hodnoty = prectiCislaSloupce(text.slice(zacatek[0].length));
  if (hodnoty.length === 0) return null; // samotné pořadí bez čísel není sloupec

  const { cisla, druheOsudi } = rozdelCisla(hodnoty, hra);
  const sloupec = jakoSloupecTiketu(hra, cisla, druheOsudi);
  // Slepený útržek dá víc čísel se stejným původem; uživateli stačí ho vidět jednou.
  const opravene = [poradi, ...hodnoty].filter((h) => h?.opraveno).map((h) => h!.puvodni);

  return {
    poradi: poradi?.hodnota ?? null,
    cisla,
    druheOsudi,
    opravene: [...new Set(opravene)],
    text,
    problemy: zkontrolujSloupec(sloupec),
  };
}

/** Přečte tiket z rozpoznaného textu. */
export function prectiTiket(
  utrzky: readonly RozpoznanyText[],
  hra: Hra,
  nastaveni: NastaveniSkladani = {},
): VysledekCteni {
  const radky = slozRadky(utrzky, nastaveni).map((r) => r.text);

  const sloupce: NactenySloupec[] = [];
  const nepouzite: string[] = [];

  for (const radek of radky) {
    const sloupec = jakoSloupec(radek, hra);
    if (sloupec === null) nepouzite.push(radek);
    else sloupce.push(sloupec);
  }

  return {
    hra,
    hlavicka: prectiHlavicku(nepouzite),
    sloupce,
    kodDoplnkoveHry: prectiKodDoplnkoveHry(nepouzite, hra),
    cenaKc: prectiCenu(nepouzite),
    nepouziteRadky: nepouzite,
  };
}

/** Je návrh natolik v pořádku, že se dá rovnou nabídnout k potvrzení? */
export function jeBezProblemu(vysledek: VysledekCteni): boolean {
  return (
    vysledek.sloupce.length > 0 &&
    vysledek.sloupce.every((s) => s.problemy.length === 0 && s.opravene.length === 0)
  );
}

/**
 * Sestaví tiket z přečtených sloupců. Identifikátor a kód doplňkové hry pocházejí z čárového
 * kódu, ne z OCR, takže se předávají zvlášť.
 */
export function naTiket(
  vysledek: VysledekCteni,
  doplnky: {
    id: string;
    kodDoplnkoveHry?: string | null;
    cenaKc?: number | null;
    dny?: readonly Den[] | null;
    vlozeno?: string;
  },
): Tiket {
  const sloupce: Sloupec[] = vysledek.sloupce.map((s) =>
    jakoSloupecTiketu(vysledek.hra, s.cisla, s.druheOsudi),
  );

  return {
    id: doplnky.id,
    hra: vysledek.hra,
    sloupce,
    slosovani: {
      prvni: vysledek.hlavicka.datum ?? '',
      pocet: vysledek.hlavicka.pocetSlosovani ?? 1,
      dny: doplnky.dny ?? null,
    },
    // Předaný kód má přednost před přečteným — volající může vědět víc.
    kodDoplnkoveHry: doplnky.kodDoplnkoveHry ?? vysledek.kodDoplnkoveHry,
    cenaKc: doplnky.cenaKc ?? vysledek.cenaKc,
    vlozeno: doplnky.vlozeno ?? new Date().toISOString(),
  };
}
