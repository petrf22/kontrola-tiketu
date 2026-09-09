/**
 * Slušný HTTP klient pro veřejné listiny.
 *
 * Pravidla ze zadání: poctivý User-Agent, respektovat robots.txt, nedělat víc dotazů, než je
 * nutné. Prodleva a kontrola robots.txt jsou proto součástí klienta, ne něčím, na co se dá
 * na volajícím místě zapomenout.
 */

import { jePovoleno, parsujRobots, type PravidlaRobots } from './robots.js';

export const USER_AGENT =
  'kontrola-tiketu/0.1 (osobni offline kontrola tiketu; +https://github.com/petrf22/kontrola-tiketu)';

/** Sekundy mezi dotazy. Listiny se stahují po týdnech, takže na spěch není důvod. */
export const PRODLEVA_MS = 2000;

export interface Odpoved {
  readonly stav: number;
  readonly telo: string;
}

/** Vrstva sítě je vyměnitelná, aby testy nemusely nikam chodit. */
export type Sit = (url: string, hlavicky: Record<string, string>) => Promise<Odpoved>;

export const sitFetch: Sit = async (url, hlavicky) => {
  const odpoved = await fetch(url, { headers: hlavicky, redirect: 'follow' });
  return { stav: odpoved.status, telo: await odpoved.text() };
};

export class ChybaStahovani extends Error {
  constructor(
    zprava: string,
    readonly stav?: number,
  ) {
    super(zprava);
    this.name = 'ChybaStahovani';
  }
}

export class ZakazanoRobots extends Error {
  constructor(readonly cesta: string) {
    super(
      `robots.txt zakazuje cestu ${cesta}. Fetcher končí — zadání respektování robots.txt ukládá jako tvrdé pravidlo.`,
    );
    this.name = 'ZakazanoRobots';
  }
}

export interface NastaveniKlienta {
  readonly sit?: Sit;
  readonly prodlevaMs?: number;
  readonly spanek?: (ms: number) => Promise<void>;
}

const spanekVeSkutecnosti = (ms: number) => new Promise<void>((hotovo) => setTimeout(hotovo, ms));

export class Klient {
  private readonly sit: Sit;
  private readonly prodlevaMs: number;
  private readonly spanek: (ms: number) => Promise<void>;
  private pravidla: PravidlaRobots | null = null;
  private prvniDotazProbehl = false;

  /** Kolik dotazů klient poslal. Pro výpis na konci běhu — ať je vidět, kolik to stálo. */
  pocetDotazu = 0;

  constructor(nastaveni: NastaveniKlienta = {}) {
    this.sit = nastaveni.sit ?? sitFetch;
    this.prodlevaMs = nastaveni.prodlevaMs ?? PRODLEVA_MS;
    this.spanek = nastaveni.spanek ?? spanekVeSkutecnosti;
  }

  /** Stáhne a zapamatuje si robots.txt daného webu. Musí proběhnout před prvním stahováním. */
  async nactiRobots(puvod: string): Promise<PravidlaRobots> {
    const odpoved = await this.poslji(new URL('/robots.txt', puvod).toString());
    if (odpoved.stav !== 200) {
      throw new ChybaStahovani(
        `robots.txt vrátil ${odpoved.stav}; bez něj se nedá ověřit, co je povolené.`,
        odpoved.stav,
      );
    }
    this.pravidla = parsujRobots(odpoved.telo, USER_AGENT);
    return this.pravidla;
  }

  async stahni(url: string): Promise<string> {
    if (this.pravidla === null) {
      throw new ChybaStahovani('Nejdřív je potřeba načíst robots.txt.');
    }
    // Vzory v robots.txt se podle specifikace porovnávají i s query, ne jen s cestou —
    // a adresa listiny má parametry právě v query.
    const adresa = new URL(url);
    const cesta = adresa.pathname + adresa.search;
    if (!jePovoleno(this.pravidla, cesta)) {
      throw new ZakazanoRobots(cesta);
    }

    const odpoved = await this.poslji(url);
    if (odpoved.stav !== 200) {
      throw new ChybaStahovani(`${url} vrátil ${odpoved.stav}.`, odpoved.stav);
    }
    return odpoved.telo;
  }

  private async poslji(url: string): Promise<Odpoved> {
    // Prodleva patří před dotaz, ne za něj, aby se nečekalo zbytečně po tom posledním.
    if (this.prvniDotazProbehl) await this.spanek(this.prodlevaMs);
    this.prvniDotazProbehl = true;
    this.pocetDotazu += 1;
    return this.sit(url, { 'user-agent': USER_AGENT, accept: 'text/html' });
  }
}
