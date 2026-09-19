import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { souhrnBilance, type Hra } from '@kontrola-tiketu/jadro';
import { HRY, nazevHry, formatujKc } from '../data/format.js';
import { Stav } from '../data/stav.js';
import { Kolac } from './kolac.js';

/** `1 tiket`, `3 tikety`, `5 tiketů`. */
function pocetTiketu(pocet: number): string {
  if (pocet === 1) return '1 tiket';
  if (pocet >= 2 && pocet <= 4) return `${pocet} tikety`;
  return `${pocet} tiketů`;
}

/** `u 1 tiketu`, `u 3 tiketů` — po předložce „u“ je druhý pád. */
function uTiketu(pocet: number): string {
  return pocet === 1 ? '1 tiketu' : `${pocet} tiketů`;
}

/**
 * Přehled vsazeného a vyhraného.
 *
 * Aby si hráč uvědomil, kolik prosází: celkem a po hrách, na první pohled. Počítá se jen
 * z uložených tiketů a stažených výsledků na zařízení, nikam nic nejde.
 */
@Component({
  selector: 'app-prehled',
  imports: [Kolac, RouterLink],
  template: `
    <h2>Přehled</h2>
    @if (souhrn().celkem.tiketu === 0) {
      <p class="prazdno">
        Zatím tu nic není. Přehled se spočítá z uložených tiketů —
        <a routerLink="/sken-cisel">vyfoť tiket</a> nebo ho <a routerLink="/tiket/novy">zadej ručně</a>.
      </p>
    } @else {
      <dl class="souhrn-tiketu">
        <div><dt>Vsazeno</dt><dd>{{ formatujKc(souhrn().celkem.vsazenoKc) }}</dd></div>
        <div><dt>Vyhráno</dt><dd>{{ formatujKc(souhrn().celkem.vyhranoKc) }}</dd></div>
        <div><dt>Bilance</dt><dd>{{ formatujKc(souhrn().celkem.vyhranoKc - souhrn().celkem.vsazenoKc) }}</dd></div>
      </dl>
      <p class="tlumene">Včetně archivovaných tiketů.</p>
      @if (souhrn().celkem.nejistych > 0 || souhrn().celkem.tiketuBezCeny > 0) {
        <p class="zprava-akce">Přehled není úplný: některé tikety nemají konečný výsledek nebo známou cenu.</p>
      }
      <details><summary>Grafy podle her</summary>
      <section class="celkem">
        <app-kolac class="velky" nazev="Celkem" [vsazenoKc]="souhrn().celkem.vsazenoKc"
          [vyhranoKc]="souhrn().celkem.vyhranoKc" />
        <p class="pocet">{{ pocetTiketu(souhrn().celkem.tiketu) }}</p>
      </section>

      <div class="hry">
        @for (hra of hrySTikety(); track hra) {
          <section>
            <app-kolac [nazev]="nazevHry(hra)" [vsazenoKc]="souhrn().podleHry[hra].vsazenoKc"
              [vyhranoKc]="souhrn().podleHry[hra].vyhranoKc" />
            <p class="pocet">{{ pocetTiketu(souhrn().podleHry[hra].tiketu) }}</p>
          </section>
        }
      </div>

      </details>
      <ul class="poznamky">
        @if (souhrn().celkem.tiketuBezCeny > 0) {
          <li>
            {{ pocetTiketu(souhrn().celkem.tiketuBezCeny) }} bez ceny — výhry se počítají,
            vsazená částka ne, takže skutečná bilance je horší.
          </li>
        }
        @if (souhrn().celkem.nejistych > 0) {
          <li>
            U {{ uTiketu(souhrn().celkem.nejistych) }}
            součet ještě není konečný — chybí výsledky, kontrola pokračuje, nebo výhra nemá jistou částku.
          </li>
        }
        @if (tiketuSPrekryvem() > 0) {
          <li>
            {{ pocetTiketu(tiketuSPrekryvem()) }} se stejnou sázkou na stejná slosování — ta se
            započítají dvakrát. Podrobnosti jsou v detailu tiketu.
          </li>
        }
        <li>Vyhodnocení je neoficiální. Závazná je vždy kontrola na terminálu Allwyn.</li>
      </ul>
    }
  `,
  styles: `
    .prazdno { color: var(--barva-text-tlumeny); }
    section {
      padding: 0.9rem; border: 1px solid var(--barva-ram); border-radius: 6px;
    }
    .celkem { margin-bottom: 1rem; }
    .hry { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 17rem), 1fr)); gap: 1rem; }
    .pocet { margin: 0.5rem 0 0; font-size: 0.8rem; color: var(--barva-text-tlumeny); }
    .poznamky {
      margin: 1.25rem 0 0; padding-left: 1.1rem;
      font-size: 0.8rem; line-height: 1.5; color: var(--barva-text-tlumeny);
    }
  `,
})
export class Prehled {
  protected readonly formatujKc = formatujKc;
  private readonly stav = inject(Stav);

  protected readonly nazevHry = nazevHry;
  protected readonly pocetTiketu = pocetTiketu;
  protected readonly uTiketu = uTiketu;

  protected readonly souhrn = computed(() => souhrnBilance(this.stav.tikety(), this.stav.vysledky()));

  /** Hra bez tiketů by ukazovala prázdný koláč, který nic neříká. */
  protected readonly hrySTikety = computed<readonly Hra[]>(() =>
    HRY.filter((hra) => this.souhrn().podleHry[hra].tiketu > 0),
  );

  protected readonly tiketuSPrekryvem = computed(() => this.stav.prekryvy().size);
}
