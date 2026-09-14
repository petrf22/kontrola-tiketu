import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatujDatum, formatujKc, nazevHry } from '../data/format.js';
import { Stav } from '../data/stav.js';
import type { Tiket } from '@kontrola-tiketu/jadro';

interface RadekSeznamu {
  readonly tiket: Tiket;
  readonly castkaKc: number;
  readonly jisty: boolean;
  readonly chybi: number;
  readonly pokracuje: boolean;
}

@Component({
  selector: 'app-seznam',
  imports: [RouterLink],
  template: `
    @if (radky().length === 0) {
      <p class="prazdno">
        Zatím tu nic není. Vyfoť tiket, nebo ho zadej ručně.
        <a routerLink="/sken-cisel">Vyfotit tiket</a>
      </p>
    } @else {
      <ul class="tikety">
        @for (radek of radky(); track radek.tiket.id) {
          <li>
            <a [routerLink]="['/tiket', radek.tiket.id]">
              <span class="hra">
                {{ nazevHry(radek.tiket.hra) }}
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
                @if (radek.chybi > 0) {
                  chybí {{ radek.chybi }} slos.
                } @else if (radek.castkaKc > 0) {
                  {{ formatujKc(radek.castkaKc) }}
                } @else if (radek.pokracuje) {
                  zatím bez výhry
                } @else {
                  bez výhry
                }
              </span>
            </a>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .prazdno { color: var(--barva-text-tlumeny); }
    .tikety { list-style: none; margin: 0; padding: 0; }
    .tikety li { border-bottom: 1px solid var(--barva-ram); }
    .tikety a {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 0.15rem 1rem;
      padding: 0.75rem 0.25rem;
      color: inherit;
      text-decoration: none;
    }
    .hra { font-weight: 600; }
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

  protected readonly formatujDatum = formatujDatum;
  protected readonly formatujKc = formatujKc;
  protected readonly nazevHry = nazevHry;

  protected readonly radky = computed<RadekSeznamu[]>(() =>
    this.stav.tikety().map((tiket) => {
      const vysledek = this.stav.vysledky().get(tiket.id) ?? this.stav.vyhodnot(tiket);
      return {
        tiket,
        castkaKc: vysledek.celkemKc,
        jisty: vysledek.soucetJisty,
        chybi: vysledek.chybejicichSlosovani,
        pokracuje: vysledek.pokracuje,
      };
    }),
  );
}
