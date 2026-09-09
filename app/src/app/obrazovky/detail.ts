import { Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import type { VysledekTiketu, Vyhra } from '@kontrola-tiketu/jadro';
import { Stav } from '../data/stav.js';

const POPIS_VYHRADY: Readonly<Record<string, string>> = {
  'chybi-sazby': 'chybí sazby Extra 6 — naimportuj novější soubor s výsledky',
  'delene-prvni-poradi': 'při více než dvou výhrách se první pořadí dělí, částka je horní odhad',
  'chybi-v-tabulce': 'listina tohle pořadí neuvádí',
};

@Component({
  selector: 'app-detail',
  template: `
    @if (tiket(); as t) {
      <h2>{{ t.hra === 'eurojackpot' ? 'Eurojackpot' : 'Sportka' }}</h2>
      <p class="popis">
        {{ t.sloupce.length }} sloupců, {{ t.slosovani.pocet }} slosování od {{ t.slosovani.prvni }}.
        @if (t.kodDoplnkoveHry) {
          <br />{{ t.hra === 'eurojackpot' ? 'Extra 6' : 'Šance' }}: {{ t.kodDoplnkoveHry }}
        }
      </p>

      @if (vysledek(); as v) {
        <p class="soucet" [class.nejisty]="!v.soucetJisty">
          <strong>{{ v.celkemKc }} Kč</strong>
          @if (!v.soucetJisty) { <span class="hvezda">*</span> }
        </p>

        @if (v.chybejicichSlosovani > 0) {
          <p class="varovani">
            Chybí výsledky {{ v.chybejicichSlosovani }} slosování, takže tohle není konečná
            částka. „Nevyhrál jsi“ a „zatím nevím“ nejsou totéž — doimportuj novější výsledky.
          </p>
        }

        @for (slosovani of v.slosovani; track slosovani.datum) {
          <section>
            <h3>{{ slosovani.datum }}</h3>
            @if (slosovani.vyhry.length === 0) {
              <p class="bez-vyhry">Bez výhry.</p>
            } @else {
              <ul class="vyhry">
                @for (vyhra of slosovani.vyhry; track $index) {
                  <li>
                    <span>{{ popisVyhry(vyhra) }}</span>
                    <span class="castka">
                      {{ vyhra.castkaKc === null ? '?' : vyhra.castkaKc + ' Kč' }}
                    </span>
                    @if (vyhra.vyhrada) {
                      <small class="vyhrada">{{ popisVyhrady(vyhra.vyhrada) }}</small>
                    }
                  </li>
                }
              </ul>
            }
          </section>
        }

        @if (!v.soucetJisty) {
          <p class="poznamka">* Součet není úplný — viz poznámky výše.</p>
        }
      }

      <button type="button" class="smazat" (click)="smaz()">Smazat tiket</button>
    } @else {
      <p>Tiket nenalezen.</p>
    }
  `,
  styles: `
    .popis { color: var(--barva-text-tlumeny); font-size: 0.85rem; }
    .soucet { font-size: 1.6rem; margin: 0.5rem 0; font-variant-numeric: tabular-nums; }
    .soucet.nejisty strong { color: var(--barva-text-tlumeny); }
    .varovani {
      padding: 0.6rem 0.75rem; background: var(--barva-plocha);
      border-left: 3px solid var(--barva-duraz); font-size: 0.85rem;
    }
    section { margin-top: 1.25rem; }
    h3 { margin: 0 0 0.35rem; font-size: 0.95rem; }
    .bez-vyhry { margin: 0; color: var(--barva-text-tlumeny); font-size: 0.85rem; }
    .vyhry { list-style: none; margin: 0; padding: 0; }
    .vyhry li {
      display: grid; grid-template-columns: 1fr auto; gap: 0 1rem;
      padding: 0.35rem 0; border-bottom: 1px solid var(--barva-ram);
    }
    .castka { font-variant-numeric: tabular-nums; }
    .vyhrada { grid-column: 1 / -1; color: var(--barva-text-tlumeny); font-size: 0.75rem; }
    .poznamka { font-size: 0.8rem; color: var(--barva-text-tlumeny); }
    .smazat {
      margin-top: 2rem; padding: 0.45rem 0.8rem; border: 1px solid var(--barva-ram);
      border-radius: 4px; background: transparent; color: var(--barva-chyba);
      font: inherit; cursor: pointer;
    }
  `,
})
export class Detail {
  readonly id = input.required<string>();

  private readonly stav = inject(Stav);
  private readonly router = inject(Router);

  protected readonly tiket = computed(() => this.stav.tikety().find((t) => t.id === this.id()));

  protected readonly vysledek = computed<VysledekTiketu | null>(() => {
    const tiket = this.tiket();
    return tiket === undefined ? null : this.stav.vyhodnot(tiket);
  });

  protected popisVyhry(vyhra: Vyhra): string {
    const casti: string[] = [];
    if (vyhra.zdroj === 'bonus') casti.push('Bonus');
    else if (vyhra.zdroj === 'doplnkova-hra') casti.push('Doplňková hra');
    else casti.push(`Sloupec ${(vyhra.indexSloupce ?? 0) + 1}`);

    if (vyhra.poradiTahu !== null) casti.push(`${vyhra.poradiTahu}. tah`);
    casti.push(`pořadí ${vyhra.poradi}`);
    return casti.join(' · ');
  }

  protected popisVyhrady(vyhrada: string): string {
    return POPIS_VYHRADY[vyhrada] ?? vyhrada;
  }

  protected async smaz(): Promise<void> {
    await this.stav.smazTiket(this.id());
    await this.router.navigate(['/']);
  }
}
