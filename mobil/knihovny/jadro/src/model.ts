/**
 * Datový model losování a tiketů.
 *
 * Zdrojem struktury je výherní listina Allwyn (viz backend/docs/data-source.md), zdrojem pravidel
 * herní plán. Model záměrně neobsahuje žádné výherní částky — ty vždy pocházejí z konkrétního
 * tahu. Výjimkou jsou Extra 6 a Eurošance, jejichž sazby listina nepublikuje; ty se načítají
 * zvlášť jako data, ne jako konstanty v kódu.
 */

/**
 * Verze formátu JSON, který publikuje backend a konzumuje aplikace.
 *
 * 2 (13. 9. 2026): Euromiliony a `sazbyEurosance`.
 */
export const VERZE_FORMATU = 2;

export type Hra = 'eurojackpot' | 'sportka' | 'euromiliony';

export type Den = 'po' | 'ut' | 'st' | 'ct' | 'pa' | 'so' | 'ne';

/** Datum ve tvaru `RRRR-MM-DD`. Primární klíč tahu — číslo tahu listina neuvádí. */
export type Datum = string;

// ---------------------------------------------------------------------------
// Výherní pořadí
// ---------------------------------------------------------------------------

/** Eurojackpot má dvanáct pořadí, I (5+2) až XII (2+1). */
export type PoradiEurojackpot =
  | 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI'
  | 'VII' | 'VIII' | 'IX' | 'X' | 'XI' | 'XII';

/** Euromiliony mají deset pořadí, I (7+1) až X (2+1). */
export type PoradiEuromiliony =
  | 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI' | 'VII' | 'VIII' | 'IX' | 'X';

/** Sportka má pět pořadí na tah a společný Bonus. */
export type PoradiSportka = 'bonus' | 'I' | 'II' | 'III' | 'IV' | 'V';

/**
 * Šance, Extra 6 i Eurošance se vyhodnocují shodou koncových číslic sázenky. `sousedni-cislo`
 * je 7. pořadí Šance a Extra 6 — sázka na čísla o jednu vyšší a nižší než koncové. Eurošance
 * má jen pět číslic a sousední číslo nezná, takže `sestecisli` ani `sousedni-cislo` nedosáhne.
 */
export type PoradiKoncoveCislice =
  | 'sestecisli' | 'peticisli' | 'ctyrcisli' | 'trojcisli'
  | 'dvojcisli' | 'koncove-cislo' | 'sousedni-cislo';

/**
 * Jeden řádek tabulky výher tak, jak ho publikuje listina konkrétního tahu.
 *
 * Pozor: `vyseVyhryKc` bývá nenulová i tam, kde je `pocetVyher` nula. Vyhodnocení se proto
 * řídí výhradně shodou čísel; `pocetVyher` je informativní údaj, ne podmínka výhry.
 */
export interface Poradi<K extends string = string> {
  readonly klic: K;
  /** Popis z listiny, např. `5+2`, `5+dodatkové`, `koncové číslo +/- 1`. */
  readonly popis: string;
  readonly pocetVyher: number;
  readonly vyseVyhryKc: number;
}

/** Řádek tabulky Šance navíc nese vylosovaný podřetězec, kterým se pořadí získává. */
export interface PoradiSance extends Poradi<PoradiKoncoveCislice> {
  /** Např. `36412` u pětičíslí. U `sousedni-cislo` listina vzor neuvádí. */
  readonly vzor: string | null;
}

// ---------------------------------------------------------------------------
// Tahy
// ---------------------------------------------------------------------------

export interface TahZaklad {
  readonly hra: Hra;
  readonly datum: Datum;
  readonly den: Den;
  readonly sazkovyTyden: { readonly rok: number; readonly tyden: number };
  readonly vsazenoKc: number;
  /** U historických tahů listina občas uvádí nulu nebo údaj chybí. */
  readonly naVyhryKc: number | null;
}

export interface TahEurojackpot extends TahZaklad {
  readonly hra: 'eurojackpot';
  /** Pět čísel z 1–50, v pořadí vylosování. */
  readonly cisla: readonly number[];
  /** Dvě euročísla z 1–12, v pořadí vylosování. */
  readonly eurocisla: readonly number[];
  /** Šest číslic Extra 6 jako řetězec — vedoucí nuly jsou významné. */
  readonly extra6: string;
  readonly poradi: readonly Poradi<PoradiEurojackpot>[];
  readonly jackpotKc: number | null;
}

export interface TahEuromiliony extends TahZaklad {
  readonly hra: 'euromiliony';
  /** Sedm čísel z 1–35, v pořadí vylosování. */
  readonly cisla: readonly number[];
  /** Jedno číslo z 1–5 z druhého osudí. */
  readonly druheOsudi: number;
  /** Pět číslic Eurošance jako řetězec — vedoucí nuly jsou významné. */
  readonly eurosance: string;
  readonly poradi: readonly Poradi<PoradiEuromiliony>[];
  readonly prevodHlavniCastKc: number | null;
  readonly jackpotKc: number | null;
}

/** Jeden z dvojice tahů Sportky. Čísla sloupce hrají v obou tazích, viz herní plán, bod 1. */
export interface SportkaTah {
  readonly poradiTahu: 1 | 2;
  /** Šest čísel z 1–49, v pořadí vylosování. */
  readonly cisla: readonly number[];
  readonly dodatkove: number;
  readonly poradi: readonly Poradi<PoradiSportka>[];
  readonly prevod1PoradiKc: number | null;
  readonly jackpot1PoradiKc: number | null;
  readonly prevod2PoradiKc: number | null;
  readonly jackpot2PoradiKc: number | null;
}

export interface LosovaniSance {
  readonly datum: Datum;
  /** Šest číslic jako řetězec — vedoucí nuly jsou významné. */
  readonly cislice: string;
  readonly vsazenoKc: number;
  readonly poradi: readonly PoradiSance[];
}

export interface TahSportka extends TahZaklad {
  readonly hra: 'sportka';
  readonly tahy: readonly [SportkaTah, SportkaTah];
  readonly sance: LosovaniSance | null;
  readonly prevodBonusKc: number | null;
  readonly superJackpotKc: number | null;
}

export type Tah = TahEurojackpot | TahSportka | TahEuromiliony;

// ---------------------------------------------------------------------------
// Tikety
// ---------------------------------------------------------------------------

export interface SloupecEurojackpot {
  readonly hra: 'eurojackpot';
  readonly cisla: readonly number[];
  readonly eurocisla: readonly number[];
}

export interface SloupecSportka {
  readonly hra: 'sportka';
  readonly cisla: readonly number[];
}

/**
 * Druhé osudí je seznam, i když se tipuje jediné číslo — validace i formulář s ním pak
 * zacházejí stejně jako s euročísly. Systémové sázky (víc čísel z druhého osudí) model nezná.
 */
export interface SloupecEuromiliony {
  readonly hra: 'euromiliony';
  readonly cisla: readonly number[];
  readonly druheOsudi: readonly number[];
}

export type Sloupec = SloupecEurojackpot | SloupecSportka | SloupecEuromiliony;

/**
 * Na která slosování tiket platí.
 *
 * Sportka se losuje třikrát týdně a tiket může platit jen na vybrané dny (herní plán, bod 4),
 * proto samotný počet slosování nestačí. `dny === null` znamená všechna slosování hry.
 */
export interface RozsahSlosovani {
  readonly prvni: Datum;
  readonly pocet: number;
  readonly dny: readonly Den[] | null;
}

/**
 * Na která slosování se tiket kontroluje, když to není přesně podle papíru.
 *
 * Kdo sází pořád stejná čísla, nemusí fotit každý tiket — jeden tiket se dá kontrolovat
 * zpětně i dopředu. Dny slosování se berou z {@link RozsahSlosovani.dny} tiketu.
 */
export interface RozsahKontroly {
  readonly od: Datum;
  /** Poslední den kontroly včetně. `null` = každé další slosování, bez konce. */
  readonly do: Datum | null;
  /**
   * Kolik stojí jedno slosování. `null` = neznámé, do vsazeného se nezapočte.
   *
   * Allwyn ceny sázek občas mění, u slosování daleko v minulosti je to proto jen odhad.
   */
  readonly cenaZaSlosovaniKc: number | null;
}

/**
 * Tiket tak, jak ho drží uživatel.
 *
 * Číslo klubové karty se v modelu nevyskytuje záměrně — čte se z čárového kódu, ale nikdy se
 * nepředává dál, takže není co zapomenout zahodit.
 */
export interface Tiket {
  /** Lokální identifikátor odvozený ze sériového čísla tiketu. Slouží k deduplikaci. */
  readonly id: string;
  readonly hra: Hra;
  readonly sloupce: readonly Sloupec[];
  readonly slosovani: RozsahSlosovani;
  /**
   * Šest číslic Extra 6 (Eurojackpot) nebo Šance (Sportka), pět číslic Eurošance (Euromiliony);
   * `null`, pokud nebyla vsazena.
   */
  readonly kodDoplnkoveHry: string | null;
  /**
   * Kolik tiket stál. `null`, když se nepodařilo přečíst a uživatel ho nedoplnil.
   *
   * Neslouží k vyhodnocení výhry — ta se počítá výhradně z tabulek tahů. Je to údaj pro
   * uživatele, aby viděl, jak si stojí.
   */
  readonly cenaKc: number | null;
  readonly vlozeno: string;
  /**
   * Rozsah kontroly odlišný od papíru. Když chybí, tiket se kontroluje podle `slosovani`;
   * když je vyplněný, tiket je virtuální. Údaje z papíru (`slosovani`, `cenaKc`) zůstávají
   * beze změny.
   *
   * Pole je nepovinné, aby tikety uložené dřív zůstaly platné bez migrace.
   */
  readonly kontrola?: RozsahKontroly;
}

// ---------------------------------------------------------------------------
// Sazby Extra 6
// ---------------------------------------------------------------------------

/**
 * Výhry v Extra 6 jsou stanovené násobkem sázky (herní plán, bod 25), ne totalizátorem,
 * a výherní listina je nepublikuje. Ukládají se proto jako data s obdobím platnosti —
 * v kódu nesmí být natvrdo.
 */
export interface SazbyExtra6 {
  readonly platnostOd: Datum;
  readonly sazkaKc: number;
  readonly nasobky: Readonly<Record<PoradiKoncoveCislice, number>>;
  /** Zdroj, ze kterého byly sazby opsány — kvůli dohledatelnosti. */
  readonly zdroj: string;
}

// ---------------------------------------------------------------------------
// Sazby Eurošance
// ---------------------------------------------------------------------------

/** Pořadí, která Eurošance zná (herní plán, Euromiliony bod 10). */
export type PoradiEurosance = Exclude<PoradiKoncoveCislice, 'sestecisli' | 'sousedni-cislo'>;

/**
 * Výhry v Eurošanci jsou pevné (herní plán, Euromiliony bod 16) a listina je nepublikuje.
 * Na rozdíl od Extra 6 se vedou přímo v korunách: násobky v plánu jsou zaokrouhlené
 * (1,66667násobek) a vedly by na necelé koruny, kdežto částky v závorkách jsou přesné.
 */
export interface SazbyEurosance {
  readonly platnostOd: Datum;
  readonly sazkaKc: number;
  readonly vyhryKc: Readonly<Record<PoradiEurosance, number>>;
  /** Zdroj, ze kterého byly sazby opsány — kvůli dohledatelnosti. */
  readonly zdroj: string;
}
