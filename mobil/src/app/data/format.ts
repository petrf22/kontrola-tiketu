/**
 * České formátování dat a časů.
 *
 * Aplikace uvnitř pracuje s ISO tvarem `RRRR-MM-DD`, protože se dobře řadí a porovnává.
 * Uživateli se ale nikdy nemá ukazovat — čte se špatně a v Česku se tak datum nepíše.
 */

import type { Hra } from '@kontrola-tiketu/jadro';

const DATUM = new Intl.DateTimeFormat('cs-CZ', {
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
});

const DATUM_CAS = new Intl.DateTimeFormat('cs-CZ', {
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const DNY: Readonly<Record<string, string>> = {
  po: 'pondělí', ut: 'úterý', st: 'středa', ct: 'čtvrtek',
  pa: 'pátek', so: 'sobota', ne: 'neděle',
};

/** `2026-09-08` → `8. 9. 2026`. Nesrozumitelný vstup vrací beze změny. */
export function formatujDatum(iso: string): string {
  const datum = new Date(iso);
  return Number.isNaN(datum.getTime()) ? iso : DATUM.format(datum);
}

/** `2026-09-09T17:11:57Z` → `9. 9. 2026 19:11` v místním čase. */
export function formatujDatumCas(iso: string): string {
  const datum = new Date(iso);
  return Number.isNaN(datum.getTime()) ? iso : DATUM_CAS.format(datum);
}

export function nazevDne(zkratka: string): string {
  return DNY[zkratka] ?? zkratka;
}

const VE_DNECH: Readonly<Record<string, string>> = {
  po: 'v pondělí', ut: 'v úterý', st: 've středu', ct: 've čtvrtek',
  pa: 'v pátek', so: 'v sobotu', ne: 'v neděli',
};

/**
 * `['st', 'ne']` → `jen ve středu a v neděli`. Tiket na všechna slosování (`null`) nemá
 * co upřesňovat, vrací prázdný řetězec.
 */
export function popisDnuSlosovani(dny: readonly string[] | null): string {
  if (dny === null || dny.length === 0) return '';
  const nazvy = dny.map((den) => VE_DNECH[den] ?? den);
  const posledni = nazvy.pop()!;
  return `jen ${nazvy.length > 0 ? `${nazvy.join(', ')} a ${posledni}` : posledni}`;
}

/**
 * Názvy pořadí doplňkové hry. Šance je má i v listině (`popis`), Extra 6 ale ne, takže by
 * se uživateli jinak ukázal holý klíč z modelu — „pořadí trojcisli“.
 */
const PORADI_DOPLNKOVE: Readonly<Record<string, string>> = {
  sestecisli: 'šestičíslí',
  peticisli: 'pětičíslí',
  ctyrcisli: 'čtyřčíslí',
  trojcisli: 'trojčíslí',
  dvojcisli: 'dvojčíslí',
  'koncove-cislo': 'koncové číslo',
  'sousedni-cislo': 'sousední číslo',
};

export function nazevPoradiDoplnkoveHry(klic: string): string {
  return PORADI_DOPLNKOVE[klic] ?? klic;
}

const NAZVY_HER: Readonly<Record<Hra, string>> = {
  eurojackpot: 'Eurojackpot',
  sportka: 'Sportka',
  euromiliony: 'Euromiliony',
};

/** Hry v pořadí, v jakém je aplikace nabízí. */
export const HRY: readonly Hra[] = ['eurojackpot', 'sportka', 'euromiliony'];

export function nazevHry(hra: Hra): string {
  return NAZVY_HER[hra];
}

const NAZVY_DOPLNKOVYCH_HER: Readonly<Record<Hra, string>> = {
  eurojackpot: 'Extra 6',
  sportka: 'Šance',
  euromiliony: 'Eurošance',
};

/** Extra 6, Šance, nebo Eurošance. */
export function nazevDoplnkoveHry(hra: Hra): string {
  return NAZVY_DOPLNKOVYCH_HER[hra];
}

/** `1 sloupec`, `3 sloupce`, `5 sloupců` — čeština má tři tvary, ne dva. */
export function pocetSloupcu(pocet: number): string {
  if (pocet === 1) return '1 sloupec';
  if (pocet >= 2 && pocet <= 4) return `${pocet} sloupce`;
  return `${pocet} sloupců`;
}
