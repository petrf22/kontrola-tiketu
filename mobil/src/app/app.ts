import { Component, computed, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { formatujDatum, formatujDatumCas, nazevHry } from './data/format.js';
import type { StavHry } from './data/stahovani.js';
import { Stav } from './data/stav.js';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly router = inject(Router);
  private readonly adresa = toSignal(this.router.events.pipe(
    filter((e): e is NavigationEnd => e instanceof NavigationEnd), map(e => e.urlAfterRedirects),
  ), { initialValue: this.router.url });
  protected readonly sekce = computed(() => {
    const url = this.adresa().split('?')[0] ?? '/';
    return url === '/prehled' ? 'prehled' : ['/dalsi', '/import', '/o-aplikaci'].includes(url) ? 'dalsi' : 'tikety';
  });
  protected readonly stav = inject(Stav);

  protected readonly formatujDatum = formatujDatum;
  protected readonly formatujDatumCas = formatujDatumCas;

  /** Hry, u kterých server zná tažená čísla, ale Allwyn ještě nezveřejnil tabulku výher. */
  protected readonly cekaNaTabulku = computed(() => {
    const kontrola = this.stav.kontrolaServeru();
    if (kontrola === null) return [];
    const hry: [string, StavHry | null][] = [
      [nazevHry('eurojackpot'), kontrola.eurojackpot],
      [nazevHry('sportka'), kontrola.sportka],
      [nazevHry('euromiliony'), kontrola.euromiliony],
    ];
    return hry.flatMap(([nazev, hra]) =>
      hra !== null && !hra.uplny ? [`${nazev} ${formatujDatum(hra.posledniTah)}`] : [],
    );
  });

  constructor() {
    // Po otevření se výsledky rovnou stáhnou — uživatel chce vidět, jestli už kontrola
    // proběhla, ne hledat tlačítko. Bez sítě se nic nestane, jen zůstanou dosavadní.
    void this.stav.nacti().then(() => this.stav.stahniVysledky());
  }
}
