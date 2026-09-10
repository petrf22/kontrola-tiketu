import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { formatujDatum, formatujDatumCas } from './data/format.js';
import type { StavHry } from './data/stahovani.js';
import { Stav } from './data/stav.js';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly stav = inject(Stav);

  protected readonly formatujDatum = formatujDatum;
  protected readonly formatujDatumCas = formatujDatumCas;

  /** Hry, u kterých server zná tažená čísla, ale Allwyn ještě nezveřejnil tabulku výher. */
  protected readonly cekaNaTabulku = computed(() => {
    const kontrola = this.stav.kontrolaServeru();
    if (kontrola === null) return [];
    const hry: [string, StavHry | null][] = [
      ['Eurojackpot', kontrola.eurojackpot],
      ['Sportka', kontrola.sportka],
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
