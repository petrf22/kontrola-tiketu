import { Component, inject, signal, type OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { Hra } from '@kontrola-tiketu/jadro';
import type { VysledekCteni } from '@kontrola-tiketu/ocr';
import { HRY, nazevHry } from '../data/format.js';
import { NactenaCisla, NaskenovanyTiket } from '../data/sken.js';
import { nactiTiketZeSnimku, type VysledekSnimku } from '../data/snimekTiketu.js';
import { zavislostiCapacitor, zavislostiGalerie } from '../data/snimekTiketu-capacitor.js';
import { maTrvaleUloziste } from '../data/tokeny.js';

/**
 * Vyfocení tiketu a rozpoznání čísel.
 *
 * Snímek se ukládá do privátní cache aplikace a hned se maže — vědomá odchylka od původního
 * zadání, popsaná v docs/ocr-a-carovy-kod.md. Do galerie se nikdy nedostane.
 *
 * Výsledek je vždy jen návrh. Uživatel čísla potvrzuje ve formuláři, kde je může opravit.
 *
 * Tatáž obrazovka slouží i pro „Vložit z obrázku“ (`data.zdroj === 'galerie'`): snímek se
 * místo focení vybere z galerie a dál je postup stejný. Liší se jen texty.
 */
@Component({
  selector: 'app-sken-cisel',
  imports: [RouterLink],
  template: `
    <a class="zpet" routerLink="/pridat">← Přidat tiket</a>
    <h2>{{ zGalerie ? 'Vložit z obrázku' : 'Vyfotit tiket' }}</h2>
    @if (!naZarizeni) {
      <p class="poznamka">
        {{ zGalerie ? 'Čtení obrázku' : 'Focení' }} funguje jen v aplikaci na telefonu. V prohlížeči zadej čísla ručně.
      </p>
    } @else if (zGalerie) {
      <p class="poznamka">
        Vyber fotku nebo sken celého tiketu — čísla, řádek s doplňkovou hrou i čárový kód dole.
        Aplikace uvidí jen vybraný obrázek, přečte ho z dočasné kopie, kterou hned smaže,
        a originál nechá, kde je. Rozpoznané údaje pak potvrdíš ve formuláři.
      </p>
    } @else {
      <p class="poznamka">
        Vyfoť celý tiket — čísla, řádek s doplňkovou hrou i čárový kód dole. Z jedné fotky se
        přečte všechno najednou. Snímek se po rozpoznání smaže a do galerie se neuloží;
        rozpoznané údaje pak potvrdíš ve formuláři.
      </p>
      <p class="poznamka">
        Nejlépe se čte tiket položený rovně na tmavé podložce, bez odlesku a přes celou fotku.
      </p>

      <!--
        Hru aplikace pozná sama — z čárového kódu, popisku doplňkové hry, loga a hlavičky.
        Když si jistá není, zeptá se až po fotce a přečte tentýž snímek znovu. Nutit uživatele
        volit hru předem by byl krok navíc, který skoro vždycky nic nepřidá.
      -->
    }
    @if (naZarizeni) {
      @if (nejistaHra()) {
        <p>Z fotky nepoznám, o jakou hru jde. Je to:</p>
        <div class="volby">
          @for (h of hry; track h) {
            <button type="button" (click)="zvolHru(h)">{{ nazevHry(h) }}</button>
          }
          <button type="button" class="vedlejsi" (click)="vyfot()">{{ znovu }}</button>
        </div>
      } @else {
        <div class="volby">
          <button type="button" [disabled]="pracuje()" (click)="vyfot()">
            <!-- Fotoaparát se otevírá sám při příchodu, takže tlačítko je vždy až další pokus. -->
            @if (pracuje()) { Rozpoznávám… } @else { {{ znovu }} }
          </button>
        </div>
      }
    }

    @if (chyba(); as text) {
      <p class="chyba">{{ text }}</p>
    }
    <p><a class="zpet" routerLink="/tiket/novy">Zadat čísla ručně</a></p>
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
    .vedlejsi { color: var(--barva-text-tlumeny); }
  `,
})
export class SkenCisel implements OnInit {
  private readonly router = inject(Router);
  private readonly nactena = inject(NactenaCisla);
  private readonly naskenovany = inject(NaskenovanyTiket);
  protected readonly zGalerie = inject(ActivatedRoute).snapshot.data['zdroj'] === 'galerie';
  private readonly zavislosti = this.zGalerie ? zavislostiGalerie : zavislostiCapacitor;
  protected readonly znovu = this.zGalerie ? 'Vybrat jiný obrázek' : 'Vyfotit znovu';

  protected readonly naZarizeni = maTrvaleUloziste();
  protected readonly hry = HRY;
  protected readonly nazevHry = nazevHry;
  protected readonly pracuje = signal(false);
  protected readonly chyba = signal<string | null>(null);
  /**
   * Snímek, u kterého se hra nepoznala. Drží jen rozpoznaný text v paměti — soubor je
   * smazaný — a zahodí se volbou hry, dalším focením nebo odchodem z obrazovky.
   */
  protected readonly nejistaHra = signal<VysledekSnimku | null>(null);

  ngOnInit(): void {
    // Volba „Vyfotit tiket“ či „Vložit z obrázku“ už padla v nabídce; další potvrzení není potřeba.
    if (this.naZarizeni) void this.vyfot();
  }

  protected async vyfot(): Promise<void> {
    if (this.pracuje()) return;
    this.chyba.set(null);
    this.nejistaHra.set(null);
    this.pracuje.set(true);
    try {
      const snimek = await nactiTiketZeSnimku(this.zavislosti);
      if (!snimek.maSloupce) {
        this.chyba.set(this.zGalerie
          ? 'Na obrázku se nepodařilo najít žádný sloupec. Zkus jiný obrázek, nebo zadej čísla ručně.'
          : 'Na snímku se nepodařilo najít žádný sloupec. Zkus lepší světlo, nebo zadej čísla ručně.');
        return;
      }
      if (snimek.cteni === null) {
        this.nejistaHra.set(snimek);
        return;
      }
      await this.pokracuj(snimek, snimek.cteni, snimek.hra.podle);
    } catch (potiz) {
      this.chyba.set(potiz instanceof Error ? potiz.message : String(potiz));
    } finally {
      this.pracuje.set(false);
    }
  }

  protected async zvolHru(hra: Hra): Promise<void> {
    const snimek = this.nejistaHra();
    if (snimek === null) return;
    this.nejistaHra.set(null);
    await this.pokracuj(snimek, snimek.prectiJako(hra), ['zvoleno ručně']);
  }

  private async pokracuj(
    snimek: VysledekSnimku,
    cteni: VysledekCteni,
    hraPodle: readonly string[],
  ): Promise<void> {
    // Kód bývá na tiketu hned pod čísly, takže ho jedna fotka zachytí spolu s nimi.
    // Když se nenajde, nevadí — uživatel ho může doskenovat zvlášť.
    if (snimek.serioveCislo !== null) this.naskenovany.uloz(snimek.serioveCislo, cteni.hra);
    this.nactena.uloz(cteni, hraPodle);
    // Snímání se v historii nahradí formulářem. Jinak by Zpět z formuláře vrátilo sem
    // a obrazovka by fotoaparát hned otevřela znovu.
    await this.router.navigate(['/tiket/novy'], { replaceUrl: true });
  }
}
