/**
 * Čtení čárového kódu tiketu (PDF417).
 *
 * Kód slouží k jedinému účelu — získat sériové číslo tiketu jako lokální identifikátor
 * pro deduplikaci. Vsazená čísla v něm čitelná nejsou, jsou v šifrovaném bloku, a ten se
 * tady nijak nezkoumá.
 *
 * Číslo klubové karty je v kódu v plaintextu. Tahle funkce ho **nevrací** — není součástí
 * návratového typu, takže neexistuje způsob, jak ho omylem uložit nebo zobrazit. To je
 * záměr, ne opomenutí.
 *
 * Struktura payloadu je popsaná v zadání (ověřeno na reálném tiketu Eurojackpotu, 121 bajtů).
 */

const MAGIC = 'RBF16M';
const OFFSET_HLAVICKY = 6;
const DELKA_HLAVICKY = 5;
const OFFSET_SERIOVEHO_CISLA = 89;
const DELKA_SERIOVEHO_CISLA = 20;

/** Nejkratší payload, ze kterého se dá sériové číslo přečíst celé. */
export const NEJMENSI_DELKA = OFFSET_SERIOVEHO_CISLA + DELKA_SERIOVEHO_CISLA;

export class ChybaCarovehoKodu extends Error {
  constructor(zprava: string) {
    super(zprava);
    this.name = 'ChybaCarovehoKodu';
  }
}

export interface PrectenyKod {
  /** Dvacet číslic, shodných s číslem vytištěným na tiketu. */
  readonly serioveCislo: string;
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

/**
 * Přečte payload čárového kódu.
 *
 * Nesahá na šifrovaný blok a nepokouší se ho lámat — to není cíl projektu.
 */
export function prectiCarovyKod(payload: Uint8Array): PrectenyKod {
  if (payload.length < NEJMENSI_DELKA) {
    throw new ChybaCarovehoKodu(
      `Payload má ${payload.length} bajtů, sériové číslo končí až na ${NEJMENSI_DELKA}.`,
    );
  }

  const magic = jakoText(payload, 0, MAGIC.length);
  if (magic !== MAGIC) {
    throw new ChybaCarovehoKodu(`Nečekaná hlavička „${magic}“, čekáno „${MAGIC}“.`);
  }

  const serioveCislo = jakoText(payload, OFFSET_SERIOVEHO_CISLA, DELKA_SERIOVEHO_CISLA);
  if (!/^\d{20}$/.test(serioveCislo)) {
    throw new ChybaCarovehoKodu(
      'Na místě sériového čísla nejsou dvacet číslic — formát kódu se nejspíš změnil.',
    );
  }

  const verze = [...payload.slice(OFFSET_HLAVICKY, OFFSET_HLAVICKY + DELKA_HLAVICKY)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ');

  return { serioveCislo, verze };
}

/**
 * Lokální identifikátor tiketu pro deduplikaci.
 *
 * Je odvozený ze sériového čísla a nikam se neodesílá — aplikace nemá síťové oprávnění.
 * Ukládá se do šifrované databáze.
 */
export function lokalniId(kod: PrectenyKod): string {
  return kod.serioveCislo;
}
