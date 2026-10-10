import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Oznameni } from '../data/oznameni.js';

@Component({
  selector: 'app-nastaveni',
  imports: [RouterLink],
  template: `
    <a class="zpet" routerLink="/dalsi">← Další</a>
    <h2>Nastavení</h2>
    <label><input type="checkbox" [checked]="oznameni.dialog()" [disabled]="uklada()" (change)="zmen($event)" /> Výhry zobrazovat v dialogu</label>
    <p class="tlumene">Po vypnutí se nové výsledky včetně výher zobrazí pouze v horním panelu. Zůstanou dostupné do označení jako přečtené, i po opětovném spuštění aplikace.</p>
    @if (oznameni.chyba(); as chyba) { <p class="chyba-akce" role="alert">{{ chyba }}</p> }
    @if (ulozeno()) { <p class="zprava-akce" role="status">Nastavení bylo uloženo.</p> }
  `,
  styles: `label { display: flex; gap: .75rem; align-items: center; min-height: 48px; } input { flex: none; }`,
})
export class Nastaveni {
  protected readonly oznameni = inject(Oznameni);
  protected readonly uklada = signal(false);
  protected readonly ulozeno = signal(false);
  protected async zmen(e: Event): Promise<void> {
    const pole = e.target as HTMLInputElement;
    this.uklada.set(true);
    this.ulozeno.set(false);
    const ok = await this.oznameni.nastavDialog(pole.checked);
    pole.checked = this.oznameni.dialog();
    this.ulozeno.set(ok);
    this.uklada.set(false);
  }
}
