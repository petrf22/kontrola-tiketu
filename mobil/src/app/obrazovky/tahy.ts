import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import type { Hra } from '@kontrola-tiketu/jadro';
import { formatujDatum, formatujKc, HRY, nazevDne, nazevHry } from '../data/format.js';
import { Stav } from '../data/stav.js';
import { filtrujTahy, VYCHOZI_FILTR_TAHU, zobrazTah, type FiltrTahu, type TabulkaVyher } from '../data/zobrazeniTahu.js';

const STRANKA = 20;
const POCET = new Intl.NumberFormat('cs-CZ');

/**
 * Vylosovaná čísla a tabulky výher z tahů uložených v telefonu. Nic nestahuje — prohlížení
 * nesmí prozradit, který tah uživatele zajímá.
 */
@Component({
  selector: 'app-tahy',
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
              <span class="cisla">@for (c of o.cisla; track $index) { <span class="cislo">{{ c }}</span> }</span>
              <span class="cisla euro" [attr.aria-label]="o.nazevDruhych">@for (c of o.druhe; track $index) { <span class="cislo">{{ c }}</span> }</span>
            </span>
          }
          @if (z.doplnkova; as d) {
            <span class="doplnkova">{{ d.nazev }} <strong>{{ d.cislice }}</strong></span>
          }
          @if (z.tabulky.length === 0) { <small class="tlumene">Tabulka výher zatím není.</small> }
        </summary>

        @for (o of z.osudi; track $index) {
          <p class="poznamka">{{ o.nadpis ? o.nadpis + ': ' : '' }}V pořadí losování {{ o.vPoradiLosovani.join(', ') }} · {{ o.nazevDruhych }} {{ o.druheVPoradiLosovani.join(', ') }}</p>
        }
        <p class="poznamka">
          Vsazeno {{ formatujKc(z.vsazenoKc) }}@if (z.naVyhryKc !== null) { · na výhry {{ formatujKc(z.naVyhryKc) }} }
        </p>

        @for (t of z.tabulky; track t.nadpis) {
          <table>
            <caption>{{ t.nadpis }}</caption>
            <thead>
              <tr>
                <th scope="col">Pořadí</th>
                @if (maVzory(t)) { <th scope="col">Vylosováno</th> }
                @if (maPocty(t)) { <th scope="col" class="cislo-sloupec">Výherců</th> }
                <th scope="col" class="cislo-sloupec">Výhra</th>
              </tr>
            </thead>
            <tbody>
              @for (r of t.radky; track $index) {
                <tr>
                  <td>{{ r.popis }}</td>
                  @if (maVzory(t)) { <td>{{ r.vzor ?? '' }}</td> }
                  @if (maPocty(t)) { <td class="cislo-sloupec">{{ r.pocetVyher === null ? '' : pocet(r.pocetVyher) }}</td> }
                  <td class="cislo-sloupec">{{ formatujKc(r.castkaKc) }}</td>
                </tr>
              }
            </tbody>
          </table>
          @if (t.poznamka) { <p class="poznamka">{{ t.poznamka }}</p> }
        }
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
    .nadpis, .doplnkova, .poznamka { font-size: 0.8rem; color: var(--barva-text-tlumeny); }
    .nadpis { min-width: 3rem; }
    .doplnkova { display: block; margin-top: 0.4rem; }
    .doplnkova strong { color: var(--barva-text); font-variant-numeric: tabular-nums; letter-spacing: 0.05em; }
    .cisla { display: flex; flex-wrap: wrap; gap: 0.25rem; }
    .cisla.euro { padding-left: 0.5rem; border-left: 1px solid var(--barva-ram); }
    .cislo {
      min-width: 1.9rem; padding: 0.15rem 0.3rem; border-radius: 4px;
      background: var(--barva-plocha); text-align: center;
      font-variant-numeric: tabular-nums; font-size: 0.9rem;
    }
    .poznamka { margin: 0.4rem 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 0.75rem; font-size: 0.85rem; }
    caption { text-align: left; font-weight: 600; padding-bottom: 0.25rem; }
    th { text-align: left; font-weight: 400; color: var(--barva-text-tlumeny); }
    th, td { padding: 0.3rem 0.25rem; border-bottom: 1px solid var(--barva-ram); }
    .cislo-sloupec { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
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
  protected readonly pocet = (n: number) => POCET.format(n);
  protected readonly maVzory = (t: TabulkaVyher) => t.radky.some(r => r.vzor !== null);
  protected readonly maPocty = (t: TabulkaVyher) => t.radky.some(r => r.pocetVyher !== null);

  protected zmenHru(hra: Hra | 'vse'): void {
    this.filtr.update(f => ({ ...f, hra }));
  }

  /** Prázdné pole z výběru data znamená nejnovější tahy. */
  protected zmenDatum(datum: string): void {
    this.filtr.update(f => ({ ...f, doData: datum === '' ? null : datum }));
  }
}
