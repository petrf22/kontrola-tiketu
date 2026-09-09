/**
 * Převod výstupu ML Kitu na vstup pro skládání řádků.
 *
 * Typy jsou tu popsané strukturálně, ne importované z pluginu. Knihovna tak zůstává čistá
 * a testovatelná bez zařízení, a přitom výsledek ML Kitu přijme beze změny.
 *
 * Pracuje se s řádky (`lines`), ne s bloky. Blok je na tiketu celý sloupec textu — levá část
 * řádků a euročísla skončí ve dvou různých blocích a spárovat je jde jedině přes rámečky
 * jednotlivých řádků.
 */

import type { RozpoznanyText } from './model.js';

export interface MlKitBod {
  readonly x: number;
  readonly y: number;
}

export interface MlKitRamecek {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface MlKitRadek {
  readonly text: string;
  readonly boundingBox?: MlKitRamecek | undefined;
  readonly cornerPoints?: readonly MlKitBod[] | undefined;
}

export interface MlKitBlok {
  readonly lines: readonly MlKitRadek[];
}

export interface MlKitVysledek {
  readonly blocks: readonly MlKitBlok[];
}

/** Rámeček z rohových bodů, když ML Kit `boundingBox` nedodá. */
function zRohu(rohy: readonly MlKitBod[]): { x: number; y: number; sirka: number; vyska: number } {
  const xs = rohy.map((b) => b.x);
  const ys = rohy.map((b) => b.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, sirka: Math.max(...xs) - x, vyska: Math.max(...ys) - y };
}

/**
 * Úhel řádku ze dvou horních rohů.
 *
 * ML Kit vrací rohy po směru hodinových ručiček od levého horního, takže první dva body
 * tvoří horní hranu. Je to přesnější než odhad z rozložení rámečků, tak ať se použije,
 * když je k dispozici.
 */
function uhelZRohu(rohy: readonly MlKitBod[]): number | undefined {
  const levy = rohy[0];
  const pravy = rohy[1];
  if (levy === undefined || pravy === undefined) return undefined;
  const dx = pravy.x - levy.x;
  if (Math.abs(dx) < 1) return undefined;
  return (Math.atan2(pravy.y - levy.y, dx) * 180) / Math.PI;
}

/**
 * Převede výsledek ML Kitu na útržky.
 *
 * Řádky bez rámečku i bez rohů se zahodí — bez polohy se nedají zařadit a hádat by znamenalo
 * přečíst tiket jinak, než na něm stojí.
 */
export function zMlKit(vysledek: MlKitVysledek): RozpoznanyText[] {
  const utrzky: RozpoznanyText[] = [];

  for (const blok of vysledek.blocks) {
    for (const radek of blok.lines) {
      const rohy = radek.cornerPoints;
      const ramecek =
        radek.boundingBox !== undefined
          ? {
              x: radek.boundingBox.left,
              y: radek.boundingBox.top,
              sirka: radek.boundingBox.right - radek.boundingBox.left,
              vyska: radek.boundingBox.bottom - radek.boundingBox.top,
            }
          : rohy !== undefined && rohy.length >= 4
            ? zRohu(rohy)
            : null;

      if (ramecek === null) continue;

      const uhel = rohy !== undefined && rohy.length >= 2 ? uhelZRohu(rohy) : undefined;
      utrzky.push(uhel === undefined ? { text: radek.text, ramecek } : { text: radek.text, ramecek, uhel });
    }
  }

  return utrzky;
}
