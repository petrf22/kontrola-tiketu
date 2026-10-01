/**
 * Prohlížení vylosovaných čísel a tabulek výher.
 *
 * Bere jen tahy, které už aplikace má v telefonu — nic se kvůli tomu nestahuje. Tahy se
 * převádějí na jednotný tvar, aby šablona nemusela rozlišovat hry.
 */

import {
  sousedniCislice,
  vyberSazby,
  type Datum,
  type Den,
  type Hra,
  type Poradi,
  type PoradiKoncoveCislice,
  type SazbyEurosance,
  type SazbyExtra6,
  type Tah,
} from '@kontrola-tiketu/jadro';
import { HRY, nazevDoplnkoveHry, nazevPoradiDoplnkoveHry } from './format.js';

export interface FiltrTahu {
  readonly hra: Hra | 'vse';
  /** Poslední zobrazený den včetně; `null` = od nejnovějšího tahu. */
  readonly doData: Datum | null;
}
export const VYCHOZI_FILTR_TAHU: FiltrTahu = { hra: 'vse', doData: null };

/** Tahy odpovídající filtru, nejnovější první; tahy téhož dne v pořadí {@link HRY}. */
export function filtrujTahy(tahy: readonly Tah[], filtr: FiltrTahu): Tah[] {
  return tahy
    .filter(t => (filtr.hra === 'vse' || t.hra === filtr.hra) && (filtr.doData === null || t.datum <= filtr.doData))
    .sort((a, b) => b.datum.localeCompare(a.datum) || HRY.indexOf(a.hra) - HRY.indexOf(b.hra));
}

export interface Osudi {
  /** `1. tah` u Sportky, jinak `null`. */
  readonly nadpis: string | null;
  /** Vzestupně, tak se čísla hledají nejlíp. */
  readonly cisla: readonly number[];
  /** Tak, jak padala. */
  readonly vPoradiLosovani: readonly number[];
  readonly druhe: readonly number[];
  /** `euročísla`, `druhé osudí`, `dodatkové`. */
  readonly nazevDruhych: string;
}

export interface RadekVyher {
  readonly popis: string;
  /** Vylosovaný konec u doplňkové hry, např. `412` u trojčíslí. */
  readonly vzor: string | null;
  /** `null` u pevných výher, kde listina počty neuvádí. */
  readonly pocetVyher: number | null;
  readonly castkaKc: number;
}

export interface TabulkaVyher {
  readonly nadpis: string;
  readonly radky: readonly RadekVyher[];
  readonly poznamka: string | null;
}

export interface ZobrazenyTah {
  readonly klic: string;
  readonly hra: Hra;
  readonly datum: Datum;
  readonly den: Den;
  readonly osudi: readonly Osudi[];
  readonly doplnkova: { readonly nazev: string; readonly cislice: string } | null;
  /** Prázdné, dokud listina tabulku nepublikuje. */
  readonly tabulky: readonly TabulkaVyher[];
  readonly jackpot: { readonly nazev: string; readonly castkaKc: number } | null;
  readonly vsazenoKc: number;
  readonly naVyhryKc: number | null;
}

const vzestupne = (cisla: readonly number[]) => [...cisla].sort((a, b) => a - b);

function osudi(nadpis: string | null, cisla: readonly number[], druhe: readonly number[], nazevDruhych: string): Osudi {
  return { nadpis, cisla: vzestupne(cisla), vPoradiLosovani: cisla, druhe: vzestupne(druhe), nazevDruhych };
}

function radky(poradi: readonly Poradi[]): RadekVyher[] {
  return poradi.map(p => ({ popis: p.popis, vzor: null, pocetVyher: p.pocetVyher, castkaKc: p.vyseVyhryKc }));
}

const DELKA: Readonly<Record<PoradiKoncoveCislice, number>> = {
  sestecisli: 6, peticisli: 5, ctyrcisli: 4, trojcisli: 3, dvojcisli: 2, 'koncove-cislo': 1, 'sousedni-cislo': 0,
};

/** U sousedního čísla jsou výherní oba sousedé koncové číslice: `1 nebo 9`. */
function vzor(klic: PoradiKoncoveCislice, cislice: string): string {
  return klic === 'sousedni-cislo' ? sousedniCislice(cislice.at(-1)!).sort().join(' nebo ') : cislice.slice(-DELKA[klic]);
}

const PEVNE = 'Výhry jsou pevné podle herního plánu, počty výherců listina neuvádí.';

/**
 * Extra 6 listina nepublikuje — částky jsou násobky sázky platné v den tahu. Pořadí, které
 * tehdy herní plán neznal (`null`), se nevypisuje.
 */
function tabulkaExtra6(datum: Datum, cislice: string, sazby: readonly SazbyExtra6[]): TabulkaVyher {
  const platne = vyberSazby(sazby, datum);
  if (platne === null) return { nadpis: 'Extra 6', radky: [], poznamka: 'Sazby Extra 6 pro tento den aplikace nemá.' };
  const radkyExtra6 = (Object.keys(DELKA) as PoradiKoncoveCislice[]).flatMap(klic => {
    const nasobek = platne.nasobky[klic];
    return nasobek === null ? [] : [{ popis: nazevPoradiDoplnkoveHry(klic), vzor: vzor(klic, cislice), pocetVyher: null, castkaKc: nasobek * platne.sazkaKc }];
  });
  return { nadpis: 'Extra 6', radky: radkyExtra6, poznamka: `${PEVNE} Šestičíslí se při více než dvou výhrách dělí.` };
}

/** Eurošance stejně jako Extra 6 — pevné výhry ze sazeb, jen přímo v korunách. */
function tabulkaEurosance(datum: Datum, cislice: string, sazby: readonly SazbyEurosance[]): TabulkaVyher {
  const platne = vyberSazby(sazby, datum);
  if (platne === null) return { nadpis: 'Eurošance', radky: [], poznamka: 'Sazby Eurošance pro tento den aplikace nemá.' };
  const radkyEurosance = (Object.keys(DELKA) as PoradiKoncoveCislice[]).flatMap(klic => {
    const castka = (platne.vyhryKc as Partial<Record<PoradiKoncoveCislice, number>>)[klic];
    return castka === undefined ? [] : [{ popis: nazevPoradiDoplnkoveHry(klic), vzor: vzor(klic, cislice), pocetVyher: null, castkaKc: castka }];
  });
  return { nadpis: 'Eurošance', radky: radkyEurosance, poznamka: PEVNE };
}

export function zobrazTah(tah: Tah, sazby: readonly SazbyExtra6[], sazbyEurosance: readonly SazbyEurosance[]): ZobrazenyTah {
  const zaklad = {
    klic: `${tah.hra}-${tah.datum}`, hra: tah.hra, datum: tah.datum, den: tah.den,
    vsazenoKc: tah.vsazenoKc, naVyhryKc: tah.naVyhryKc,
  };
  const jackpot = (castkaKc: number | null, nazev = 'Jackpot') => (castkaKc === null || castkaKc === 0 ? null : { nazev, castkaKc });

  switch (tah.hra) {
    case 'eurojackpot': {
      const hlavni = tah.poradi.length === 0 ? [] : [{ nadpis: 'Eurojackpot', radky: radky(tah.poradi), poznamka: null }];
      return {
        ...zaklad,
        osudi: [osudi(null, tah.cisla, tah.eurocisla, 'euročísla')],
        doplnkova: { nazev: nazevDoplnkoveHry('eurojackpot'), cislice: tah.extra6 },
        // Extra 6 má pevné výhry, ale dokud chybí hlavní tabulka, tah se jeví jako nehotový celý.
        tabulky: hlavni.length === 0 ? [] : [...hlavni, tabulkaExtra6(tah.datum, tah.extra6, sazby)],
        jackpot: jackpot(tah.jackpotKc),
      };
    }
    case 'euromiliony': {
      const hlavni = tah.poradi.length === 0 ? [] : [{ nadpis: 'Euromiliony', radky: radky(tah.poradi), poznamka: null }];
      return {
        ...zaklad,
        osudi: [osudi(null, tah.cisla, [tah.druheOsudi], 'druhé osudí')],
        doplnkova: { nazev: nazevDoplnkoveHry('euromiliony'), cislice: tah.eurosance },
        tabulky: hlavni.length === 0 ? [] : [...hlavni, tabulkaEurosance(tah.datum, tah.eurosance, sazbyEurosance)],
        jackpot: jackpot(tah.jackpotKc),
      };
    }
    case 'sportka': {
      // Bonus je společný oběma tahům — listina ho opakuje u každého, ukáže se jednou.
      const bonus = tah.tahy[0].poradi.filter(p => p.klic === 'bonus');
      const tabulkyTahu = tah.tahy
        .filter(t => t.poradi.length > 0)
        .map(t => ({ nadpis: `${t.poradiTahu}. tah`, radky: radky(t.poradi.filter(p => p.klic !== 'bonus')), poznamka: null }));
      const sance = tah.sance;
      return {
        ...zaklad,
        osudi: tah.tahy.map(t => osudi(`${t.poradiTahu}. tah`, t.cisla, [t.dodatkove], 'dodatkové')),
        doplnkova: sance === null ? null : { nazev: nazevDoplnkoveHry('sportka'), cislice: sance.cislice },
        tabulky: tabulkyTahu.length === 0 ? [] : [
          ...tabulkyTahu,
          ...(bonus.length > 0 ? [{ nadpis: 'Bonus', radky: radky(bonus), poznamka: null }] : []),
          ...(sance === null || sance.poradi.length === 0 ? [] : [{
            nadpis: 'Šance',
            radky: sance.poradi.map(p => ({ popis: p.popis, vzor: p.vzor ?? (p.klic === 'sousedni-cislo' ? vzor(p.klic, sance.cislice) : null), pocetVyher: p.pocetVyher, castkaKc: p.vyseVyhryKc })),
            poznamka: null,
          }]),
        ],
        jackpot: jackpot(tah.superJackpotKc, 'Superjackpot'),
      };
    }
  }
}
