import { Component, inject, input, output } from '@angular/core';
import { Stav } from '../data/stav.js';

@Component({
  selector: 'app-nazev-tiketu',
  template: `
    <label>Název tiketu (nepovinný)
      <input name="nazev" type="text" list="nazvy-tiketu" autocomplete="off"
        placeholder="Např. kolega nebo práce" [value]="hodnota()"
        (input)="zmena.emit($any($event.target).value)" aria-describedby="napoveda-nazvu" />
    </label>
    <datalist id="nazvy-tiketu">
      @for (skupina of stav.skupinyNazvu(); track skupina.klic) {
        @if (skupina.klic !== '') { <option [value]="skupina.nazev"></option> }
      }
    </datalist>
    <p id="napoveda-nazvu" class="tlumene">Stejný název seskupí tikety napříč hrami i v přehledu. Prázdné pole znamená bez názvu.</p>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    label { display: block; font-size: .85rem; }
    input { width: 100%; min-width: 0; margin-top: .2rem; padding: .45rem;
      border: 1px solid var(--barva-ram); border-radius: 4px;
      background: var(--barva-plocha); color: inherit; font: inherit; }
    p { margin: .4rem 0 0; font-size: .8rem; }
  `,
})
export class NazevTiketu {
  protected readonly stav = inject(Stav);
  readonly hodnota = input('');
  readonly zmena = output<string>();
}
