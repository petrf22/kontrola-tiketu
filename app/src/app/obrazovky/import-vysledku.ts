import { Component, inject, signal } from '@angular/core';
import { Stav } from '../data/stav.js';

@Component({
  selector: 'app-import-vysledku',
  template: `
    <p>
      Výsledky losování se do aplikace dostávají jedině souborem. Aplikace nemá oprávnění
      k síti, takže si je sama stáhnout nemůže — a nikdo se tak nedozví, které tikety držíš.
    </p>
    <p class="postup">
      Soubor vyrobíš na počítači fetcherem:
      <code>npm run vyherka -- stahni --od 2026-35 --do 2026-37</code> a pak
      <code>npm run vyherka -- preparsuj --out vysledky.json</code>
    </p>

    <label class="vyber">
      <input type="file" accept="application/json,.json" (change)="vyber($event)" />
    </label>

    @if (zprava(); as z) {
      <p class="zprava" [class.chyba]="!uspech()">{{ z }}</p>
    }

    @if (stav.tahy().length > 0) {
      <p class="souhrn">V aplikaci je {{ stav.tahy().length }} tahů, poslední z {{ stav.vysledkyDo() }}.</p>
    }
  `,
  styles: `
    .postup { font-size: 0.85rem; color: var(--barva-text-tlumeny); }
    code { display: block; margin: 0.25rem 0; word-break: break-all; }
    .vyber { display: block; margin: 1.25rem 0; }
    .zprava { padding: 0.6rem 0.75rem; background: var(--barva-plocha); border-left: 3px solid var(--barva-ok); }
    .zprava.chyba { border-left-color: var(--barva-chyba); }
    .souhrn { font-size: 0.85rem; color: var(--barva-text-tlumeny); }
  `,
})
export class ImportVysledku {
  protected readonly stav = inject(Stav);
  protected readonly zprava = signal<string | null>(null);
  protected readonly uspech = signal(true);

  protected async vyber(udalost: Event): Promise<void> {
    const vstup = udalost.target as HTMLInputElement;
    const soubor = vstup.files?.[0];
    if (soubor === undefined) return;

    const vysledek = await this.stav.importuj(await soubor.text());
    this.uspech.set(vysledek.uspech);
    this.zprava.set(vysledek.zprava);
    vstup.value = '';
  }
}
