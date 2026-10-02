import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import type { Hra } from '@kontrola-tiketu/jadro';
import { formatujDatum, formatujKc, HRY, nazevDne, nazevHry } from '../data/format.js';
import { Stav } from '../data/stav.js';
import { filtrujTahy, VYCHOZI_FILTR_TAHU, zobrazTah, type FiltrTahu } from '../data/zobrazeniTahu.js';
import { VyhryTahu } from './vyhry-tahu.js';

const STRANKA = 20;

/**
 * Vylosovaná čísla a tabulky výher z tahů uložených v telefonu. Nic nestahuje — prohlížení
 * nesmí prozradit, který tah uživatele zajímá.
 */
@Component({
  selector: 'app-tahy',
  imports: [VyhryTahu],
  template: `
    <div class="prepinace" aria-label="Hra">
      <button type="button" [attr.aria-pressed]="filtr().hra === 'vse'" (click)="zmenHru('vse')">Vše</button>
      @for (hra of hry; track hra) {
        <button type="button" [attr.aria-pressed]="filtr().hra === hra" (click)="zmenHru(hra)">{{ nazevHry(hra) }}</button>
      }
    </div>
    <div class="datum">
      <label>Do data
        <input type="date" [value]="filtr().doData ?? ''" [max]="stav.vysledkyDo() ?? ''" (change)="zmenDatum($any($event.target).value)" />
      </label>
      @if (filtr().doData) {
        <button type="button" (click)="zmenDatum('')">Nejnovější</button>
      }
    </div>

    @for (z of zobrazene(); track z.klic) {
      <details class="tah">
        <summary>
          <span class="hlavicka">
            <span>{{ nazevHry(z.hra) }} · {{ nazevDne(z.den) }} {{ formatujDatum(z.datum) }}</span>
            @if (z.jackpot; as j) { <small>{{ j.nazev }} {{ formatujKc(j.castkaKc) }}</small> }
          </span>
          @for (o of z.osudi; track $index) {
            <span class="osudi">
              @if (o.nadpis) { <span class="nadpis">{{ o.nadpis }}</span> }
              <span class="kulicky">@for (c of o.cisla; track $index) { <span class="kulicka">{{ c }}</span> }</span>
              <span class="kulicky druhe-osudi" [attr.aria-label]="o.nazevDruhych">@for (c of o.druhe; track $index) { <span class="kulicka">{{ c }}</span> }</span>
            </span>
          }
          @if (z.doplnkova; as d) {
            <span class="doplnkova">{{ d.nazev }} <strong>{{ d.cislice }}</strong></span>
          }
          @if (z.tabulky.length === 0) { <small class="tlumene">Tabulka výher zatím není.</small> }
        </summary>

        <app-vyhry-tahu [tah]="z" />
      </details>
    } @empty {
      <p class="tlumene">Tomuto filtru neodpovídá žádný tah.</p>
    }
    @if (zobrazene().length < vybrane().length) {
      <button type="button" class="rozbalit" (click)="limit.update(dalsiStrana)">Načíst dalších {{ stranka }}</button>
    }
  `,
  styles: `
    .datum { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 0.75rem; margin: 0.75rem 0 1rem; }
    .datum label { display: flex; align-items: center; gap: 0.75rem; }
    /* Obsah summary jsou bloky, výchozí šipka by zůstala na samostatném řádku. */
    .tah > summary { font-weight: 400; list-style: none; }
    .tah > summary::-webkit-details-marker { display: none; }
    .hlavicka > span::before { content: '▸ '; }
    .tah[open] .hlavicka > span::before { content: '▾ '; }
    .hlavicka { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0 1rem; font-weight: 600; }
    .hlavicka small { font-weight: 400; color: var(--barva-text-tlumeny); }
    .osudi { display: flex; flex-wrap: wrap; align-items: center; gap: 0.25rem 0.5rem; margin-top: 0.4rem; }
    .nadpis, .doplnkova { font-size: 0.8rem; color: var(--barva-text-tlumeny); }
    .nadpis { min-width: 3rem; }
    .doplnkova { display: block; margin-top: 0.4rem; }
    .doplnkova strong { color: var(--barva-text); font-variant-numeric: tabular-nums; letter-spacing: 0.05em; }
    .kulicky { flex-wrap: wrap; }
    .rozbalit { margin-top: 0.75rem; width: 100%; }
  `,
})
export class Tahy {
  protected readonly stav = inject(Stav);
  protected readonly hry = HRY;
  protected readonly stranka = STRANKA;

  protected readonly filtr = signal<FiltrTahu>(VYCHOZI_FILTR_TAHU);
  protected readonly vybrane = computed(() => filtrujTahy(this.stav.tahy(), this.filtr()));
  /** Nový filtr začíná zase první stránkou. */
  protected readonly limit = linkedSignal(() => { this.filtr(); return STRANKA; });
  protected readonly zobrazene = computed(() =>
    this.vybrane().slice(0, this.limit()).map(t => zobrazTah(t, this.stav.sazby(), this.stav.sazbyEurosance())),
  );
  protected readonly dalsiStrana = (n: number) => n + STRANKA;

  protected readonly formatujDatum = formatujDatum;
  protected readonly formatujKc = formatujKc;
  protected readonly nazevDne = nazevDne;
  protected readonly nazevHry = nazevHry;

  protected zmenHru(hra: Hra | 'vse'): void {
    this.filtr.update(f => ({ ...f, hra }));
  }

  /** Prázdné pole z výběru data znamená nejnovější tahy. */
  protected zmenDatum(datum: string): void {
    this.filtr.update(f => ({ ...f, doData: datum === '' ? null : datum }));
  }
}
