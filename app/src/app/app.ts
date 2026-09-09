import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { formatujDatum } from './data/format.js';
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

  constructor() {
    void this.stav.nacti();
  }
}
