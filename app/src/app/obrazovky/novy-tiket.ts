import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  ROZSAHY,
  zkontrolujTiket,
  type Hra,
  type Sloupec,
  type Tiket,
} from '@kontrola-tiketu/jadro';
import { prectiCisla } from '@kontrola-tiketu/ocr';
import { NaskenovanyTiket } from '../data/sken.js';
import { Stav } from '../data/stav.js';

interface Radek {
  cisla: string;
  eurocisla: string;
}

/**
 * Ruční zadání tiketu.
 *
 * Zadání žádá, aby ruční zadání bylo plnohodnotná alternativa skenu, ne nouzovka. Proto je
 * to samostatná obrazovka dostupná z hlavní nabídky, ne až záchrana po nepovedeném skenu.
 * Stejný formulář poslouží i pro potvrzení naOCRovaných čísel.
 */
@Component({
  selector: 'app-novy-tiket',
  template: `
    <form (submit)="uloz($event)">
      <fieldset>
        <legend>Hra</legend>
        <label><input type="radio" name="hra" value="eurojackpot"
          [checked]="hra() === 'eurojackpot'" (change)="zmenHru('eurojackpot')" /> Eurojackpot</label>
        <label><input type="radio" name="hra" value="sportka"
          [checked]="hra() === 'sportka'" (change)="zmenHru('sportka')" /> Sportka</label>
      </fieldset>

      <div class="dvojice">
        <label>První slosování
          <input type="date" [value]="prvni()" (input)="prvni.set($any($event.target).value)" required />
        </label>
        <label>Počet slosování
          <input type="number" min="1" max="52" [value]="pocet()"
            (input)="pocet.set(+$any($event.target).value)" required />
        </label>
      </div>

      <label>{{ hra() === 'eurojackpot' ? 'Extra 6' : 'Šance' }} — šest číslic (nepovinné)
        <input type="text" inputmode="numeric" maxlength="6" placeholder="např. 236412"
          [value]="doplnkova()" (input)="doplnkova.set($any($event.target).value)" />
      </label>

      <h2>Sloupce</h2>
      @for (radek of radky(); track $index) {
        <div class="sloupec">
          <span class="poradi">{{ $index + 1 }}.</span>
          <input type="text" inputmode="numeric" [value]="radek.cisla"
            [attr.aria-label]="'Čísla sloupce ' + ($index + 1)"
            [placeholder]="hra() === 'eurojackpot' ? '5 čísel z 1–50' : '6 čísel z 1–49'"
            (input)="zmenCisla($index, $any($event.target).value)" />
          @if (hra() === 'eurojackpot') {
            <input type="text" inputmode="numeric" class="euro" [value]="radek.eurocisla"
              aria-label="Euročísla" placeholder="2 z 1–12"
              (input)="zmenEuro($index, $any($event.target).value)" />
          }
          @if (radky().length > 1) {
            <button type="button" class="odebrat" (click)="odeber($index)" aria-label="Odebrat sloupec">×</button>
          }
        </div>
      }
      <button type="button" class="pridat" (click)="pridej()">Přidat sloupec</button>

      @if (problemy().length > 0) {
        <ul class="problemy">
          @for (problem of problemy(); track problem.cesta + problem.kod) {
            <li>{{ problem.zprava }}</li>
          }
        </ul>
      }

      <button type="submit" class="ulozit" [disabled]="problemy().length > 0">Uložit tiket</button>
    </form>
  `,
  styles: `
    form { display: grid; gap: 1rem; }
    fieldset { border: 1px solid var(--barva-ram); }
    label { display: block; font-size: 0.85rem; }
    input[type='text'], input[type='date'], input[type='number'] {
      width: 100%; padding: 0.45rem; margin-top: 0.2rem;
      border: 1px solid var(--barva-ram); border-radius: 4px;
      background: var(--barva-plocha); color: inherit; font: inherit;
    }
    .dvojice { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    h2 { margin: 0.5rem 0 0; font-size: 1rem; }
    .sloupec { display: flex; gap: 0.4rem; align-items: center; }
    .poradi { width: 1.5rem; color: var(--barva-text-tlumeny); font-variant-numeric: tabular-nums; }
    .euro { max-width: 8rem; }
    .odebrat, .pridat, .ulozit {
      padding: 0.45rem 0.8rem; border: 1px solid var(--barva-ram); border-radius: 4px;
      background: var(--barva-plocha); color: inherit; font: inherit; cursor: pointer;
    }
    .ulozit { background: var(--barva-duraz); color: #fff; border-color: transparent; }
    .ulozit:disabled { opacity: 0.45; cursor: not-allowed; }
    .problemy { margin: 0; padding-left: 1.1rem; color: var(--barva-chyba); font-size: 0.85rem; }
  `,
})
export class NovyTiket {
  private readonly stav = inject(Stav);
  private readonly router = inject(Router);

  /** Sériové číslo z naskenovaného čárového kódu, pokud uživatel přišel ze skenu. */
  private readonly serioveCislo = inject(NaskenovanyTiket).vyzvedni();

  protected readonly hra = signal<Hra>('eurojackpot');
  protected readonly prvni = signal(new Date().toISOString().slice(0, 10));
  protected readonly pocet = signal(1);
  protected readonly doplnkova = signal('');
  protected readonly radky = signal<Radek[]>([{ cisla: '', eurocisla: '' }]);

  protected readonly navrh = computed<Tiket>(() => {
    const hra = this.hra();
    const sloupce: Sloupec[] = this.radky().map((radek) =>
      hra === 'eurojackpot'
        ? {
            hra,
            cisla: prectiCisla(radek.cisla).map((c) => c.hodnota),
            eurocisla: prectiCisla(radek.eurocisla).map((c) => c.hodnota),
          }
        : { hra, cisla: prectiCisla(radek.cisla).map((c) => c.hodnota) },
    );

    return {
      // Sériové číslo z kódu je nejlepší identifikátor — díky němu druhý sken téhož tiketu
      // nevytvoří duplicitu. Ručně zadaný tiket ho nemá, tak si vyrobí vlastní.
      id:
        this.serioveCislo ??
        `rucni-${this.prvni()}-${sloupce.map((s) => s.cisla.join('.')).join('_')}`,
      hra,
      sloupce,
      slosovani: { prvni: this.prvni(), pocet: this.pocet(), dny: null },
      kodDoplnkoveHry: this.doplnkova().trim() === '' ? null : this.doplnkova().trim(),
      vlozeno: new Date().toISOString(),
    };
  });

  protected readonly problemy = computed(() => zkontrolujTiket(this.navrh()));

  protected zmenHru(hra: Hra): void {
    this.hra.set(hra);
  }

  protected zmenCisla(index: number, hodnota: string): void {
    this.radky.update((r) => r.map((radek, i) => (i === index ? { ...radek, cisla: hodnota } : radek)));
  }

  protected zmenEuro(index: number, hodnota: string): void {
    this.radky.update((r) =>
      r.map((radek, i) => (i === index ? { ...radek, eurocisla: hodnota } : radek)),
    );
  }

  protected pridej(): void {
    const nejvic = this.hra() === 'eurojackpot' ? 6 : ROZSAHY.sportka.cisla.pocet + 4;
    if (this.radky().length >= nejvic) return;
    this.radky.update((r) => [...r, { cisla: '', eurocisla: '' }]);
  }

  protected odeber(index: number): void {
    this.radky.update((r) => r.filter((_, i) => i !== index));
  }

  protected async uloz(udalost: Event): Promise<void> {
    udalost.preventDefault();
    if (this.problemy().length > 0) return;
    const tiket = this.navrh();
    await this.stav.ulozTiket(tiket);
    await this.router.navigate(['/tiket', tiket.id]);
  }
}
