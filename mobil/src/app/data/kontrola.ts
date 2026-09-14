/**
 * Rozsah kontroly z formuláře — sdílené formulářem nového tiketu i úpravou v detailu.
 *
 * Tiket je virtuální, jen když se rozsah liší od papíru. Kdo nechá OD i DO tak, jak je
 * předvyplnil tiket, má obyčejný tiket; jinak by štítek „virtuální“ nesl skoro každý.
 */

import {
  datumPoslednihoSlosovani,
  type Datum,
  type Hra,
  type RozsahKontroly,
  type RozsahSlosovani,
  type Tah,
  type Tiket,
} from '@kontrola-tiketu/jadro';

/** Údaje z papíru, podle kterých se pozná, jestli je rozsah jiný. */
export interface Papir {
  readonly hra: Hra;
  readonly slosovani: RozsahSlosovani;
  readonly cenaKc: number | null;
}

/** Kde by kontrola podle papíru skončila. Bez data prvního slosování to nejde určit. */
export function konecPodlePapiru(papir: Papir, tahy: readonly Tah[]): Datum | null {
  if (papir.slosovani.prvni === '') return null;
  return datumPoslednihoSlosovani(papir.hra, papir.slosovani, tahy);
}

/**
 * Cena jednoho slosování podle papíru: cena tiketu vydělená počtem slosování, na haléře.
 * `null`, když cena tiketu není známá.
 */
export function cenaZaSlosovaniZPapiru(papir: Papir): number | null {
  if (papir.cenaKc === null || papir.slosovani.pocet < 1) return null;
  return Math.round((papir.cenaKc / papir.slosovani.pocet) * 100) / 100;
}

/**
 * Sestaví rozsah kontroly, nebo `null`, když odpovídá papíru.
 *
 * @param do Poslední den kontroly; `null` znamená bez konce.
 */
export function sestavKontrolu(
  papir: Papir,
  od: Datum,
  doData: Datum | null,
  cenaZaSlosovaniKc: number | null,
  tahy: readonly Tah[],
): RozsahKontroly | null {
  if (od === papir.slosovani.prvni && doData !== null && doData === konecPodlePapiru(papir, tahy)) {
    return null;
  }
  return { od, do: doData, cenaZaSlosovaniKc };
}

/** Tiket s novým rozsahem kontroly; `null` rozsah odstraní a tiket se kontroluje podle papíru. */
export function sRozsahem(tiket: Tiket, kontrola: RozsahKontroly | null): Tiket {
  const { kontrola: _puvodni, ...zbytek } = tiket;
  return kontrola === null ? zbytek : { ...zbytek, kontrola };
}

/** Text z pole s částkou → číslo. Prázdné nebo nesmyslné pole je neznámá cena. */
export function prectiCastku(text: string): number | null {
  const upraveny = text.trim().replace(',', '.');
  if (upraveny === '') return null;
  const cislo = Number(upraveny);
  return Number.isFinite(cislo) ? cislo : null;
}
