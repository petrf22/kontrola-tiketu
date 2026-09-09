/**
 * Skládání rozpoznaných útržků do řádků tiketu.
 *
 * Proč to není triviální: mezi levou částí řádku (pořadí sloupce a pět čísel) a pravou
 * (euročísla) je na tiketu velká mezera, takže je rozpoznávač vrátí jako dva oddělené bloky.
 * Pořadí v textovém výstupu tedy neodpovídá pořadí na papíře a řádky se musí párovat podle
 * svislé polohy rámečků.
 *
 * Snímek navíc bývá mírně nakloněný, takže se svislá poloha nedá porovnávat napřímo —
 * u pravého okraje je řádek jinde než u levého. Sklon se proto nejdřív odhadne a teprve
 * pak se podle něj řádky skládají.
 */

import { median, stred, type RozpoznanyText } from './model.js';

export interface Radek {
  readonly utrzky: readonly RozpoznanyText[];
  /** Text řádku složený zleva doprava. */
  readonly text: string;
  /** Svislá poloha řádku v místě jeho levého okraje. */
  readonly y: number;
}

export interface NastaveniSkladani {
  /**
   * Jak daleko svisle smí být útržek od řádku, aby do něj ještě patřil — jako násobek
   * typické výšky textu. Musí být menší než rozteč řádků, jinak se dva řádky slijí.
   */
  readonly tolerance?: number;
  /** Sklon ve stupních. Když se nezadá, odhadne se ze vstupu. */
  readonly sklonStupnu?: number;
}

/** Meze a krok hledání sklonu. Víc než dvacet stupňů už není nakloněný snímek, ale jiná fotka. */
const MEZ_SKLONU = 20;
const KROK_SKLONU = 0.25;

/**
 * Odhadne sklon textu ve stupních.
 *
 * Nejdřív věří tomu, co uvedl rozpoznávač. Když úhly nedodal, hledá se sklon hlasováním:
 * pro každý kandidátní úhel se spočítá, kolik dvojic útržků se po srovnání dostane na
 * prakticky stejnou výšku. Ve správném úhlu si všechny útržky jednoho řádku sednou na sebe,
 * v nesprávném se rozjedou.
 *
 * Postupné zpřesňování od nulového sklonu tady nefunguje: přes šířku tiketu je při osmi
 * stupních svislý posun větší než rozteč řádků, takže by se úvodní seskupení netrefilo
 * a odhad by se od začátku vezl na špatné skupině.
 */
export function odhadniSklon(utrzky: readonly RozpoznanyText[]): number {
  const uhly = utrzky.map((u) => u.uhel).filter((u): u is number => u !== undefined);
  if (uhly.length > 0) return median(uhly);
  if (utrzky.length < 2) return 0;

  const stredy = utrzky.map((u) => stred(u.ramecek));
  const blizko = typickaVyska(utrzky) * 0.3;

  let nejlepsiUhel = 0;
  let nejlepsiSkore = -1;

  for (let uhel = -MEZ_SKLONU; uhel <= MEZ_SKLONU; uhel += KROK_SKLONU) {
    const tangens = Math.tan((uhel * Math.PI) / 180);
    const srovnane = stredy.map((s) => s.y - s.x * tangens);

    let skore = 0;
    for (let i = 0; i < srovnane.length; i++) {
      for (let j = i + 1; j < srovnane.length; j++) {
        if (Math.abs(srovnane[i]! - srovnane[j]!) < blizko) skore++;
      }
    }

    // Při shodě vyhrává úhel bližší nule — nenakláněj snímek víc, než je nutné.
    if (skore > nejlepsiSkore || (skore === nejlepsiSkore && Math.abs(uhel) < Math.abs(nejlepsiUhel))) {
      nejlepsiSkore = skore;
      nejlepsiUhel = uhel;
    }
  }

  return nejlepsiUhel;
}

function typickaVyska(utrzky: readonly RozpoznanyText[]): number {
  return median(utrzky.map((u) => u.ramecek.vyska)) || 1;
}

/** Svislá poloha útržku přepočtená, jako by text vodorovný byl. */
function srovnaneY(utrzek: RozpoznanyText, tangens: number): number {
  const { x, y } = stred(utrzek.ramecek);
  return y - x * tangens;
}

function seskupPodleY(
  utrzky: readonly RozpoznanyText[],
  tolerance: number,
  tangens: number,
): RozpoznanyText[][] {
  const serazene = [...utrzky].sort((a, b) => srovnaneY(a, tangens) - srovnaneY(b, tangens));
  const skupiny: RozpoznanyText[][] = [];

  for (const utrzek of serazene) {
    const posledni = skupiny.at(-1);
    const y = srovnaneY(utrzek, tangens);
    // Porovnává se s prvním prvkem skupiny, ne s posledním — jinak by se řádky mohly
    // postupně „rozlézt“ o kousek po kousku a slít se dohromady.
    if (posledni !== undefined && Math.abs(y - srovnaneY(posledni[0]!, tangens)) <= tolerance) {
      posledni.push(utrzek);
    } else {
      skupiny.push([utrzek]);
    }
  }

  return skupiny;
}

/**
 * Složí útržky do řádků. Řádky jsou seřazené shora dolů, útržky v nich zleva doprava.
 */
export function slozRadky(
  utrzky: readonly RozpoznanyText[],
  nastaveni: NastaveniSkladani = {},
): Radek[] {
  if (utrzky.length === 0) return [];

  const sklon = nastaveni.sklonStupnu ?? odhadniSklon(utrzky);
  const tangens = Math.tan((sklon * Math.PI) / 180);
  const tolerance = (nastaveni.tolerance ?? 0.6) * typickaVyska(utrzky);

  return seskupPodleY(utrzky, tolerance, tangens).map((skupina) => {
    const serazene = [...skupina].sort((a, b) => a.ramecek.x - b.ramecek.x);
    return {
      utrzky: serazene,
      text: serazene.map((u) => u.text.trim()).filter((t) => t !== '').join(' '),
      y: srovnaneY(serazene[0]!, tangens),
    };
  });
}
