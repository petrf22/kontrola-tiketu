import { Component, input } from '@angular/core';
import { formatujKc } from '../data/format.js';
import type { TabulkaVyher, ZobrazenyTah } from '../data/zobrazeniTahu.js';

const POCET = new Intl.NumberFormat('cs-CZ');

/**
 * Vylosovaná čísla v pořadí losování, vklady a tabulky výher jednoho tahu. Sdílejí ji
 * Výsledky losování a historie v detailu tiketu; data bere jen z tahů uložených v telefonu.
 */
@Component({
  selector: 'app-vyhry-tahu',
  template: `
    @let z = tah();
    @if (cisla()) {
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
      @if (z.tabulky.length === 0) { <p class="poznamka">Tabulka výher zatím není.</p> }
    }

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
  `,
  styles: `
    :host { display: block; }
    .osudi { display: flex; flex-wrap: wrap; align-items: center; gap: 0.25rem 0.5rem; margin-top: 0.4rem; }
    .nadpis, .doplnkova, .poznamka { font-size: 0.8rem; color: var(--barva-text-tlumeny); }
    .nadpis { min-width: 3rem; }
    .doplnkova { display: block; margin-top: 0.4rem; }
    .doplnkova strong { color: var(--barva-text); font-variant-numeric: tabular-nums; letter-spacing: 0.05em; }
    .kulicky { flex-wrap: wrap; }
    .poznamka { margin: 0.4rem 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 0.75rem; font-size: 0.85rem; }
    caption { text-align: left; font-weight: 600; padding-bottom: 0.25rem; }
    th { text-align: left; font-weight: 400; color: var(--barva-text-tlumeny); }
    th, td { padding: 0.3rem 0.25rem; border-bottom: 1px solid var(--barva-ram); }
    .cislo-sloupec { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  `,
})
export class VyhryTahu {
  readonly tah = input.required<ZobrazenyTah>();
  /** Vykreslí i vylosovaná čísla — Výsledky losování je mají v hlavičce, detail tiketu ne. */
  readonly cisla = input(false);

  protected readonly formatujKc = formatujKc;
  protected readonly pocet = (n: number) => POCET.format(n);
  protected readonly maVzory = (t: TabulkaVyher) => t.radky.some(r => r.vzor !== null);
  protected readonly maPocty = (t: TabulkaVyher) => t.radky.some(r => r.pocetVyher !== null);
}
