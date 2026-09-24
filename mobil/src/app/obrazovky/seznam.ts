import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { formatujDatum, formatujKc, nazevHry } from '../data/format.js';
import { Stav } from '../data/stav.js';
import { odpovidaNazvu, seskupPodleNazvu } from '../data/nazvyTiketu.js';
import { FiltrNazvu } from './filtr-nazvu.js';
import type { Tiket } from '@kontrola-tiketu/jadro';

interface RadekSeznamu {
  readonly tiket: Tiket;
  readonly castkaKc: number;
  readonly jisty: boolean;
  /** Všechna proběhlá slosování jsou spočítaná — na rozdíl od `jisty` nevadí, že tiket běží dál. */
  readonly dosudJisty: boolean;
  readonly chybi: number;
  readonly pokracuje: boolean;
}

@Component({
  selector: 'app-seznam',
  imports: [RouterLink, FiltrNazvu],
  template: `
    <div class="zahlavi"><h2>Tikety</h2><a class="pridat-tiket hlavni" routerLink="/pridat">+ Přidat tiket</a></div>
    <details class="filtry">
      <summary>Filtr · <span class="popis-filtru">{{ popisFiltru() }}</span></summary>
      <div class="prepinace" aria-label="Umístění tiketů">
        <button type="button" [attr.aria-pressed]="!archiv()" (click)="archiv.set(false)">Aktuální</button>
        <button type="button" [attr.aria-pressed]="archiv()" (click)="archiv.set(true)">Archiv</button>
      </div>
      <label class="filtr">Typ tiketu
        <select [value]="typ()" (change)="typ.set($any($event.target).value)">
          <option value="vsechny">Všechny</option><option value="papirove">Papírové</option><option value="virtualni">Virtuální</option>
        </select>
      </label>
      <app-filtr-nazvu [hodnota]="nazev()" (zmena)="nazev.set($event)" />
      <div class="prepinace" aria-label="Seskupení tiketů">
        <button type="button" [attr.aria-pressed]="!seskupit()" (click)="seskupit.set(false)">Podle data</button>
        <button type="button" [attr.aria-pressed]="seskupit()" (click)="seskupit.set(true)">Podle názvu</button>
      </div>
    </details>
    @if (radky().length === 0) {
      <p class="prazdno">
        {{ archiv() ? 'V archivu nejsou žádné tikety odpovídající filtrům.' : 'Zatím tu nejsou žádné tikety odpovídající filtrům.' }}
      </p>
      @if (!archiv()) { <p><a class="zpet" routerLink="/sken-cisel">Vyfotit tiket</a> · <a class="zpet" routerLink="/tiket/novy">Zadat ručně</a></p> }
    } @else {
      @for (skupina of skupiny(); track skupina.klic) {
        @if (seskupit()) { <h3 class="nazev-skupiny">{{ skupina.nazev }} <small>({{ skupina.polozky.length }})</small></h3> }
      <ul class="tikety">
        @for (radek of skupina.polozky; track radek.tiket.id) {
          <li>
            <a [routerLink]="['/tiket', radek.tiket.id]">
              <span class="hra">
                {{ radek.tiket.nazev ? radek.tiket.nazev + ' · ' : '' }}{{ nazevHry(radek.tiket.hra) }}
                @if (radek.tiket.kontrola) { <span class="stitek">virtuální</span> }
              </span>
              <span class="detail">
                {{ radek.tiket.sloupce.length }}&nbsp;sl.
                @if (radek.tiket.kontrola; as k) {
                  &middot; od {{ formatujDatum(k.od) }}
                  &middot; {{ k.do === null ? 'bez konce' : 'do ' + formatujDatum(k.do) }}
                } @else {
                  &middot; od {{ formatujDatum(radek.tiket.slosovani.prvni) }}
                  &middot; {{ radek.tiket.slosovani.pocet }}&nbsp;slos.
                }
              </span>
              <span class="castka" [class.nejisty]="!radek.jisty">
                @if (radek.castkaKc > 0) {
                  Výhra {{ formatujKc(radek.castkaKc) }}
                } @else if (!radek.dosudJisty) {
                  Výsledek zatím neúplný
                } @else if (radek.pokracuje) {
                  zatím bez výhry
                } @else {
                  bez výhry
                }
                @if (radek.chybi > 0) { <small>Chybí {{ radek.chybi }} slosování</small> }
                @else if (!radek.dosudJisty) { <small>Vyhodnocení není konečné</small> }
                @else if (radek.pokracuje) { <small>Další slosování ještě přijdou</small> }
                @else { <small>Vyhodnoceno</small> }
              </span>
            </a>
          </li>
        }
      </ul>
      }
    }
  `,
  styles: `
    .zahlavi { display: flex; align-items: center; justify-content: space-between; gap: .75rem; flex-wrap: wrap; }
    .pridat-tiket { padding: .75rem 1rem; border-radius: .75rem; text-decoration: none; }
    .popis-filtru { font-weight: 400; color: var(--barva-text-tlumeny); }
    .filtr { display: flex; align-items: center; gap: .75rem; margin: .75rem 0 0; }
    .castka small { display: block; font-size: .8rem; color: var(--barva-text-tlumeny); margin-top: .25rem; }
    @media (max-width: 440px) { .tikety a .castka { grid-column: 1 / -1; grid-row: auto; margin-top: .5rem; } }
    .prazdno { color: var(--barva-text-tlumeny); }
    .tikety { list-style: none; margin: 0; padding: 0; }
    .tikety li { border: 1px solid var(--barva-ram); border-radius: .85rem; margin: .75rem 0; padding: .5rem .75rem; }
    .tikety a {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 0.15rem 1rem;
      padding: 0.75rem 0.25rem;
      color: inherit;
      text-decoration: none;
    }
    .hra { font-weight: 600; min-width: 0; overflow-wrap: anywhere; }
    .nazev-skupiny { margin: 1.5rem 0 .5rem; overflow-wrap: anywhere; }
    .nazev-skupiny small { color: var(--barva-text-tlumeny); font-weight: 400; }
    .stitek {
      margin-left: 0.3rem; padding: 0 0.4rem; border: 1px solid var(--barva-duraz);
      border-radius: 999px; color: var(--barva-duraz); font-size: 0.65rem; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.05em; vertical-align: middle;
    }
    .detail { grid-column: 1; font-size: 0.8rem; color: var(--barva-text-tlumeny); }
    /*
      Sloupec se musí určit výslovně. Mřížka umisťuje nejdřív prvky s pevným řádkem, takže
      by částka sebrala první sloupec a název hry by skončil vpravo — opačně, než se čte.
    */
    .castka {
      grid-column: 2; grid-row: 1 / span 2;
      align-self: center; font-variant-numeric: tabular-nums;
    }
    .castka.nejisty { color: var(--barva-text-tlumeny); }
  `,
})
export class Seznam {
  private readonly stav = inject(Stav);
  private readonly parametry = inject(ActivatedRoute).snapshot.queryParamMap;
  protected readonly archiv = signal(this.parametry.get('archiv') === '1');
  protected readonly typ = signal('vsechny');
  /** Klíč z `klicNazvu`; Přehled sem odkazuje u každé skupiny. */
  protected readonly nazev = signal(this.parametry.get('nazev') ?? '*');
  protected readonly seskupit = signal(true);

  protected readonly formatujDatum = formatujDatum;
  protected readonly formatujKc = formatujKc;
  protected readonly nazevHry = nazevHry;

  protected readonly skupiny = computed(() => this.seskupit()
    ? seskupPodleNazvu(this.radky(), r => r.tiket.nazev)
    : [{ klic: '*', nazev: '', polozky: this.radky() }]);

  /**
   * Souhrn filtru je vidět i zavřený — po návratu z detailu archivovaného tiketu je vybraný archiv
   * a z přehledu skupin se sem přichází rovnou s filtrem podle názvu.
   */
  protected readonly popisFiltru = computed(() => {
    const nazev = this.nazev() === '*' ? undefined : this.stav.skupinyNazvu().find(s => s.klic === this.nazev())?.nazev;
    return (this.archiv() ? 'Archiv' : 'Aktuální')
      + ({ papirove: ' · Papírové', virtualni: ' · Virtuální' }[this.typ()] ?? '')
      + (nazev === undefined ? '' : ` · ${nazev}`);
  });

  protected readonly radky = computed<RadekSeznamu[]>(() =>
    [...this.stav.tikety()].filter(t => !!t.archivovany === this.archiv())
      .filter(t => this.typ() === 'vsechny' || (this.typ() === 'virtualni' ? !!t.kontrola : !t.kontrola))
      .filter(t => odpovidaNazvu(t, this.nazev()))
      .sort((a, b) => b.vlozeno.localeCompare(a.vlozeno)).map((tiket) => {
      const vysledek = this.stav.vysledky().get(tiket.id) ?? this.stav.vyhodnot(tiket);
      return {
        tiket,
        castkaKc: vysledek.celkemKc,
        jisty: vysledek.soucetJisty,
        dosudJisty: vysledek.chybejicichSlosovani === 0 && vysledek.slosovani.every(s => s.nejistychVyher === 0),
        chybi: vysledek.chybejicichSlosovani,
        pokracuje: vysledek.pokracuje,
      };
    }),
  );
}
