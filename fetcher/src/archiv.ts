/**
 * Archiv stažených výherních listin.
 *
 * Není to dočasná cache, ale trvalý archiv. Pravděpodobnější než zmizení zdroje je chyba
 * ve vlastním parseru; se syrovou zálohou se přeparsuje offline během vteřin, bez ní by se
 * muselo přes dva tisíce dotazů opakovat, což by nebylo slušné chování.
 *
 * Uzavřený týden se proto z webu nikdy nestahuje podruhé.
 */

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { gunzipSync, gzipSync } from 'node:zlib';
import { join } from 'node:path';
import type { Hra } from '@kontrola-tiketu/jadro';

export interface Souradnice {
  readonly hra: Hra;
  readonly rok: number;
  readonly tyden: number;
}

const NAZEV = /^(eurojackpot|sportka)-(\d{4})-(\d{2})\.html\.gz$/;

export function nazevSouboru({ hra, rok, tyden }: Souradnice): string {
  return `${hra}-${rok}-${String(tyden).padStart(2, '0')}.html.gz`;
}

export function cesta(koren: string, souradnice: Souradnice): string {
  return join(koren, nazevSouboru(souradnice));
}

export async function nactiZArchivu(
  koren: string,
  souradnice: Souradnice,
): Promise<string | null> {
  try {
    const data = await readFile(cesta(koren, souradnice));
    return gunzipSync(data).toString('utf8');
  } catch (chyba) {
    if ((chyba as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw chyba;
  }
}

export async function jeVArchivu(koren: string, souradnice: Souradnice): Promise<boolean> {
  return (await nactiZArchivu(koren, souradnice)) !== null;
}

export async function ulozDoArchivu(
  koren: string,
  souradnice: Souradnice,
  html: string,
): Promise<void> {
  await mkdir(koren, { recursive: true });
  await writeFile(cesta(koren, souradnice), gzipSync(Buffer.from(html, 'utf8'), { level: 9 }));
}

/** Co všechno archiv obsahuje, seřazeno chronologicky. */
export async function seznamArchivu(koren: string): Promise<Souradnice[]> {
  let soubory: string[];
  try {
    soubory = await readdir(koren);
  } catch (chyba) {
    if ((chyba as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw chyba;
  }

  return soubory
    .map((jmeno) => NAZEV.exec(jmeno))
    .filter((n): n is RegExpExecArray => n !== null)
    .map((n) => ({ hra: n[1] as Hra, rok: Number(n[2]), tyden: Number(n[3]) }))
    .sort((a, b) => a.rok - b.rok || a.tyden - b.tyden || a.hra.localeCompare(b.hra));
}
