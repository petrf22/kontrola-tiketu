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
import { prectiCisla, type NactenaHodnota } from './cisla.js';
import { prectiCenu } from './cena.js';
import { prectiKodDoplnkoveHry } from './doplnkovaHra.js';
import { slozRadky, type NastaveniSkladani } from './radky.js';
import type { RozpoznanyText } from './model.js';

/** Kolik čísel se čeká ve sloupci které hry. */
const OCEKAVANO: Readonly<Record<Hra, { cisla: number; eurocisla: number }>> = {
  eurojackpot: { cisla: 5, eurocisla: 2 },
  sportka: { cisla: 6, eurocisla: 0 },
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
const DATUM = /(\d{2})\.\s?(\d{2})\.\s?(\d{4})/;
const DEN_V_ZAVORCE = /\(\s*([A-ZÁ-Ž]{2})\s*\)/u;

export interface Hlavicka {
  /** Na kolik slosování tiket platí. Údaj je jen návrh — uživatel ho potvrzuje. */
  readonly pocetSlosovani: number | null;
  readonly den: Den | null;
  /** První slosování v ISO tvaru. */
  readonly datum: string | null;
}

export interface NactenySloupec {
  /** Pořadí sloupce vytištěné na tiketu, nebo `null`, když se nepřečetlo. */
  readonly poradi: number | null;
  readonly cisla: readonly number[];
  readonly eurocisla: readonly number[];
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

function prectiHlavicku(radky: readonly string[]): Hlavicka {
  for (const radek of radky) {
    const datum = DATUM.exec(radek);
    if (datum === null) continue;

    const den = DEN_V_ZAVORCE.exec(radek);
    const pocet = /(\d{1,2})\s*\(/.exec(radek);

    return {
      pocetSlosovani: pocet === null ? null : Number(pocet[1]),
      den: den === null ? null : (DNY[den[1]!] ?? null),
      datum: `${datum[3]}-${datum[2]}-${datum[1]}`,
    };
  }
  return { pocetSlosovani: null, den: null, datum: null };
}

function rozdelCisla(
  hodnoty: readonly NactenaHodnota[],
  hra: Hra,
): { cisla: number[]; eurocisla: number[] } {
  const ocekavano = OCEKAVANO[hra];
  const cisla = hodnoty.slice(0, ocekavano.cisla).map((h) => h.hodnota);
  const zbytek = hodnoty.slice(ocekavano.cisla).map((h) => h.hodnota);

  // Přebývající čísla se nezahazují. Připojí se tam, kde je kontrola počtu odhalí,
  // aby o nich uživatel věděl a mohl je opravit.
  return ocekavano.eurocisla === 0
    ? { cisla: [...cisla, ...zbytek], eurocisla: [] }
    : { cisla, eurocisla: zbytek };
}

function jakoSloupec(text: string, hra: Hra): NactenySloupec | null {
  const zacatek = ZACATEK_SLOUPCE.exec(text);
  if (zacatek === null) return null;

  const hodnoty = prectiCisla(text);
  if (hodnoty.length < 2) return null; // samotné pořadí bez čísel není sloupec

  const poradi = hodnoty[0]!;
  const { cisla, eurocisla } = rozdelCisla(hodnoty.slice(1), hra);

  const sloupec: Sloupec =
    hra === 'eurojackpot' ? { hra, cisla, eurocisla } : { hra, cisla };

  return {
    poradi: poradi.hodnota,
    cisla,
    eurocisla,
    opravene: hodnoty.filter((h) => h.opraveno).map((h) => h.puvodni),
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
    vysledek.hra === 'eurojackpot'
      ? { hra: 'eurojackpot', cisla: s.cisla, eurocisla: s.eurocisla }
      : { hra: 'sportka', cisla: s.cisla },
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
