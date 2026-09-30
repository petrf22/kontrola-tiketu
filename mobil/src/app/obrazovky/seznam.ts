import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { dnesniDatum, formatujDatum, formatujKc, nazevHry } from '../data/format.js';
import { Stav } from '../data/stav.js';
import { odpovidaNazvu, seskupPodleNazvu } from '../data/nazvyTiketu.js';
import { cekaniNaSlosovani, type Cekani, type FiltrSeznamu } from '../data/zobrazeniTiketu.js';
import { FiltrNazvu } from './filtr-nazvu.js';
import type { Tiket } from '@kontrola-tiketu/jadro';

interface RadekSeznamu {
  readonly tiket: Tiket;
  readonly castkaKc: number;
  /** Všechna proběhlá slosování jsou spočítaná; nevadí, že tiket běží dál. */
  readonly dosudJisty: boolean;
  readonly chybi: number;
  readonly pokracuje: boolean;
  /** Tiket ještě nemá žádné vyhodnocené slosování. */
  readonly cekani: Cekani | null;
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
        <select [value]="typ()" (change)="zmenTyp($any($event.target).value)">
          <option value="vsechny">Všechny</option><option value="papirove">Papírové</option><option value="virtualni">Virtuální</option>
        </select>
      </label>
      <app-filtr-nazvu [hodnota]="nazev()" (zmena)="zmenNazev($event)" />
      <div class="prepinace" aria-label="Seskupení tiketů">
        <button type="button" [attr.aria-pressed]="!seskupit()" (click)="zmenSeskupeni(false)">Podle data</button>
        <button type="button" [attr.aria-pressed]="seskupit()" (click)="zmenSeskupeni(true)">Podle názvu</button>
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
          <li [class.nehotovy]="radek.cekani || !radek.dosudJisty">
            <a [routerLink]="['/tiket', radek.tiket.id]">
              <span class="hra">{{ nazevHry(radek.tiket.hra) }}</span>
              <!-- Semafor: výsledek, který ještě není konečný (čeká, nebo je neúplný), má barvu důrazu
                   i s rámečkem celého tiketu, výhra zeleně, nula tlumeně. Proč se čeká nebo co chybí,
                   říká poznámka dole. -->
              @if (radek.cekani) {
                <span class="vysledek nehotovy">--- Kč</span>
              } @else {
                <span class="vysledek" [class.nehotovy]="!radek.dosudJisty"
                  [class.vyhra]="radek.dosudJisty && radek.castkaKc > 0"
                  [class.nula]="radek.dosudJisty && radek.castkaKc === 0">{{ formatujKc(radek.castkaKc) }}</span>
              }
              @if (radek.tiket.nazev || radek.tiket.kontrola) {
                <span class="stitky">
                  @if (radek.tiket.nazev) { <span class="stitek nazev-tiketu">{{ radek.tiket.nazev }}</span> }
                  @if (radek.tiket.kontrola) { <span class="stitek virtualni">Virtuální</span> }
                </span>
              }
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
              <!-- Úplně vyhodnocený tiket poznámku nemá: hlásí se jen to, co vyžaduje pozornost. -->
              @if (radek.cekani; as c) {
                <span class="poznamka">{{ c.duvod === 'pred-slosovanim' ? 'Slosování od' : 'Slosování' }} {{ formatujDatum(c.od) }}</span>
              } @else if (radek.chybi > 0) {
                <span class="poznamka">Chybí {{ radek.chybi }} slosování</span>
              } @else if (!radek.dosudJisty) {
                <span class="poznamka">Vyhodnocení není konečné</span>
              } @else if (radek.pokracuje) {
                <span class="poznamka">Další slosování ještě přijdou</span>
              }
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
    .prazdno { color: var(--barva-text-tlumeny); }
    .tikety { list-style: none; margin: 0; padding: 0; }
    .tikety li { border: 1px solid var(--barva-ram); border-radius: .85rem; margin: .75rem 0; padding: .5rem .75rem; }
    .tikety li.nehotovy { border-color: var(--barva-duraz); }
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
    .vysledek { text-align: right; font-variant-numeric: tabular-nums; }
    .vysledek.nehotovy { color: var(--barva-duraz); }
    .vysledek.vyhra { color: var(--barva-ok); }
    .vysledek.nula { color: var(--barva-text-tlumeny); }
    /* Pod prvním řádkem už je všechno přes celou šířku. */
    .stitky, .detail, .poznamka { grid-column: 1 / -1; }
    .stitky { display: flex; flex-wrap: wrap; gap: .3rem; margin: .15rem 0; }
    .stitek {
      min-width: 0; padding: 0 0.45rem; border: 1px solid; border-radius: 999px;
      font-size: 0.75rem; font-weight: 600; overflow-wrap: anywhere;
    }
    .nazev-tiketu { color: var(--barva-duraz); }
    .virtualni {
      color: var(--barva-vyhrano); font-size: 0.65rem; text-transform: uppercase;
      letter-spacing: 0.05em; align-self: center;
    }
    .detail, .poznamka { font-size: 0.8rem; color: var(--barva-text-tlumeny); }
  `,
})
export class Seznam {
  private readonly stav = inject(Stav);
  private readonly parametry = inject(ActivatedRoute).snapshot.queryParamMap;
  protected readonly archiv = signal(this.parametry.get('archiv') === '1');
  protected readonly typ = computed(() => this.stav.filtrSeznamu().typ);
  protected readonly seskupit = computed(() => this.stav.filtrSeznamu().seskupit);
  /**
   * Název z odkazu Přehledu platí jen pro tuto návštěvu; uložený filtr nepřepíše, dokud ho
   * uživatel sám nezmění.
   */
  private readonly nazevZOdkazu = signal(this.parametry.get('nazev'));
  /** Klíč z `klicNazvu`. Název, který už žádný tiket nemá, se chová jako všechny názvy. */
  protected readonly nazev = computed(() => {
    const klic = this.nazevZOdkazu() ?? this.stav.filtrSeznamu().nazev;
    return klic === '*' || this.stav.skupinyNazvu().some(s => s.klic === klic) ? klic : '*';
  });

  protected zmenTyp(typ: FiltrSeznamu['typ']): void {
    void this.stav.ulozFiltrSeznamu({ typ });
  }
  protected zmenNazev(nazev: string): void {
    this.nazevZOdkazu.set(null);
    void this.stav.ulozFiltrSeznamu({ nazev });
  }
  protected zmenSeskupeni(seskupit: boolean): void {
    void this.stav.ulozFiltrSeznamu({ seskupit });
  }

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
      + ({ vsechny: '', papirove: ' · Papírové', virtualni: ' · Virtuální' }[this.typ()])
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
        dosudJisty: vysledek.chybejicichSlosovani === 0 && vysledek.slosovani.every(s => s.nejistychVyher === 0),
        chybi: vysledek.chybejicichSlosovani,
        pokracuje: vysledek.pokracuje,
        cekani: cekaniNaSlosovani(tiket, vysledek, dnesniDatum()),
      };
    }),
  );
}
