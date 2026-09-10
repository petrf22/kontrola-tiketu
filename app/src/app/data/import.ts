/**
 * Čtení souboru s výsledky — od fetcheru, nebo balíku staženého z backendu (formát je týž).
 *
 * Každá cesta, kudy se do aplikace dostanou výsledky, jde přes tuhle kontrolu. O to
 * důležitější je poznat, že je něco špatně, a říct to. Tiše přečtený
 * cizí nebo starý soubor by znamenal špatně vyhodnocený tiket — a uživatel by se to dozvěděl
 * až u přepážky.
 */

import { VERZE_FORMATU, type SazbyExtra6, type Tah } from '@kontrola-tiketu/jadro';
import { formatujDatum } from './format.js';

export interface UspesnyImport {
  readonly stav: 'ok';
  readonly tahy: readonly Tah[];
  readonly sazbyExtra6: readonly SazbyExtra6[];
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
  if (tah['hra'] !== 'eurojackpot' && tah['hra'] !== 'sportka') {
    return `${kde} má neznámou hru „${String(tah['hra'])}“.`;
  }
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
    return chyba('Soubor není platný JSON. Vybral jsi opravdu výstup z fetcheru?');
  }

  if (!jeObjekt(obsah)) {
    return chyba('Soubor neobsahuje očekávaná data — čekal se objekt s tahy.');
  }

  const verze = obsah['verzeFormatu'];
  if (verze === undefined) {
    return chyba(
      'Soubor nemá uvedenou verzi formátu. Nejspíš to není výstup z fetcheru tohoto projektu.',
    );
  }
  if (verze !== VERZE_FORMATU) {
    const smer = typeof verze === 'number' && verze > VERZE_FORMATU ? 'novější' : 'starší';
    return chyba(
      `Soubor je ve formátu verze ${String(verze)}, aplikace umí verzi ${VERZE_FORMATU}. ` +
        `Je ${smer}, než aplikace očekává — aktualizuj ${smer === 'novější' ? 'aplikaci' : 'fetcher'}.`,
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
  const obdobi = obsah['obdobi'];

  return {
    stav: 'ok',
    tahy: tahy as Tah[],
    sazbyExtra6: Array.isArray(sazby) ? (sazby as SazbyExtra6[]) : [],
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
