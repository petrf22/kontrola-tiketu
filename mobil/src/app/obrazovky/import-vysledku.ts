import { Component, inject, signal } from '@angular/core';
import { formatujDatum, formatujDatumCas } from '../data/format.js';
import { Stav } from '../data/stav.js';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-import-vysledku',
  imports: [RouterLink],
  template: `
    <a class="zpet" routerLink="/dalsi">← Další</a>
    <h2>Výsledky losování</h2>
    <p class="tlumene">{{ stav.stahuje() ? 'Probíhá aktualizace…' : stav.vysledkyDo() ? 'Uložené výsledky do ' + formatujDatum(stav.vysledkyDo()!) : 'Zatím nejsou stažené žádné výsledky.' }}</p>
    <section>
      <button type="button" class="stahnout" [disabled]="stav.stahuje()" (click)="stahni()">
        {{ stav.stahuje() ? 'Stahuji…' : 'Stáhnout výsledky' }}
      </button>

      @if (stav.posledniStazeni(); as z) {
        <p class="zprava" [class.chyba]="!z.uspech">{{ z.zprava }}</p>
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
        <input type="file" accept="application/json,.json" (change)="vyber($event)" />
      </label>
      @if (zprava(); as z) {
        <p class="zprava" [class.chyba]="!uspech()">{{ z }}</p>
      }
    </details>
  `,
  styles: `
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
  protected readonly zprava = signal<string | null>(null);
  protected readonly uspech = signal(true);

  protected readonly formatujDatum = formatujDatum;
  protected readonly formatujDatumCas = formatujDatumCas;

  protected async stahni(): Promise<void> {
    await this.stav.stahniVysledky();
  }

  protected async vyber(udalost: Event): Promise<void> {
    const vstup = udalost.target as HTMLInputElement;
    const soubor = vstup.files?.[0];
    if (soubor === undefined) return;

    const vysledek = await this.stav.importuj(await soubor.text());
    this.uspech.set(vysledek.uspech);
    this.zprava.set(vysledek.zprava);
    vstup.value = '';
  }
}
