/**
 * Čtení balíku s výsledky — staženého z backendu, nebo naimportovaného jako soubor (formát je týž).
 *
 * Každá cesta, kudy se do aplikace dostanou výsledky, jde přes tuhle kontrolu. O to
 * důležitější je poznat, že je něco špatně, a říct to. Tiše přečtený
 * cizí nebo starý soubor by znamenal špatně vyhodnocený tiket — a uživatel by se to dozvěděl
 * až u přepážky.
 */

import {
  VERZE_FORMATU,
  type Hra,
  type SazbyEurosance,
  type SazbyExtra6,
  type Tah,
} from '@kontrola-tiketu/jadro';
import { formatujDatum } from './format.js';

export interface UspesnyImport {
  readonly stav: 'ok';
  readonly tahy: readonly Tah[];
  readonly sazbyExtra6: readonly SazbyExtra6[];
  readonly sazbyEurosance: readonly SazbyEurosance[];
  readonly vygenerovano: string | null;
  readonly obdobi: { readonly od: string; readonly do: string } | null;
}

export interface NeuspesnyImport {
  readonly stav: 'chyba';
  /** Věta, kterou lze ukázat uživateli tak, jak je. */
  readonly duvod: string;
}

export type VysledekImportu = UspesnyImport | NeuspesnyImport;

const DATUM = /^\d{4}-\d{2}-\d{2}$/;

const ZNAME_HRY: readonly Hra[] = ['eurojackpot', 'sportka', 'euromiliony'];

/**
 * Hra, kterou aplikace nezná, v balíku není chyba — přibude-li na backendu další, starší
 * aplikace ji přeskočí a zbytek balíku přečte. Tiket takové hry v ní stejně být nemůže.
 */
function jeZnamaHra(tah: unknown): boolean {
  return jeObjekt(tah) && ZNAME_HRY.includes(tah['hra'] as Hra);
}

function chyba(duvod: string): NeuspesnyImport {
  return { stav: 'chyba', duvod };
}

function jeObjekt(hodnota: unknown): hodnota is Record<string, unknown> {
  return typeof hodnota === 'object' && hodnota !== null && !Array.isArray(hodnota);
}

/** Kontroluje jen to, na čem stojí vyhodnocení. Podrobnosti řeší jádro. */
function zkontrolujTah(tah: unknown, poradi: number): string | null {
  const kde = `Tah č. ${poradi + 1}`;
  if (!jeObjekt(tah)) return `${kde} není objekt.`;
  if (typeof tah['hra'] !== 'string') {
    return `${kde} nemá uvedenou hru.`;
  }
  // Neznámou hru nemá smysl kontrolovat — přeskočí se, viz jeZnamaHra.
  if (!jeZnamaHra(tah)) return null;
  if (typeof tah['datum'] !== 'string' || !DATUM.test(tah['datum'])) {
    return `${kde} nemá datum ve tvaru RRRR-MM-DD.`;
  }

  if (tah['hra'] === 'eurojackpot') {
    if (!Array.isArray(tah['cisla']) || !Array.isArray(tah['eurocisla'])) {
      return `${kde} (${tah['datum']}) nemá vylosovaná čísla.`;
    }
    // Prázdná tabulka je legitimní: u některých starších tahů Allwyn výsledky nezveřejnil.
    // Jádro pak řekne „tohle pořadí jsi trefil, ale částku neznám“. Chybějící pole ale
    // znamená cizí nebo poškozený soubor.
    if (!Array.isArray(tah['poradi'])) {
      return `${kde} (${tah['datum']}) nemá tabulku výher. Bez ní se nedá spočítat výhra.`;
    }
  } else if (tah['hra'] === 'euromiliony') {
    if (!Array.isArray(tah['cisla']) || typeof tah['druheOsudi'] !== 'number') {
      return `${kde} (${tah['datum']}) nemá vylosovaná čísla.`;
    }
    if (typeof tah['eurosance'] !== 'string') {
      return `${kde} (${tah['datum']}) nemá vylosovanou Eurošanci.`;
    }
    if (!Array.isArray(tah['poradi'])) {
      return `${kde} (${tah['datum']}) nemá tabulku výher. Bez ní se nedá spočítat výhra.`;
    }
  } else {
    if (!Array.isArray(tah['tahy']) || tah['tahy'].length !== 2) {
      return `${kde} (${tah['datum']}) nemá dva tahy Sportky.`;
    }
  }
  return null;
}

export function nactiVysledky(text: string): VysledekImportu {
  let obsah: unknown;
  try {
    obsah = JSON.parse(text);
  } catch {
    return chyba('Soubor není platný JSON. Vybral jsi opravdu balík s výsledky?');
  }

  if (!jeObjekt(obsah)) {
    return chyba('Soubor neobsahuje očekávaná data — čekal se objekt s tahy.');
  }

  const verze = obsah['verzeFormatu'];
  if (verze === undefined) {
    return chyba(
      'Soubor nemá uvedenou verzi formátu. Nejspíš to není balík s výsledky pro tuhle aplikaci.',
    );
  }
  if (verze !== VERZE_FORMATU) {
    const smer = typeof verze === 'number' && verze > VERZE_FORMATU ? 'novější' : 'starší';
    return chyba(
      `Soubor je ve formátu verze ${String(verze)}, aplikace umí verzi ${VERZE_FORMATU}. ` +
        `Je ${smer}, než aplikace očekává — ${smer === 'novější' ? 'aktualizuj aplikaci' : 'stáhni aktuální balík ze serveru'}.`,
    );
  }

  const tahy = obsah['tahy'];
  if (!Array.isArray(tahy)) {
    return chyba('Soubor neobsahuje seznam tahů.');
  }
  if (tahy.length === 0) {
    return chyba('Soubor neobsahuje žádný tah. Zkontroluj období, za které jsi ho vyrobil.');
  }

  for (const [i, tah] of tahy.entries()) {
    const problem = zkontrolujTah(tah, i);
    if (problem !== null) return chyba(problem);
  }

  const sazby = obsah['sazbyExtra6'];
  const sazbyEurosance = obsah['sazbyEurosance'];
  const obdobi = obsah['obdobi'];

  return {
    stav: 'ok',
    tahy: tahy.filter(jeZnamaHra) as Tah[],
    sazbyExtra6: Array.isArray(sazby) ? (sazby as SazbyExtra6[]) : [],
    sazbyEurosance: Array.isArray(sazbyEurosance) ? (sazbyEurosance as SazbyEurosance[]) : [],
    vygenerovano: typeof obsah['vygenerovano'] === 'string' ? obsah['vygenerovano'] : null,
    obdobi:
      jeObjekt(obdobi) && typeof obdobi['od'] === 'string' && typeof obdobi['do'] === 'string'
        ? { od: obdobi['od'], do: obdobi['do'] }
        : null,
  };
}

/** Krátké shrnutí pro uživatele po úspěšném importu. */
export function shrnutiImportu(vysledek: UspesnyImport): string {
  const podleHry = new Map<string, number>();
  for (const tah of vysledek.tahy) {
    podleHry.set(tah.hra, (podleHry.get(tah.hra) ?? 0) + 1);
  }
  const casti = [...podleHry.entries()].map(([hra, pocet]) => `${hra}: ${pocet}`);
  const rozsah =
    vysledek.tahy.length === 0
      ? ''
      : ` (${formatujDatum(vysledek.tahy[0]!.datum)} až ${formatujDatum(vysledek.tahy.at(-1)!.datum)})`;
  return `Načteno ${vysledek.tahy.length} tahů${rozsah} — ${casti.join(', ')}.`;
}
