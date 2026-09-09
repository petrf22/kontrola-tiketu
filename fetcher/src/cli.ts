/**
 * CLI fetcheru.
 *
 * Dva režimy, schválně oddělené:
 *   stahni     síť → archiv. Jediné místo, které chodí na internet.
 *   preparsuj  archiv → JSON. Nesahá na síť vůbec, takže se parser dá opravovat donekonečna
 *              bez jediného dotazu na Allwyn.
 */

import { parseArgs } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Hra, SazbyExtra6, Tah } from '@kontrola-tiketu/jadro';
import { jeVArchivu, nactiZArchivu, seznamArchivu, ulozDoArchivu, type Souradnice } from './archiv.js';
import { ChybaObdobi, formatujTyden, parsujTyden, tydnyOdDo, type Tyden } from './obdobi.js';
import { Klient, ZakazanoRobots } from './stahovani.js';
import { jePrazdna, parsujListinu, sestavUrl, ZAKLADNI_URL } from './zdroje/allwyn-vyherka.js';
import { sestavVystup } from './vystup.js';

const HRY: readonly Hra[] = ['eurojackpot', 'sportka'];
/**
 * Výchozí archiv se odvozuje od umístění zdrojáku, ne od aktuálního adresáře. Přes npm
 * workspace se totiž CLI spouští s cwd v `fetcher/` a relativní cesta by mířila jinam,
 * než uživatel čeká.
 */
const KOREN_REPA = fileURLToPath(new URL('../../', import.meta.url));
const VYCHOZI_ARCHIV = join(KOREN_REPA, 'fetcher', '.cache');

export const NAPOVEDA = `Stahování a zpracování veřejných výherních listin Allwyn.

  vyherka stahni --od 2026-01 --do 2026-37 [--hra sportka] [--archiv CESTA]
  vyherka preparsuj --out vysledky.json [--od RRRR-TT] [--do RRRR-TT]
                    [--hra sportka] [--archiv CESTA] [--sazby data/sazby-extra6.json]
  vyherka stav [--archiv CESTA]

Týden se zadává jako RRRR-TT. Bez --hra se pracuje s oběma hrami.
U preparsuj omezují --od a --do, které listiny z archivu se zpracují.
Uzavřený týden, který už v archivu je, se znovu nestahuje.
`;

export interface Argumenty {
  readonly prikaz: 'stahni' | 'preparsuj' | 'stav';
  readonly od: Tyden | null;
  readonly do: Tyden | null;
  readonly hry: readonly Hra[];
  readonly archiv: string;
  readonly vystup: string | null;
  readonly sazby: string | null;
}

export class ChybaArgumentu extends Error {
  constructor(zprava: string) {
    super(zprava);
    this.name = 'ChybaArgumentu';
  }
}

export function parsujArgumenty(argv: readonly string[]): Argumenty {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      od: { type: 'string' },
      do: { type: 'string' },
      hra: { type: 'string' },
      archiv: { type: 'string' },
      out: { type: 'string' },
      sazby: { type: 'string' },
    },
  });

  const prikaz = positionals[0];
  if (prikaz !== 'stahni' && prikaz !== 'preparsuj' && prikaz !== 'stav') {
    throw new ChybaArgumentu(`Neznámý příkaz „${prikaz ?? ''}“.`);
  }

  if (values.hra !== undefined && !HRY.includes(values.hra as Hra)) {
    throw new ChybaArgumentu(`Neznámá hra „${values.hra}“. Možnosti: ${HRY.join(', ')}.`);
  }

  if (prikaz === 'stahni' && (values.od === undefined || values.do === undefined)) {
    throw new ChybaArgumentu('Příkaz stahni potřebuje --od a --do.');
  }
  if (prikaz === 'preparsuj' && values.out === undefined) {
    throw new ChybaArgumentu('Příkaz preparsuj potřebuje --out.');
  }

  return {
    prikaz,
    od: values.od === undefined ? null : parsujTyden(values.od),
    do: values.do === undefined ? null : parsujTyden(values.do),
    hry: values.hra === undefined ? HRY : [values.hra as Hra],
    archiv: values.archiv ?? VYCHOZI_ARCHIV,
    vystup: values.out ?? null,
    sazby: values.sazby ?? null,
  };
}

async function stahni(a: Argumenty): Promise<void> {
  const tydny = tydnyOdDo(a.od!, a.do!);
  const klient = new Klient();

  console.error(`Ověřuji robots.txt na ${new URL(ZAKLADNI_URL).origin}…`);
  await klient.nactiRobots(ZAKLADNI_URL);

  let stazeno = 0;
  let preskoceno = 0;
  let prazdnych = 0;

  for (const hra of a.hry) {
    for (const tyden of tydny) {
      const souradnice = { hra, ...tyden };
      if (await jeVArchivu(a.archiv, souradnice)) {
        preskoceno += 1;
        continue;
      }

      const html = await klient.stahni(sestavUrl(hra, tyden.rok, tyden.tyden));
      await ulozDoArchivu(a.archiv, souradnice, html);
      stazeno += 1;
      if (jePrazdna(html)) {
        prazdnych += 1;
      } else {
        console.error(`  ${hra} ${formatujTyden(tyden)}`);
      }
    }
  }

  console.error(
    `Hotovo: ${stazeno} staženo (z toho ${prazdnych} prázdných), ${preskoceno} už bylo v archivu. Dotazů celkem: ${klient.pocetDotazu}.`,
  );
}

async function nactiSazby(cesta: string | null): Promise<SazbyExtra6[]> {
  if (cesta === null) return [];
  const obsah = JSON.parse(await readFile(cesta, 'utf8')) as { sazby?: SazbyExtra6[] };
  return obsah.sazby ?? [];
}

/** Pořadové číslo týdne pro porovnávání rozsahů. */
function klicTydne({ rok, tyden }: Tyden): number {
  return rok * 100 + tyden;
}

/** Které listiny z archivu se mají zpracovat podle zadaných her a období. */
export function vyberZArchivu(
  zaznamy: readonly Souradnice[],
  hry: readonly Hra[],
  od: Tyden | null,
  doTydne: Tyden | null,
): Souradnice[] {
  return zaznamy
    .filter((z) => hry.includes(z.hra))
    .filter((z) => od === null || klicTydne(z) >= klicTydne(od))
    .filter((z) => doTydne === null || klicTydne(z) <= klicTydne(doTydne));
}

async function preparsuj(a: Argumenty): Promise<void> {
  const vsechny = await seznamArchivu(a.archiv);
  const zaznamy = vyberZArchivu(vsechny, a.hry, a.od, a.do);

  if (vsechny.length === 0) {
    throw new ChybaArgumentu(`Archiv ${a.archiv} je prázdný. Nejdřív spusť „stahni“.`);
  }
  if (zaznamy.length === 0) {
    throw new ChybaArgumentu(
      `V archivu ${a.archiv} není nic, co by odpovídalo zadanému období a hrám.`,
    );
  }

  const tahy: Tah[] = [];
  let prazdnych = 0;

  for (const zaznam of zaznamy) {
    const html = await nactiZArchivu(a.archiv, zaznam);
    if (html === null) continue;
    if (jePrazdna(html)) {
      prazdnych += 1;
      continue;
    }
    tahy.push(...parsujListinu(html));
  }

  const obdobi =
    a.od !== null && a.do !== null
      ? { od: a.od, do: a.do }
      : {
          od: { rok: zaznamy[0]!.rok, tyden: zaznamy[0]!.tyden },
          do: { rok: zaznamy.at(-1)!.rok, tyden: zaznamy.at(-1)!.tyden },
        };

  const vystup = sestavVystup(tahy, await nactiSazby(a.sazby), obdobi);
  await writeFile(a.vystup!, `${JSON.stringify(vystup, null, 2)}\n`, 'utf8');

  console.error(
    `Zapsáno ${vystup.tahy.length} tahů do ${a.vystup} (${zaznamy.length} listin, z toho ${prazdnych} prázdných). Bez jediného dotazu na síť.`,
  );
}

async function stav(a: Argumenty): Promise<void> {
  const zaznamy = await seznamArchivu(a.archiv);
  if (zaznamy.length === 0) {
    console.log(`Archiv ${a.archiv} je prázdný.`);
    return;
  }
  for (const hra of HRY) {
    const jeho = zaznamy.filter((z) => z.hra === hra);
    if (jeho.length === 0) continue;
    console.log(
      `${hra}: ${jeho.length} listin, ${formatujTyden(jeho[0]!)} až ${formatujTyden(jeho.at(-1)!)}`,
    );
  }
}

export async function hlavni(argv: readonly string[]): Promise<number> {
  let argumenty: Argumenty;
  try {
    argumenty = parsujArgumenty(argv);
  } catch (chyba) {
    if (chyba instanceof ChybaArgumentu || chyba instanceof ChybaObdobi) {
      console.error(`${chyba.message}\n\n${NAPOVEDA}`);
      return 2;
    }
    throw chyba;
  }

  try {
    if (argumenty.prikaz === 'stahni') await stahni(argumenty);
    else if (argumenty.prikaz === 'preparsuj') await preparsuj(argumenty);
    else await stav(argumenty);
    return 0;
  } catch (chyba) {
    if (chyba instanceof ZakazanoRobots) {
      console.error(chyba.message);
      return 3;
    }
    console.error(chyba instanceof Error ? chyba.message : String(chyba));
    return 1;
  }
}

