import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { Hra } from '@kontrola-tiketu/jadro';
import { NactenaCisla, NaskenovanyTiket } from '../data/sken.js';
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
        Vyfoť celý tiket — čísla, řádek s doplňkovou hrou i čárový kód dole. Z jedné fotky se
        přečte všechno najednou. Snímek se po rozpoznání smaže a do galerie se neuloží;
        rozpoznané údaje pak potvrdíš ve formuláři.
      </p>

      <!--
        Volba hry a spuštění focení jsou jedno gesto. Uživatel drží konkrétní tiket, takže
        vybírat hru a pak ještě mačkat „vyfotit“ je krok navíc bez užitku.
      -->
      <div class="volby">
        <button type="button" [disabled]="pracuje()" (click)="vyfot('eurojackpot')">
          @if (pracuje() === 'eurojackpot') { Rozpoznávám… } @else { Vyfotit Eurojackpot }
        </button>
        <button type="button" [disabled]="pracuje()" (click)="vyfot('sportka')">
          @if (pracuje() === 'sportka') { Rozpoznávám… } @else { Vyfotit Sportku }
        </button>
      </div>
    }

    @if (chyba(); as text) {
      <p class="chyba">{{ text }}</p>
    }
  `,
  styles: `
    .poznamka { color: var(--barva-text-tlumeny); font-size: 0.9rem; }
    .chyba { color: var(--barva-chyba); }
    .volby { display: flex; flex-direction: column; gap: 0.6rem; margin-top: 1.25rem; }
    button {
      padding: 0.85rem 1rem; border: 1px solid var(--barva-ram); border-radius: 6px;
      background: var(--barva-plocha); color: inherit; font: inherit; font-size: 1rem;
      cursor: pointer; text-align: center;
    }
    button:disabled { opacity: 0.5; cursor: default; }
  `,
})
export class SkenCisel {
  private readonly router = inject(Router);
  private readonly nactena = inject(NactenaCisla);
  private readonly naskenovany = inject(NaskenovanyTiket);

  protected readonly naZarizeni = maTrvaleUloziste();
  /** Která hra se právě rozpoznává; `null`, když se nic neděje. */
  protected readonly pracuje = signal<Hra | null>(null);
  protected readonly chyba = signal<string | null>(null);

  protected async vyfot(hra: Hra): Promise<void> {
    this.chyba.set(null);
    this.pracuje.set(hra);
    try {
      const { cteni, serioveCislo } = await nactiTiketZeSnimku(hra, zavislostiCapacitor);
      if (cteni.sloupce.length === 0) {
        this.chyba.set('Na snímku se nepodařilo najít žádný sloupec. Zkus lepší světlo, nebo zadej čísla ručně.');
        return;
      }
      // Kód bývá na tiketu hned pod čísly, takže ho jedna fotka zachytí spolu s nimi.
      // Když se nenajde, nevadí — uživatel ho může doskenovat zvlášť.
      if (serioveCislo !== null) this.naskenovany.uloz(serioveCislo);
      this.nactena.uloz(cteni);
      await this.router.navigate(['/tiket/novy']);
    } catch (potiz) {
      this.chyba.set(potiz instanceof Error ? potiz.message : String(potiz));
    } finally {
      this.pracuje.set(null);
    }
  }
}
