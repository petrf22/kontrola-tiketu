/**
 * Zpracování balíků stažených z backendu — bez Angularu a bez sítě, aby šlo otestovat.
 *
 * Každý balík je tentýž formát jako soubor od fetcheru, takže se čte stejným kódem jako
 * import (`nactiVysledky`). Ze stažení se tak nedá dostat nic, co by neprošlo stejnou
 * kontrolou jako soubor vybraný ručně.
 */

import { type SazbyExtra6, type Tah } from '@kontrola-tiketu/jadro';
import { nactiVysledky } from './import.js';
import type { StazenyBalik } from './stahovani.js';

export interface PrectenyBalik {
  readonly soubor: string;
  readonly hash: string;
  readonly tahy: readonly Tah[];
  readonly sazbyExtra6: readonly SazbyExtra6[];
}

export type VysledekZpracovani =
  | {
      readonly stav: 'ok';
      readonly baliky: readonly PrectenyBalik[];
      /** Tahy, které aplikace dosud neměla. */
      readonly pribylo: number;
      /** Tahy, které měla, ale v jiné podobě — typicky doplněná tabulka výher. */
      readonly zmeneno: number;
    }
  | { readonly stav: 'chyba'; readonly duvod: string };

const klic = (tah: Tah) => `${tah.hra}|${tah.datum}`;

/**
 * Přečte stažené balíky. Když nejde přečíst jediný, nevrátí nic — polovičně uložená
 * data by vypadala jako úplná.
 */
export function zpracujStazene(
  znameTahy: readonly Tah[],
  stazene: readonly StazenyBalik[],
): VysledekZpracovani {
  const baliky: PrectenyBalik[] = [];
  for (const balik of stazene) {
    const precteno = nactiVysledky(balik.text);
    if (precteno.stav === 'chyba') {
      return { stav: 'chyba', duvod: `Výsledky ze serveru nejdou přečíst: ${precteno.duvod}` };
    }
    baliky.push({
      soubor: balik.soubor,
      hash: balik.hash,
      tahy: precteno.tahy,
      sazbyExtra6: precteno.sazbyExtra6,
    });
  }

  const puvodni = new Map(znameTahy.map((t) => [klic(t), JSON.stringify(t)]));
  let pribylo = 0;
  let zmeneno = 0;
  for (const tah of baliky.flatMap((b) => b.tahy)) {
    const drive = puvodni.get(klic(tah));
    if (drive === undefined) pribylo += 1;
    else if (drive !== JSON.stringify(tah)) zmeneno += 1;
  }
  return { stav: 'ok', baliky, pribylo, zmeneno };
}

/** Věta pro uživatele po úspěšném stažení. */
export function shrnutiStazeni(pribylo: number, zmeneno: number): string {
  if (pribylo === 0 && zmeneno === 0) return 'Výsledky jsou aktuální, nic nového.';
  const casti = [
    pribylo > 0 ? `${pribylo} ${sklonuj(pribylo, 'nový tah', 'nové tahy', 'nových tahů')}` : null,
    zmeneno > 0 ? `${zmeneno} ${sklonuj(zmeneno, 'doplněný tah', 'doplněné tahy', 'doplněných tahů')}` : null,
  ].filter((c) => c !== null);
  return `Staženo: ${casti.join(', ')}.`;
}

function sklonuj(pocet: number, jeden: string, dva: string, pet: string): string {
  if (pocet === 1) return jeden;
  return pocet >= 2 && pocet <= 4 ? dva : pet;
}
