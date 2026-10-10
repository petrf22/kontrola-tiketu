import { Injectable, computed, inject, signal } from '@angular/core';
import type { VysledekSlosovani, VysledekTiketu } from '@kontrola-tiketu/jadro';
import { ULOZISTE } from './tokeny.js';

export interface OznameniVysledku {
  readonly id: number;
  readonly tiketId: string;
  readonly datum: string;
  readonly vyhra: boolean;
  readonly castkaKc: number;
  readonly nejista: boolean;
  readonly oprava: boolean;
}
/** Malá část evidence, kterou mění i potvrzení a nastavení. */
interface Evidence {
  readonly verze: 2;
  readonly dialog: boolean;
  readonly dalsiId: number;
  readonly neprectene: readonly OznameniVysledku[];
}
/** Otisk výsledku každého tiketu v každém slosování; mění se jen s výsledky nebo tikety. */
type Otisky = ReadonlyMap<string, string>;
const KLIC = 'oznameniVysledku';
const KLIC_OTISKU = 'oznameniOtisky';
const PRAZDNA: Evidence = { verze: 2, dialog: true, dalsiId: 1, neprectene: [] };
const klic = (tiketId: string, datum: string) => JSON.stringify([tiketId, datum]);
const otisk = (s: VysledekSlosovani) => JSON.stringify([s.vyhry, s.celkemKc, s.nejistychVyher]);
function otiskyVysledku(vysledky: ReadonlyMap<string, VysledekTiketu>): Otisky {
  return new Map([...vysledky].flatMap(([tiketId, v]) => v.slosovani.map(s => [klic(tiketId, s.datum), otisk(s)] as const)));
}
const jeZaznam = (z: unknown): z is { tiketId: string; datum: string; otisk: string } => !!z && typeof z === 'object'
  && typeof (z as Record<string, unknown>)['tiketId'] === 'string' && typeof (z as Record<string, unknown>)['datum'] === 'string'
  && typeof (z as Record<string, unknown>)['otisk'] === 'string';
function otisky(data: unknown): Otisky | null {
  if (!Array.isArray(data) || !data.every(jeZaznam)) return null;
  return new Map(data.map(z => [klic(z.tiketId, z.datum), z.otisk]));
}
function stejne(a: Otisky, b: Otisky | null): boolean {
  return b !== null && a.size === b.size && [...a].every(([k, o]) => b.get(k) === o);
}
/** Verze 1 držela otisky v témže záznamu; při načtení se oddělí. */
function evidence(data: unknown): { readonly evidence: Evidence; readonly otisky: Otisky | null } | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Partial<Omit<Evidence, 'verze'>> & { readonly verze?: unknown; readonly zaznamy?: unknown };
  if ((d.verze !== 1 && d.verze !== 2) || typeof d.dialog !== 'boolean' || !Number.isSafeInteger(d.dalsiId) || d.dalsiId! < 1
    || !Array.isArray(d.neprectene)) return null;
  if (!d.neprectene.every(z => z && Number.isSafeInteger(z.id) && z.id > 0 && z.id < d.dalsiId!
    && typeof z.tiketId === 'string' && typeof z.datum === 'string' && typeof z.vyhra === 'boolean'
    && typeof z.castkaKc === 'number' && Number.isFinite(z.castkaKc) && z.castkaKc >= 0
    && typeof z.nejista === 'boolean' && typeof z.oprava === 'boolean')) return null;
  const zVerze1 = d.verze === 1 ? otisky(d.zaznamy) : null;
  if (d.verze === 1 && zVerze1 === null) return null;
  return { evidence: { verze: 2, dialog: d.dialog, dalsiId: d.dalsiId!, neprectene: d.neprectene }, otisky: zVerze1 };
}

/** Jen lokální evidence v tomtéž šifrovaném úložišti jako tikety. */
@Injectable({ providedIn: 'root' })
export class Oznameni {
  private readonly uloziste = inject(ULOZISTE);
  private readonly stav = signal<Evidence>(PRAZDNA);
  readonly neprectene = computed(() => this.stav().neprectene);
  readonly dialog = computed(() => this.stav().dialog);
  readonly chyba = signal<string | null>(null);
  private fronta: Promise<unknown> = Promise.resolve();
  private nacteno = false;

  private async veFronte(akce: () => Promise<void>): Promise<boolean> {
    const beh = this.fronta.then(akce);
    this.fronta = beh.catch(() => {});
    try {
      await beh;
      this.chyba.set(null);
      return true;
    } catch {
      this.chyba.set('Upozornění se nepodařilo uložit. Zkus akci znovu; nepotvrzené výsledky zůstávají nepřečtené.');
      return false;
    }
  }

  /** Otisky, se kterými se srovnává; `null`, dokud nejsou známé. */
  private otisky: Otisky | null = null;
  /** Co z otisků už je v úložišti; zbytečně se nepřepisují. */
  private ulozeneOtisky: Otisky | null = null;

  private async zapis(data: Evidence): Promise<void> {
    await this.uloziste.ulozNastaveni(KLIC, data);
    this.stav.set(data);
  }

  /**
   * Nepřečtené dřív než otisky: pád mezi zápisy pak výsledek ohlásí znovu, ale neztratí.
   * Otisky se zapíšou, jen když se změnily.
   */
  private async zapisSOtisky(data: Evidence, nove: Otisky): Promise<void> {
    await this.zapis(data);
    if (!stejne(nove, this.ulozeneOtisky)) {
      await this.uloziste.ulozNastaveni(KLIC_OTISKU, [...nove].map(([k, o]) => {
        const [tiketId, datum] = JSON.parse(k) as [string, string];
        return { tiketId, datum, otisk: o };
      }));
      this.ulozeneOtisky = nove;
    }
    this.otisky = nove;
  }

  /** Otisky se tu zapíšou jen jednou po převodu z verze 1, jinak zůstanou netknuté. */
  private zapisMale(data: Evidence): Promise<void> {
    return this.otisky ? this.zapisSOtisky(data, this.otisky) : this.zapis(data);
  }

  private async nactiUlozene(): Promise<Evidence | null> {
    const ulozene = evidence(await this.uloziste.nactiNastaveni(KLIC));
    this.otisky = this.ulozeneOtisky = null;
    if (!ulozene) return null;
    if (ulozene.otisky) this.otisky = ulozene.otisky;
    else this.otisky = this.ulozeneOtisky = otisky(await this.uloziste.nactiNastaveni(KLIC_OTISKU));
    return ulozene.evidence;
  }

  /** První zavedení použije dosavadní výsledky jako základ, restart dožene přerušený zápis. */
  async nacti(vysledky: ReadonlyMap<string, VysledekTiketu>): Promise<boolean> {
    return this.veFronte(async () => {
      const data = await this.nactiUlozene() ?? PRAZDNA;
      await this.zapisSOtisky(...this.srovnej(data, this.otisky ?? otiskyVysledku(vysledky), vysledky, new Set()));
      this.nacteno = true;
    });
  }

  /** Předchozí stav slouží jako základ i v testech bez startu celé aplikace. */
  async aktualizuj(pred: ReadonlyMap<string, VysledekTiketu>, po: ReadonlyMap<string, VysledekTiketu>, tise: readonly string[] = []): Promise<boolean> {
    return this.veFronte(async () => {
      if (!this.nacteno) {
        this.stav.set(await this.nactiUlozene() ?? PRAZDNA);
        this.nacteno = true;
      }
      await this.zapisSOtisky(...this.srovnej(this.stav(), this.otisky ?? otiskyVysledku(pred), po, new Set(tise)));
    });
  }

  private srovnej(data: Evidence, stare: Otisky, po: ReadonlyMap<string, VysledekTiketu>, tise: ReadonlySet<string>): [Evidence, Otisky] {
    const aktualni = new Map<string, string>();
    const neprectene = new Map(data.neprectene.map(z => [klic(z.tiketId, z.datum), z]));
    let dalsiId = data.dalsiId;
    for (const [tiketId, v] of po) for (const s of v.slosovani) {
      const k = klic(tiketId, s.datum);
      const o = otisk(s);
      aktualni.set(k, o);
      if (stare.get(k) === o) continue;
      if (tise.has(tiketId)) { neprectene.delete(k); continue; }
      neprectene.set(k, {
        id: dalsiId++, tiketId, datum: s.datum, vyhra: s.vyhry.length > 0,
        castkaKc: s.celkemKc, nejista: s.nejistychVyher > 0, oprava: stare.has(k),
      });
    }
    const platne = [...neprectene].filter(([k]) => aktualni.has(k)).map(([, z]) => z);
    return [{ ...data, dalsiId, neprectene: platne.sort((a, b) => b.datum.localeCompare(a.datum) || b.id - a.id) }, aktualni];
  }

  /** Bez načtené evidence by zápis přepsal uloženou prázdnou a další stažení by ohlásilo celou historii. */
  private async zajistiNacteni(): Promise<void> {
    if (this.nacteno) return;
    const ulozene = await this.nactiUlozene();
    if (!ulozene) throw new Error('Upozornění ještě nejsou načtená.');
    this.stav.set(ulozene);
    this.nacteno = true;
  }

  potvrdit(ids: readonly number[]): Promise<boolean> {
    return this.veFronte(async () => {
      await this.zajistiNacteni();
      await this.zapisMale({ ...this.stav(), neprectene: this.neprectene().filter(z => !ids.includes(z.id)) });
    });
  }

  nastavDialog(dialog: boolean): Promise<boolean> {
    return this.veFronte(async () => {
      await this.zajistiNacteni();
      await this.zapisMale({ ...this.stav(), dialog });
    });
  }
}
