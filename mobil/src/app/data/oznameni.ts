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
interface Zaznam { readonly tiketId: string; readonly datum: string; readonly otisk: string }
interface Evidence {
  readonly verze: 1;
  readonly dialog: boolean;
  readonly dalsiId: number;
  readonly zaznamy: readonly Zaznam[];
  readonly neprectene: readonly OznameniVysledku[];
}
const KLIC = 'oznameniVysledku';
const PRAZDNA: Evidence = { verze: 1, dialog: true, dalsiId: 1, zaznamy: [], neprectene: [] };
const klic = (s: { tiketId: string; datum: string }) => JSON.stringify([s.tiketId, s.datum]);
const otisk = (s: VysledekSlosovani) => JSON.stringify([s.vyhry, s.celkemKc, s.nejistychVyher]);
function zaznamy(vysledky: ReadonlyMap<string, VysledekTiketu>): Zaznam[] {
  return [...vysledky].flatMap(([tiketId, v]) => v.slosovani.map(s => ({ tiketId, datum: s.datum, otisk: otisk(s) })));
}
function evidence(data: unknown): Evidence | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Partial<Evidence>;
  if (d.verze !== 1 || typeof d.dialog !== 'boolean' || !Number.isSafeInteger(d.dalsiId) || d.dalsiId! < 1
    || !Array.isArray(d.zaznamy) || !Array.isArray(d.neprectene)) return null;
  if (!d.zaznamy.every(z => z && typeof z.tiketId === 'string' && typeof z.datum === 'string' && typeof z.otisk === 'string')) return null;
  if (!d.neprectene.every(z => z && Number.isSafeInteger(z.id) && z.id > 0 && z.id < d.dalsiId!
    && typeof z.tiketId === 'string' && typeof z.datum === 'string' && typeof z.vyhra === 'boolean'
    && typeof z.castkaKc === 'number' && Number.isFinite(z.castkaKc) && z.castkaKc >= 0
    && typeof z.nejista === 'boolean' && typeof z.oprava === 'boolean')) return null;
  return d as Evidence;
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

  private async zapis(data: Evidence): Promise<void> {
    await this.uloziste.ulozNastaveni(KLIC, data);
    this.stav.set(data);
  }

  /** První zavedení použije dosavadní výsledky jako základ, restart dožene přerušený zápis. */
  async nacti(vysledky: ReadonlyMap<string, VysledekTiketu>): Promise<boolean> {
    return this.veFronte(async () => {
      const ulozene = evidence(await this.uloziste.nactiNastaveni(KLIC));
      const data = ulozene ?? { ...PRAZDNA, zaznamy: zaznamy(vysledky) };
      await this.zapis(this.srovnej(data, vysledky, new Set()));
      this.nacteno = true;
    });
  }

  /** Předchozí stav slouží jako základ i v testech bez startu celé aplikace. */
  async aktualizuj(pred: ReadonlyMap<string, VysledekTiketu>, po: ReadonlyMap<string, VysledekTiketu>, tise: readonly string[] = []): Promise<boolean> {
    return this.veFronte(async () => {
      if (!this.nacteno) {
        const ulozene = evidence(await this.uloziste.nactiNastaveni(KLIC));
        this.stav.set(ulozene ?? { ...PRAZDNA, zaznamy: zaznamy(pred) });
        this.nacteno = true;
      }
      await this.zapis(this.srovnej(this.stav(), po, new Set(tise)));
    });
  }

  private srovnej(data: Evidence, po: ReadonlyMap<string, VysledekTiketu>, tise: ReadonlySet<string>): Evidence {
    const stare = new Map(data.zaznamy.map(z => [klic(z), z.otisk]));
    const aktualni = zaznamy(po);
    const platne = new Map(aktualni.map(z => [klic(z), z.otisk]));
    const neprectene = new Map(data.neprectene.filter(z => platne.has(klic(z))).map(z => [klic(z), z]));
    let dalsiId = data.dalsiId;
    for (const [tiketId, v] of po) for (const s of v.slosovani) {
      const k = klic({ tiketId, datum: s.datum });
      if (stare.get(k) === otisk(s)) continue;
      if (tise.has(tiketId)) { neprectene.delete(k); continue; }
      neprectene.set(k, {
        id: dalsiId++, tiketId, datum: s.datum, vyhra: s.vyhry.length > 0,
        castkaKc: s.celkemKc, nejista: s.nejistychVyher > 0, oprava: stare.has(k),
      });
    }
    return { ...data, dalsiId, zaznamy: aktualni, neprectene: [...neprectene.values()].sort((a, b) => b.datum.localeCompare(a.datum) || b.id - a.id) };
  }

  potvrdit(ids: readonly number[]): Promise<boolean> {
    return this.veFronte(() => this.zapis({ ...this.stav(), neprectene: this.neprectene().filter(z => !ids.includes(z.id)) }));
  }

  nastavDialog(dialog: boolean): Promise<boolean> {
    return this.veFronte(() => this.zapis({ ...this.stav(), dialog }));
  }
}
