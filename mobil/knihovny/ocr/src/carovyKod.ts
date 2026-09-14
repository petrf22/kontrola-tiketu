/**
 * Čtení čárového kódu tiketu (PDF417).
 *
 * Kód slouží ke dvěma věcem: sériové číslo je lokální identifikátor pro deduplikaci a hlavička
 * prozradí hru. Vsazená čísla v něm čitelná nejsou, jsou v šifrovaném bloku, a ten se tady
 * nijak nezkoumá.
 *
 * Číslo klubové karty je v kódu v plaintextu. Tahle funkce ho **nevrací** — není součástí
 * návratového typu, takže neexistuje způsob, jak ho omylem uložit nebo zobrazit. To je
 * záměr, ne opomenutí.
 *
 * Struktura (ověřeno na čtyřech tiketech, 9. a 14. 9. 2026):
 *
 * ```
 * offset 0    "RBF1"                      magic
 * offset 4    2 bajty                     liší se tiket od tiketu, nevykládají se
 * offset 6    5 bajtů hlavičky            první z nich odpovídá hře
 * offset 11   šifrovaný blok              proměnná délka (24–72 bajtů)
 * dál         02 01 00 16 01 00           značka
 *             20 číslic ASCII             sériové číslo tiketu
 *             0b 01 + 10 číslic ASCII     číslo karty Allwyn Klub, jen když ji sázející použil
 * ```
 *
 * Původní popis v zadání měl sériové číslo na pevném offsetu 89. To platilo jen pro první
 * tiket, jehož šifrovaný blok měl 72 bajtů — na tiketech s kratším blokem čtení padalo.
 */

import type { Hra } from '@kontrola-tiketu/jadro';

const MAGIC = 'RBF1';
const OFFSET_HLAVICKY = 6;
const DELKA_HLAVICKY = 5;
const OFFSET_BLOKU = OFFSET_HLAVICKY + DELKA_HLAVICKY;
const ZNACKA_SERIOVEHO_CISLA = [0x02, 0x01, 0x00, 0x16, 0x01, 0x00] as const;
const DELKA_SERIOVEHO_CISLA = 20;

/** Nejkratší payload, ve kterém se může sériové číslo vůbec objevit. */
export const NEJMENSI_DELKA =
  OFFSET_BLOKU + ZNACKA_SERIOVEHO_CISLA.length + DELKA_SERIOVEHO_CISLA;

/**
 * Hra podle prvního bajtu hlavičky.
 *
 * Eurojackpot `0x13` sedí na dvou tiketech s různým počtem sloupců i slosování (9. a 14. 9. 2026).
 * Sportka a Euromiliony mají zatím po jednom tiketu (14. 9. 2026), takže neznámý bajt není
 * chyba — jen z kódu hra nevyplyne a rozhodne text z fotky, nebo uživatel.
 */
const HRA_PODLE_HLAVICKY: ReadonlyMap<number, Hra> = new Map([
  [0x13, 'eurojackpot'],
  [0x0f, 'sportka'],
  [0x0c, 'euromiliony'],
]);

export class ChybaCarovehoKodu extends Error {
  constructor(zprava: string) {
    super(zprava);
    this.name = 'ChybaCarovehoKodu';
  }
}

export interface PrectenyKod {
  /** Dvacet číslic, shodných s číslem vytištěným na tiketu. */
  readonly serioveCislo: string;
  /** Hra podle hlavičky, nebo `null`, když bajt hlavičky neznáme. */
  readonly hra: Hra | null;
  /** Bajty hlavičky v hexu. Jen pro diagnostiku, kdyby Allwyn formát změnil. */
  readonly verze: string;
}

function jakoText(payload: Uint8Array, od: number, delka: number): string {
  let text = '';
  for (let i = od; i < od + delka; i++) {
    text += String.fromCharCode(payload[i]!);
  }
  return text;
}

function jeZnackaNa(payload: Uint8Array, od: number): boolean {
  return ZNACKA_SERIOVEHO_CISLA.every((bajt, i) => payload[od + i] === bajt);
}

/**
 * Najde sériové číslo za značkou.
 *
 * Šifrovaný blok má proměnnou délku, takže se značka hledá. Náhodný výskyt téže šestice bajtů
 * v bloku by musel být navíc následovaný dvaceti číslicemi — proto se bere první výskyt,
 * za kterým číslice opravdu jsou.
 */
function najdiSerioveCislo(payload: Uint8Array): string | null {
  const posledniZacatek = payload.length - ZNACKA_SERIOVEHO_CISLA.length - DELKA_SERIOVEHO_CISLA;
  for (let od = OFFSET_BLOKU; od <= posledniZacatek; od++) {
    if (!jeZnackaNa(payload, od)) continue;
    const kandidat = jakoText(payload, od + ZNACKA_SERIOVEHO_CISLA.length, DELKA_SERIOVEHO_CISLA);
    if (/^\d{20}$/.test(kandidat)) return kandidat;
  }
  return null;
}

/**
 * Přečte payload čárového kódu.
 *
 * Nesahá na šifrovaný blok a nepokouší se ho lámat — to není cíl projektu.
 */
export function prectiCarovyKod(payload: Uint8Array): PrectenyKod {
  if (payload.length < NEJMENSI_DELKA) {
    throw new ChybaCarovehoKodu(
      `Payload má ${payload.length} bajtů, tiket jich má nejméně ${NEJMENSI_DELKA}.`,
    );
  }

  const magic = jakoText(payload, 0, MAGIC.length);
  if (magic !== MAGIC) {
    throw new ChybaCarovehoKodu(`Nečekaná hlavička „${magic}“, čekáno „${MAGIC}“.`);
  }

  const serioveCislo = najdiSerioveCislo(payload);
  if (serioveCislo === null) {
    throw new ChybaCarovehoKodu(
      'V kódu chybí sériové číslo (dvacet číslic za značkou) — formát kódu se nejspíš změnil.',
    );
  }

  const hlavicka = payload.slice(OFFSET_HLAVICKY, OFFSET_BLOKU);
  const verze = [...hlavicka].map((b) => b.toString(16).padStart(2, '0')).join(' ');

  return { serioveCislo, hra: HRA_PODLE_HLAVICKY.get(hlavicka[0]!) ?? null, verze };
}

/**
 * Lokální identifikátor tiketu pro deduplikaci.
 *
 * Je odvozený ze sériového čísla a nikam se neodesílá. Ukládá se do šifrované databáze.
 */
export function lokalniId(kod: PrectenyKod): string {
  return kod.serioveCislo;
}
