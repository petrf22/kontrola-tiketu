import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { Hra } from '@kontrola-tiketu/jadro';
import { NactenaCisla } from '../data/sken.js';
import { nactiTiketZeSnimku } from '../data/snimekTiketu.js';
import { zavislostiCapacitor } from '../data/snimekTiketu-capacitor.js';
import { maTrvaleUloziste } from '../data/tokeny.js';

/**
 * Vyfocení tiketu a rozpoznání čísel.
 *
 * Snímek se ukládá do privátní cache aplikace a hned se maže — vědomá odchylka od původního
 * zadání, popsaná v docs/ocr-a-carovy-kod.md. Do galerie se nikdy nedostane.
 *
 * Výsledek je vždy jen návrh. Uživatel čísla potvrzuje ve formuláři, kde je může opravit.
 */
@Component({
  selector: 'app-sken-cisel',
  template: `
    @if (!naZarizeni) {
      <p class="poznamka">Focení funguje jen v aplikaci na telefonu. V prohlížeči zadej čísla ručně.</p>
    } @else {
      <p class="poznamka">
        Vyfoť tiket tak, aby byly vidět všechny sloupce. Snímek se po rozpoznání smaže a do
        galerie se neuloží. Rozpoznaná čísla pak potvrdíš ve formuláři.
      </p>

      <fieldset>
        <legend>Hra</legend>
        <label><input type="radio" name="hra" [checked]="hra() === 'eurojackpot'"
          (change)="hra.set('eurojackpot')" /> Eurojackpot</label>
        <label><input type="radio" name="hra" [checked]="hra() === 'sportka'"
          (change)="hra.set('sportka')" /> Sportka</label>
      </fieldset>

      <button type="button" [disabled]="pracuje()" (click)="vyfot()">
        {{ pracuje() ? 'Rozpoznávám…' : 'Vyfotit tiket' }}
      </button>
    }

    @if (chyba(); as text) {
      <p class="chyba">{{ text }}</p>
    }
  `,
  styles: `
    .poznamka { color: var(--barva-text-tlumeny); font-size: 0.9rem; }
    .chyba { color: var(--barva-chyba); }
    fieldset { border: 1px solid var(--barva-ram); margin: 1rem 0; }
    label { display: block; font-size: 0.9rem; }
    button {
      padding: 0.5rem 0.9rem; border: 1px solid var(--barva-ram); border-radius: 4px;
      background: var(--barva-plocha); color: inherit; font: inherit; cursor: pointer;
    }
    button:disabled { opacity: 0.5; }
  `,
})
export class SkenCisel {
  private readonly router = inject(Router);
  private readonly nactena = inject(NactenaCisla);

  protected readonly naZarizeni = maTrvaleUloziste();
  protected readonly hra = signal<Hra>('eurojackpot');
  protected readonly pracuje = signal(false);
  protected readonly chyba = signal<string | null>(null);

  protected async vyfot(): Promise<void> {
    this.chyba.set(null);
    this.pracuje.set(true);
    try {
      const { cteni } = await nactiTiketZeSnimku(this.hra(), zavislostiCapacitor);
      if (cteni.sloupce.length === 0) {
        this.chyba.set('Na snímku se nepodařilo najít žádný sloupec. Zkus lepší světlo, nebo zadej čísla ručně.');
        return;
      }
      this.nactena.uloz(cteni);
      await this.router.navigate(['/tiket/novy']);
    } catch (potiz) {
      this.chyba.set(potiz instanceof Error ? potiz.message : String(potiz));
    } finally {
      this.pracuje.set(false);
    }
  }
}
