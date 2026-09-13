/**
 * Kontroly vstupů. Vrací seznam problémů, nevyhazuje výjimky — stejná funkce slouží
 * vyhodnocovacímu jádru i obrazovce, kde uživatel potvrzuje naOCRovaná čísla, a tam je
 * potřeba ukázat všechny chyby najednou, ne jen tu první.
 */

import type { Den, Hra, Sloupec, Tiket } from './model.js';

export interface Problem {
  readonly kod: ProblemKod;
  readonly zprava: string;
  /** Kde problém je, např. `sloupce[2].eurocisla`. */
  readonly cesta: string;
}

export type ProblemKod =
  | 'spatny-pocet-cisel'
  | 'cislo-mimo-rozsah'
  | 'duplicitni-cislo'
  | 'spatny-format-sesticisli'
  | 'zadny-sloupec'
  | 'nesouhlasi-hra'
  | 'spatny-pocet-slosovani'
  | 'prazdny-seznam-dnu';

/** Rozsahy podle herního plánu. */
export const ROZSAHY = {
  eurojackpot: { cisla: { pocet: 5, min: 1, max: 50 }, eurocisla: { pocet: 2, min: 1, max: 12 } },
  sportka: { cisla: { pocet: 6, min: 1, max: 49 } },
} as const;

/**
 * Dny, na které jde hru vsadit. Slouží jen jako nabídka ve formuláři tiketu — vyhodnocení
 * se řídí dny skutečných tahů z dat, takže změna rozvrhu ho nerozbije. Pořadí je pořadí týdne.
 */
export const DNY_LOSOVANI: Readonly<Record<Hra, readonly Den[]>> = {
  eurojackpot: ['ut', 'pa'],
  sportka: ['st', 'pa', 'ne'],
};

/**
 * Zaškrtnuté dny z formuláře → `RozsahSlosovani.dny`.
 *
 * Všechny dny hry znamenají všechna slosování, tedy `null` — běžný tiket tak zůstane
 * nezávislý na rozvrhu a započítá i losování mimo něj. Jinak vrací vybrané dny v pořadí
 * týdne. Prázdný výběr vrátí prázdný seznam, ať ho zachytí {@link zkontrolujTiket}.
 */
export function dnyZVyberu(hra: Hra, zaskrtnute: readonly Den[]): Den[] | null {
  const nabidka = DNY_LOSOVANI[hra];
  const vybrane = nabidka.filter((den) => zaskrtnute.includes(den));
  return vybrane.length === nabidka.length ? null : vybrane;
}

const SESTICISLI = /^[0-9]{6}$/;

interface Ocekavani {
  readonly pocet: number;
  readonly min: number;
  readonly max: number;
}

/**
 * Zkontroluje jednu skupinu tipovaných čísel: počet, rozsah a duplicity.
 * Sdílí ji Eurojackpot i Sportka, protože pravidla se liší jen čísly v `ocekavani`.
 */
export function zkontrolujCisla(
  cisla: readonly number[],
  ocekavani: Ocekavani,
  cesta: string,
): Problem[] {
  const problemy: Problem[] = [];

  if (cisla.length !== ocekavani.pocet) {
    problemy.push({
      kod: 'spatny-pocet-cisel',
      zprava: `Očekává se ${ocekavani.pocet} čísel, zadáno ${cisla.length}.`,
      cesta,
    });
  }

  for (const [i, cislo] of cisla.entries()) {
    if (!Number.isInteger(cislo) || cislo < ocekavani.min || cislo > ocekavani.max) {
      problemy.push({
        kod: 'cislo-mimo-rozsah',
        zprava: `Číslo ${cislo} je mimo rozsah ${ocekavani.min}–${ocekavani.max}.`,
        cesta: `${cesta}[${i}]`,
      });
    }
  }

  const videna = new Set<number>();
  for (const [i, cislo] of cisla.entries()) {
    if (videna.has(cislo)) {
      problemy.push({
        kod: 'duplicitni-cislo',
        zprava: `Číslo ${cislo} je ve sloupci dvakrát.`,
        cesta: `${cesta}[${i}]`,
      });
    }
    videna.add(cislo);
  }

  return problemy;
}

export function zkontrolujSloupec(sloupec: Sloupec, cesta = 'sloupec'): Problem[] {
  if (sloupec.hra === 'eurojackpot') {
    return [
      ...zkontrolujCisla(sloupec.cisla, ROZSAHY.eurojackpot.cisla, `${cesta}.cisla`),
      ...zkontrolujCisla(sloupec.eurocisla, ROZSAHY.eurojackpot.eurocisla, `${cesta}.eurocisla`),
    ];
  }
  return zkontrolujCisla(sloupec.cisla, ROZSAHY.sportka.cisla, `${cesta}.cisla`);
}

/** Šestičíslí Šance i Extra 6 je řetězec právě šesti číslic — vedoucí nuly jsou významné. */
export function zkontrolujSesticisli(hodnota: string, cesta: string): Problem[] {
  if (SESTICISLI.test(hodnota)) return [];
  return [
    {
      kod: 'spatny-format-sesticisli',
      zprava: `Očekává se šest číslic, zadáno „${hodnota}“.`,
      cesta,
    },
  ];
}

export function zkontrolujTiket(tiket: Tiket): Problem[] {
  const problemy: Problem[] = [];

  if (tiket.sloupce.length === 0) {
    problemy.push({
      kod: 'zadny-sloupec',
      zprava: 'Tiket neobsahuje žádný sloupec.',
      cesta: 'sloupce',
    });
  }

  for (const [i, sloupec] of tiket.sloupce.entries()) {
    if (sloupec.hra !== tiket.hra) {
      problemy.push({
        kod: 'nesouhlasi-hra',
        zprava: `Sloupec je pro hru ${sloupec.hra}, ale tiket je ${tiket.hra}.`,
        cesta: `sloupce[${i}]`,
      });
      continue;
    }
    problemy.push(...zkontrolujSloupec(sloupec, `sloupce[${i}]`));
  }

  if (!Number.isInteger(tiket.slosovani.pocet) || tiket.slosovani.pocet < 1) {
    problemy.push({
      kod: 'spatny-pocet-slosovani',
      zprava: `Počet slosování musí být alespoň 1, zadáno ${tiket.slosovani.pocet}.`,
      cesta: 'slosovani.pocet',
    });
  }

  if (tiket.slosovani.dny !== null && tiket.slosovani.dny.length === 0) {
    problemy.push({
      kod: 'prazdny-seznam-dnu',
      zprava: 'Vyber alespoň jeden den slosování.',
      cesta: 'slosovani.dny',
    });
  }

  if (tiket.kodDoplnkoveHry !== null) {
    problemy.push(...zkontrolujSesticisli(tiket.kodDoplnkoveHry, 'kodDoplnkoveHry'));
  }

  return problemy;
}

export function jePlatny(problemy: readonly Problem[]): boolean {
  return problemy.length === 0;
}
