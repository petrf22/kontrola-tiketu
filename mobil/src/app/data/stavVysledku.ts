/**
 * Do kdy má aplikace výsledky — u každé hry zvlášť.
 *
 * Jedno společné datum klame: v úterý večer dorazí Euromiliony dřív než Eurojackpot, a „výsledky
 * do 13. 10.“ by pak platilo jen pro jednu z nich. Kdo čeká na Eurojackpot, nepozná, jestli
 * se má divit. Proto se tu počítá i to, které losování podle rozvrhu už proběhlo, ale
 * výsledky k němu chybí.
 */

import { DNY_LOSOVANI, type Den, type Hra, type Tah } from '@kontrola-tiketu/jadro';
import { dnesniDatum, formatujDatum, HRY, nazevHry } from './format.js';

/**
 * Od kdy se dnešní losování počítá jako proběhlé. Euromiliony losují od 19 hodin (herní plán,
 * bod 7), Eurojackpot a Sportka později. Dřív by patička v den losování hlásila chybějící
 * výsledky celé dopoledne — a to je pět dní v týdnu.
 */
export const LOSUJE_SE_OD_HODIN = 19;

/** Starší chybějící losování se nevypisují; na výpadek stačí upozornit tím nejstarším z týdne. */
const DNU_ZPETNE = 7;

const DNY: readonly Den[] = ['ne', 'po', 'ut', 'st', 'ct', 'pa', 'so'];

export interface StavVysledkuHry {
  readonly hra: Hra;
  /** Poslední tah hry, který aplikace má. */
  readonly posledni: string;
  /** Losování podle rozvrhu po `posledni`, která už proběhla, od nejstaršího. */
  readonly chybi: readonly string[];
}

/** Stav výsledků her, od kterých má aplikace aspoň jeden tah, v pořadí nabídky her. */
export function stavVysledku(
  tahy: readonly Pick<Tah, 'hra' | 'datum'>[],
  ted: Date,
): readonly StavVysledkuHry[] {
  const posledni = new Map<Hra, string>();
  for (const tah of tahy) {
    const drive = posledni.get(tah.hra);
    if (drive === undefined || tah.datum > drive) posledni.set(tah.hra, tah.datum);
  }

  // Poledne: přechod na letní čas posune půlnoc, poledne ne.
  const dny: { datum: string; den: Den }[] = [];
  for (let zpet = DNU_ZPETNE; zpet >= 0; zpet--) {
    const den = new Date(ted.getFullYear(), ted.getMonth(), ted.getDate() - zpet, 12);
    if (zpet === 0 && ted.getHours() < LOSUJE_SE_OD_HODIN) continue;
    dny.push({ datum: dnesniDatum(den), den: DNY[den.getDay()]! });
  }

  return HRY.flatMap((hra) => {
    const datum = posledni.get(hra);
    if (datum === undefined) return [];
    const chybi = dny.filter((d) => d.datum > datum && DNY_LOSOVANI[hra].includes(d.den)).map((d) => d.datum);
    return [{ hra, posledni: datum, chybi }];
  });
}

/** `Eurojackpot 9. 10. 2026` — do kdy hra výsledky má. */
export function popisPoslednihoTahu(stav: StavVysledkuHry): string {
  return `${nazevHry(stav.hra)} ${formatujDatum(stav.posledni)}`;
}

/** `Eurojackpot 13. 10. 2026 zatím není.` Prázdné, když nic nechybí. */
export function vetaOChybejicich(stav: StavVysledkuHry): string {
  if (stav.chybi.length === 0) return '';
  const data = stav.chybi.map(formatujDatum);
  const vycet = data.length === 1 ? data[0]! : `${data.slice(0, -1).join(', ')} a ${data.at(-1)!}`;
  return `${nazevHry(stav.hra)} ${vycet} ${data.length === 1 ? 'zatím není' : 'zatím nejsou'}.`;
}
