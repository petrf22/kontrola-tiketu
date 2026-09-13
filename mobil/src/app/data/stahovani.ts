/**
 * Stažení výsledků z backendu — jediné místo v aplikaci, které sahá na síť.
 *
 * Aplikace dřív neměla oprávnění k síti vůbec. To bylo ověřitelné jedním pohledem do
 * manifestu, ale výsledky se musely nosit souborem. Zadání pro takový případ připouští síť
 * s tvrdým pravidlem: **stahují se vždy všechny tahy za období, nikdy dotaz vázaný na
 * konkrétní tiket.** Tenhle modul to pravidlo drží tak, aby se nedalo porušit omylem:
 *
 * - o tiketech neví nic — nemá je jak dostat, nic z úložiště ani ze stavu neimportuje
 *   (hlídá `app/test/sit.test.ts`),
 * - dotaz je pro všechny stejný: jen `GET` na pevnou adresu, bez parametrů, bez cookies,
 *   s pevným User-Agentem místo toho, který by prozradil model telefonu,
 * - nepoužívá podmíněné hlavičky (`If-None-Match`…); co je nové, pozná z hashů v manifestu,
 *   takže serveru neřekne ani to, co už má,
 * - stahuje každý balík, který manifest uvede — nevybírá podle toho, co by uživatel potřeboval.
 *
 * Odpovědi vrací jako text. Čte je stejný kód jako soubor z importu (`import.ts`).
 *
 * **Past v Capacitoru:** u `Content-Type: application/json` web i Android odpověď samy
 * rozparsují bez ohledu na požadovaný typ, a Android navíc čte text po řádcích a koncový
 * znak nového řádku zahodí. Hash z manifestu by pak nešel ověřit. Backend proto posílá
 * soubory jako `text/plain` a aplikace si bere surové bajty (`arraybuffer` → base64), ze
 * kterých počítá hash i text.
 */

import { CapacitorHttp } from '@capacitor/core';
import { ZAKLADNI_URL } from './adresa-backendu.js';

export { ZAKLADNI_URL };

/**
 * Stejný pro všechny instalace. Výchozí User-Agent Androidu by nesl model telefonu a verzi
 * systému — přesně ten druh údaje, podle kterého se dají uživatelé rozlišit.
 */
export const USER_AGENT = 'kontrola-tiketu';

const MANIFEST = 'manifest.json';
const JMENO_BALIKU = /^[a-z0-9-]+\.json$/;
const HASH = /^sha256:[0-9a-f]{64}$/;

export interface Odpoved {
  readonly stav: number;
  /** Tělo odpovědi přesně tak, jak leželo na serveru. */
  readonly telo: Uint8Array<ArrayBuffer>;
}

/** Vrstva sítě je vyměnitelná, aby testy a vývoj v prohlížeči nemusely nikam chodit. */
export type Sit = (url: string) => Promise<Odpoved>;

/** Server poslal odpověď, ze které Capacitor nedokáže vydat surové bajty. */
export class NecekanyTypObsahu extends Error {}

export const sitCapacitor: Sit = async (url) => {
  const odpoved = await CapacitorHttp.get({
    url,
    headers: { 'User-Agent': USER_AGENT },
    // Surové bajty (Capacitor je vrací jako base64): hash v manifestu se počítá z bajtů.
    responseType: 'arraybuffer',
    connectTimeout: 15_000,
    readTimeout: 30_000,
  });
  if (odpoved.status !== 200) return { stav: odpoved.status, telo: new Uint8Array() };
  if (typeof odpoved.data !== 'string') throw new NecekanyTypObsahu();
  return { stav: odpoved.status, telo: zBase64(odpoved.data) };
};

/** Android vkládá do base64 konce řádků; `atob` bílé znaky podle specifikace přeskočí. */
function zBase64(base64: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(base64), (znak) => znak.charCodeAt(0));
}

export interface PolozkaManifestu {
  readonly soubor: string;
  readonly hash: string;
  readonly od: string;
  readonly do: string;
  readonly tahu: number;
}

export interface StavHry {
  readonly posledniTah: string;
  /** `false`: čísla jsou známá, ale Allwyn ještě nezveřejnil tabulku výher. */
  readonly uplny: boolean;
}

/** Co backend ví o poslední kontrole — odpověď na otázku „už jsou výsledky?“. */
export interface KontrolaServeru {
  readonly posledniDotaz: string | null;
  readonly eurojackpot: StavHry | null;
  readonly sportka: StavHry | null;
}

export interface Manifest {
  readonly vygenerovano: string;
  readonly kontrola: KontrolaServeru;
  readonly baliky: readonly PolozkaManifestu[];
}

export interface StazenyBalik {
  readonly soubor: string;
  readonly hash: string;
  readonly text: string;
}

export type VysledekStazeni =
  | { readonly stav: 'ok'; readonly manifest: Manifest; readonly nove: readonly StazenyBalik[] }
  | { readonly stav: 'chyba'; readonly duvod: string };

export const VERZE_MANIFESTU = 1;

function chyba(duvod: string): VysledekStazeni {
  return { stav: 'chyba', duvod };
}

function jeObjekt(hodnota: unknown): hodnota is Record<string, unknown> {
  return typeof hodnota === 'object' && hodnota !== null && !Array.isArray(hodnota);
}

/**
 * Adresa balíku. Jméno přichází ze serveru, takže se ověří dřív, než se z něj složí URL —
 * kdyby backend někdo převzal, nesmí aplikaci poslat na cizí adresu ani do ní propašovat
 * parametry.
 */
export function adresaBaliku(soubor: string): string {
  if (!JMENO_BALIKU.test(soubor)) {
    throw new Error(`Neplatné jméno balíku „${soubor}“.`);
  }
  return new URL(soubor, ZAKLADNI_URL).toString();
}

function stavHry(hodnota: unknown): StavHry | null {
  if (!jeObjekt(hodnota) || typeof hodnota['posledniTah'] !== 'string') return null;
  return { posledniTah: hodnota['posledniTah'], uplny: hodnota['uplny'] === true };
}

/** Přečte manifest. Vrací větu pro uživatele, když s ním něco není v pořádku. */
export function prectiManifest(text: string): Manifest | string {
  let obsah: unknown;
  try {
    obsah = JSON.parse(text);
  } catch {
    return 'Server neposlal platný seznam výsledků.';
  }
  if (!jeObjekt(obsah) || typeof obsah['verzeManifestu'] !== 'number') {
    return 'Server neposlal platný seznam výsledků.';
  }
  if (obsah['verzeManifestu'] !== VERZE_MANIFESTU) {
    return obsah['verzeManifestu'] > VERZE_MANIFESTU
      ? 'Server posílá výsledky v novějším formátu. Aktualizuj aplikaci.'
      : 'Server posílá výsledky ve starším formátu, než aplikace umí.';
  }
  const baliky = obsah['baliky'];
  if (!Array.isArray(baliky)) {
    return 'Seznam výsledků na serveru nemá balíky.';
  }

  const polozky: PolozkaManifestu[] = [];
  for (const b of baliky) {
    if (
      !jeObjekt(b) ||
      typeof b['soubor'] !== 'string' ||
      !JMENO_BALIKU.test(b['soubor']) ||
      typeof b['hash'] !== 'string' ||
      !HASH.test(b['hash'])
    ) {
      return 'Seznam výsledků na serveru obsahuje neplatnou položku.';
    }
    polozky.push({
      soubor: b['soubor'],
      hash: b['hash'],
      od: typeof b['od'] === 'string' ? b['od'] : '',
      do: typeof b['do'] === 'string' ? b['do'] : '',
      tahu: typeof b['tahu'] === 'number' ? b['tahu'] : 0,
    });
  }

  const kontrola = jeObjekt(obsah['kontrola']) ? obsah['kontrola'] : {};
  return {
    vygenerovano: typeof obsah['vygenerovano'] === 'string' ? obsah['vygenerovano'] : '',
    kontrola: {
      posledniDotaz: typeof kontrola['posledniDotaz'] === 'string' ? kontrola['posledniDotaz'] : null,
      eurojackpot: stavHry(kontrola['eurojackpot']),
      sportka: stavHry(kontrola['sportka']),
    },
    baliky: polozky,
  };
}

/** `sha256:` a hex — stejný tvar, jaký píše backend do manifestu. */
export async function sha256(bajty: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bajty);
  return `sha256:${[...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Stáhne manifest a všechny balíky, které se od minula změnily.
 *
 * @param znameHashe Hashe balíků, které už aplikace má uložené (`soubor` → `hash`).
 */
export async function stahniVysledky(
  sit: Sit,
  znameHashe: ReadonlyMap<string, string>,
): Promise<VysledekStazeni> {
  const manifestovy = await stahni(sit, new URL(MANIFEST, ZAKLADNI_URL).toString());
  if (typeof manifestovy === 'string') return chyba(manifestovy);
  const text = jakoText(manifestovy);
  if (text === null) return chyba('Server neposlal platný seznam výsledků.');

  const manifest = prectiManifest(text);
  if (typeof manifest === 'string') return chyba(manifest);

  const nove: StazenyBalik[] = [];
  for (const polozka of manifest.baliky) {
    if (znameHashe.get(polozka.soubor) === polozka.hash) continue;

    const bajty = await stahni(sit, adresaBaliku(polozka.soubor));
    if (typeof bajty === 'string') return chyba(bajty);
    // Neshoda znamená starou kopii někde po cestě nebo souběh s publikací na serveru.
    // Nic se neuloží a příště se to zkusí znovu.
    if ((await sha256(bajty)) !== polozka.hash) {
      return chyba('Stažené výsledky nesouhlasí s tím, co server ohlásil. Zkus to za chvíli znovu.');
    }
    const obsah = jakoText(bajty);
    if (obsah === null) return chyba('Stažené výsledky nejsou platný text.');
    nove.push({ soubor: polozka.soubor, hash: polozka.hash, text: obsah });
  }

  return { stav: 'ok', manifest, nove };
}

/** Bajty odpovědi, nebo věta pro uživatele. */
async function stahni(sit: Sit, url: string): Promise<Uint8Array<ArrayBuffer> | string> {
  let odpoved: Odpoved;
  try {
    odpoved = await sit(url);
  } catch (e) {
    return e instanceof NecekanyTypObsahu
      ? 'Server posílá výsledky s nečekaným typem obsahu. Má je posílat jako text/plain (docs/backend.md).'
      : 'Server s výsledky není dostupný. Jsi připojený k internetu?';
  }
  if (odpoved.stav !== 200) return `Server s výsledky odpověděl chybou ${odpoved.stav}.`;
  return odpoved.telo;
}

function jakoText(bajty: Uint8Array): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bajty);
  } catch {
    return null;
  }
}
