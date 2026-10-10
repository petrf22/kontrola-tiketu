import { Component, ElementRef, inject, signal } from '@angular/core';
import { formatujDatum, formatujDatumCas } from '../data/format.js';
import { Stav } from '../data/stav.js';
import { RouterLink } from '@angular/router';
import { Tahy } from './tahy.js';

@Component({
  selector: 'app-import-vysledku',
  imports: [RouterLink, Tahy],
  template: `
    <a class="zpet" routerLink="/dalsi">← Další</a>
    <h2>Výsledky losování</h2>
    <div class="karty" (keydown)="klavesaKarty($event)" role="tablist" aria-label="Výsledky losování">
      <button type="button" id="karta-prehled" role="tab" aria-controls="panel-prehled" [attr.tabindex]="karta() === 'prehled' ? 0 : -1" [attr.aria-selected]="karta() === 'prehled'" (click)="karta.set('prehled')">Přehled</button>
      <button type="button" id="karta-sprava" role="tab" aria-controls="panel-sprava" [attr.tabindex]="karta() === 'sprava' ? 0 : -1" [attr.aria-selected]="karta() === 'sprava'" (click)="karta.set('sprava')">Správa</button>
    </div>

    <div role="tabpanel" [id]="'panel-' + karta()" [attr.aria-labelledby]="'karta-' + karta()" tabindex="0">
    @if (karta() === 'prehled') {
      @if (stav.tahy().length > 0) {
        <app-tahy />
      } @else {
        <p class="tlumene">Zatím nejsou stažené žádné výsledky.</p>
        <button type="button" class="stahnout" [disabled]="stav.stahuje()" (click)="stahni()">
          {{ stav.stahuje() ? 'Stahuji…' : 'Stáhnout výsledky' }}
        </button>
        @if (stav.posledniStazeni(); as z) {
          <p class="zprava" [class.chyba]="!z.uspech" [attr.role]="z.uspech ? 'status' : 'alert'">{{ z.zprava }}</p>
        }
      }
    } @else {
      <p class="tlumene">{{ stav.stahuje() ? 'Probíhá aktualizace…' : stav.vysledkyDo() ? 'Uložené výsledky do ' + formatujDatum(stav.vysledkyDo()!) : 'Zatím nejsou stažené žádné výsledky.' }}</p>
      <section>
        <button type="button" class="stahnout" [disabled]="stav.stahuje()" (click)="stahni()">
          {{ stav.stahuje() ? 'Stahuji…' : 'Stáhnout výsledky' }}
        </button>

        @if (stav.posledniStazeni(); as z) {
          <p class="zprava" [class.chyba]="!z.uspech" [attr.role]="z.uspech ? 'status' : 'alert'">{{ z.zprava }}</p>
        }

        @if (stav.kontrolaServeru(); as k) {
          <dl class="kontrola">
            @if (k.eurojackpot; as ej) {
              <dt>Eurojackpot</dt>
              <dd>poslední tah {{ formatujDatum(ej.posledniTah) }}{{ ej.uplny ? '' : ' — tabulka výher zatím není' }}</dd>
            }
            @if (k.sportka; as sp) {
              <dt>Sportka</dt>
              <dd>poslední tah {{ formatujDatum(sp.posledniTah) }}{{ sp.uplny ? '' : ' — tabulka výher zatím není' }}</dd>
            }
            @if (k.euromiliony; as em) {
              <dt>Euromiliony</dt>
              <dd>poslední tah {{ formatujDatum(em.posledniTah) }}{{ em.uplny ? '' : ' — tabulka výher zatím není' }}</dd>
            }
            @if (k.posledniDotaz) {
              <dt>Server kontroloval</dt>
              <dd>{{ formatujDatumCas(k.posledniDotaz) }}</dd>
            }
          </dl>
        }

        @if (stav.tahy().length > 0) {
          <p class="souhrn">V aplikaci je {{ stav.tahy().length }} tahů, poslední z {{ formatujDatum(stav.vysledkyDo()!) }}.</p>
        }
      </section>

      <details class="vysvetleni">
        <summary>Soukromí při stahování</summary>
        <p>
          Nic, co by prozradilo tvoje tikety. Aplikace si stáhne <strong>všechny</strong> výsledky
          za poslední roky, pro každého stejně — jen seznam a pak celé balíky po letech. Na server
          nejde žádné vsazené číslo, sériové číslo tiketu ani nic, podle čeho by se dalo poznat,
          kdo se ptá. Vyhodnocení proběhne až tady v telefonu.
        </p>
        <p>
          Server s výsledky patří tomuto projektu, ne provozovateli loterie. Allwyn se o tobě
          nedozví vůbec nic.
        </p>
      </details>

      <details class="zaloha">
        <summary>Importovat ze souboru</summary>
        <p>
          Když server není dostupný, dají se výsledky naimportovat souborem. Stačí roční balík
          stažený ze serveru výsledků jinde (například <code>2026.json</code>).
        </p>
        <label class="vyber">
          Soubor s výsledky
          <input type="file" [disabled]="importuje()" accept="application/json,.json" (change)="vyber($event)" />
        </label>
        @if (zprava(); as z) {
          <p class="zprava" [class.chyba]="!uspech()" [attr.role]="uspech() ? 'status' : 'alert'">{{ z }}</p>
        }
      </details>
    }
    </div>
  `,
  styles: `
    /* Záložky, ne přepínače — filtr hry pod nimi je přepínač a obojí by splývalo. */
    .karty { display: flex; margin: 0.75rem 0 1rem; border-bottom: 1px solid var(--barva-ram); }
    .karty button {
      border: none; border-bottom: 3px solid transparent; border-radius: 0; background: none;
      padding: 0.65rem 1.1rem; color: var(--barva-text-tlumeny);
    }
    .karty [aria-selected=true] { border-bottom-color: var(--barva-duraz); color: var(--barva-text); font-weight: 600; }
    .stahnout { font-size: 1rem; padding: 0.6rem 1.1rem; }
    .kontrola { display: grid; grid-template-columns: auto 1fr; gap: 0.2rem 0.75rem; margin: 1rem 0; font-size: 0.9rem; }
    .kontrola dt { color: var(--barva-text-tlumeny); }
    .kontrola dd { margin: 0; }
    h2 { font-size: 1rem; margin: 1.75rem 0 0.5rem; }
    .vysvetleni, .zaloha { font-size: 0.85rem; color: var(--barva-text-tlumeny); }
    code { word-break: break-all; }
    .vyber { display: block; margin: 0.75rem 0; }
    .zprava { padding: 0.6rem 0.75rem; background: var(--barva-plocha); border-left: 3px solid var(--barva-ok); color: var(--barva-text); }
    .zprava.chyba { border-left-color: var(--barva-chyba); }
    .souhrn { font-size: 0.85rem; color: var(--barva-text-tlumeny); }
  `,
})
export class ImportVysledku {
  protected readonly stav = inject(Stav);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly importuje = signal(false);
  protected readonly zprava = signal<string | null>(null);
  protected readonly uspech = signal(true);
  /** Jen v komponentě — po návratu na stránku je zase Přehled. */
  protected readonly karta = signal<'prehled' | 'sprava'>('prehled');

  protected readonly formatujDatum = formatujDatum;
  protected readonly formatujDatumCas = formatujDatumCas;

  protected async stahni(): Promise<void> {
    await this.stav.stahniVysledky();
  }

  protected async vyber(udalost: Event): Promise<void> {
    const vstup = udalost.target as HTMLInputElement;
    const soubor = vstup.files?.[0];
    if (soubor === undefined) return;

    if (this.importuje()) return;
    this.importuje.set(true);
    this.zprava.set(null);
    try {
      const vysledek = await this.stav.importuj(await soubor.text());
      this.uspech.set(vysledek.uspech);
      this.zprava.set(vysledek.zprava);
    } catch {
      this.uspech.set(false);
      this.zprava.set('Soubor se nepodařilo přečíst nebo uložit. Vyber ho znovu a zkus import opakovat.');
    } finally {
      vstup.value = '';
      this.importuje.set(false);
    }
  }

  protected klavesaKarty(e: KeyboardEvent): void {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const karta = e.key === 'Home' ? 'prehled' : e.key === 'End' ? 'sprava' : this.karta() === 'prehled' ? 'sprava' : 'prehled';
    this.karta.set(karta);
    this.element.nativeElement.querySelector<HTMLElement>('#karta-' + karta)?.focus();
  }
}
