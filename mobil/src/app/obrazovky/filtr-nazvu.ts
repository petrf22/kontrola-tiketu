import { Component, inject, input, output } from '@angular/core';
import { Stav } from '../data/stav.js';

@Component({
  selector: 'app-filtr-nazvu',
  template: `
    <label>Název tiketu
      <select name="filtr-nazvu" (change)="zmena.emit($any($event.target).value)">
        <option value="*" [selected]="hodnota() === '*'">Všechny názvy</option>
        @for (skupina of stav.skupinyNazvu(); track skupina.klic) {
          <option [value]="skupina.klic" [selected]="skupina.klic === hodnota()">{{ skupina.nazev }}</option>
        }
      </select>
    </label>
  `,
  styles: `label { display: flex; align-items: center; flex-wrap: wrap; gap: .75rem; margin: 1rem 0; } select { min-width: 0; max-width: 100%; }`,
})
export class FiltrNazvu {
  protected readonly stav = inject(Stav);
  readonly hodnota = input('*');
  readonly zmena = output<string>();
}
