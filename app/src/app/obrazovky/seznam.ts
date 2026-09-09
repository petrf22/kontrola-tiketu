import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Stav } from '../data/stav.js';
import type { Tiket } from '@kontrola-tiketu/jadro';

interface RadekSeznamu {
  readonly tiket: Tiket;
  readonly castkaKc: number;
  readonly jisty: boolean;
  readonly chybi: number;
}

@Component({
  selector: 'app-seznam',
  imports: [RouterLink],
  template: `
    @if (radky().length === 0) {
      <p class="prazdno">
        Zatím tu nic není. Založ tiket ručně, nebo ho naskenuj.
        <a routerLink="/tiket/novy">Nový tiket</a>
      </p>
    } @else {
      <ul class="tikety">
        @for (radek of radky(); track radek.tiket.id) {
          <li>
            <a [routerLink]="['/tiket', radek.tiket.id]">
              <span class="hra">{{ radek.tiket.hra === 'eurojackpot' ? 'Eurojackpot' : 'Sportka' }}</span>
              <span class="detail">
                {{ radek.tiket.sloupce.length }}&nbsp;sl. &middot; od {{ radek.tiket.slosovani.prvni }}
                &middot; {{ radek.tiket.slosovani.pocet }}&nbsp;slos.
              </span>
              <span class="castka" [class.nejisty]="!radek.jisty">
                @if (radek.chybi > 0) {
                  chybí {{ radek.chybi }} slos.
                } @else if (radek.castkaKc > 0) {
                  {{ radek.castkaKc }} Kč
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
    .detail { grid-column: 1; font-size: 0.8rem; color: var(--barva-text-tlumeny); }
    .castka { grid-row: 1 / span 2; align-self: center; font-variant-numeric: tabular-nums; }
    .castka.nejisty { color: var(--barva-text-tlumeny); }
  `,
})
export class Seznam {
  private readonly stav = inject(Stav);

  protected readonly radky = computed<RadekSeznamu[]>(() =>
    this.stav.tikety().map((tiket) => {
      const vysledek = this.stav.vyhodnot(tiket);
      return {
        tiket,
        castkaKc: vysledek.celkemKc,
        jisty: vysledek.soucetJisty,
        chybi: vysledek.chybejicichSlosovani,
      };
    }),
  );
}
