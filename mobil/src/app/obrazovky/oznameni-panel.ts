import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { NavigationCancel, NavigationError, NavigationEnd, NavigationStart, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Oznameni, type OznameniVysledku } from '../data/oznameni.js';
import { Stav } from '../data/stav.js';
import { formatujDatum, formatujKc, nazevHry } from '../data/format.js';
import { Dialog, Dialogy } from './dialog.js';

@Component({
  selector: 'app-oznameni-panel',
  imports: [Dialog, NgTemplateOutlet],
  template: `
    @if (!skryto()) {
      @if (oznameni.neprectene().length > 0) {
        <section class="panel" aria-label="Nové výsledky">
          <div class="zahlavi">
            <strong role="status">{{ maVyhru() ? 'Nová výhra nebo výherní shoda' : 'Nové výsledky tiketů' }} ({{ oznameni.neprectene().length }})</strong>
            <button type="button" [attr.aria-expanded]="rozbaleno()" aria-controls="nove-vysledky" (click)="rozbaleno.set(!rozbaleno())">{{ rozbaleno() ? 'Sbalit' : 'Zobrazit' }}</button>
          </div>
          @if (rozbaleno()) {
            <div id="nove-vysledky" class="polozky">
              <ng-container *ngTemplateOutlet="polozky; context: { $implicit: oznameni.neprectene() }" />
            </div>
            <button type="button" [disabled]="pracuje()" (click)="potvrd(oznameni.neprectene())">Označit jako přečtené</button>
          }
        </section>
      }
      @if (stav.posledniStazeni(); as z) {
        @if (!z.uspech && !stav.stahuje()) {
          <div class="panel varovani" role="status">
            <span>Výsledky se nepodařilo aktualizovat. Zobrazuji uložené výsledky.</span>
            <button type="button" (click)="stav.stahniVysledky()">Zkusit znovu</button>
          </div>
        }
      }
      @if (oznameni.chyba(); as chyba) {
        <div class="chyba-akce" role="alert">{{ chyba }}
          <button type="button" [disabled]="pracuje()" (click)="obnov()">Zkusit uložit upozornění znovu</button>
        </div>
      }
    }
    <app-dialog #dialog nadpis="Nové výherní výsledky" [pracuje]="pracuje()" (zavreno)="zobrazeno.set([])">
      <ng-container *ngTemplateOutlet="polozky; context: { $implicit: zobrazeno() }" />
      <p class="tlumene">Vyhodnocení je neoficiální. Závazná je kontrola na terminálu Allwyn.</p>
      <label class="volba"><input type="checkbox" [checked]="!oznameni.dialog()" [disabled]="pracuje()" (change)="jenPanel($event)" /> Příště jen upozornit v panelu</label>
      @if (oznameni.chyba(); as chyba) { <p class="chyba-akce" role="alert">{{ chyba }}</p> }
      <div class="tlacitka">
        <button type="button" class="hlavni" [disabled]="pracuje()" (click)="potvrd(zobrazeno())">Rozumím</button>
        <button type="button" [disabled]="pracuje()" (click)="dialog.zavri()">Později</button>
      </div>
    </app-dialog>
    <ng-template #polozky let-polozky>
      <ul>
        @for (p of polozky; track p.id) {
          <li>
            <strong>{{ nazev(p.tiketId) }}</strong> · {{ datum(p.datum) }}
            @if (p.oprava) { <span class="tlumene"> · Aktualizace výsledku</span> }
            <p class="castka" [class.semafor-vyhra]="p.vyhra && !p.nejista">
              @if (p.nejista) { Výherní shoda — částka zatím není konečná. Známé částky: {{ kc(p.castkaKc) }} }
              @else if (p.vyhra) { Výhra {{ kc(p.castkaKc) }} }
              @else { Bez výhry v tomto slosování. }
            </p>
            <button type="button" [disabled]="pracuje()" (click)="otevriTiket(p.tiketId, polozky)">Zobrazit tiket</button>
          </li>
        }
      </ul>
    </ng-template>
  `,
  styles: `
    :host { display: block; position: sticky; top: 0; z-index: 3; }
    .panel { padding: .6rem .75rem; border: 1px solid var(--barva-ok); border-radius: .75rem;
      background: var(--barva-pozadi); box-shadow: 0 .2rem .6rem #0002; margin-bottom: .5rem; }
    .zahlavi, .tlacitka { display: flex; align-items: center; justify-content: space-between; gap: .5rem; flex-wrap: wrap; }
    .polozky { max-height: 40dvh; overflow: auto; overscroll-behavior: contain; }
    ul { list-style: none; padding: 0; margin: .5rem 0; }
    li { padding: .65rem 0; border-bottom: 1px solid var(--barva-ram); overflow-wrap: anywhere; }
    .castka { margin: .4rem 0; font-weight: 600; }
    .volba { display: flex; align-items: center; gap: .6rem; min-height: 48px; margin: .5rem 0; }
    .volba input { flex: none; }
    .varovani { border-color: var(--barva-duraz); }
    .varovani button { margin-left: .5rem; }
  `,
})
export class OznameniPanel {
  protected readonly oznameni = inject(Oznameni);
  protected readonly stav = inject(Stav);
  private readonly dialogy = inject(Dialogy);
  private readonly router = inject(Router);
  private readonly cesta = signal(this.router.url);
  private readonly prechazi = signal(false);
  private readonly viditelna = signal(document.visibilityState !== 'hidden');
  private readonly dialog = viewChild.required<Dialog>('dialog');
  private readonly destroyRef = inject(DestroyRef);
  private readonly jizZobrazeno = new Set<number>();
  protected readonly zobrazeno = signal<readonly OznameniVysledku[]>([]);
  protected readonly rozbaleno = signal(false);
  protected readonly pracuje = signal(false);
  protected readonly maVyhru = computed(() => this.oznameni.neprectene().some(p => p.vyhra));
  protected readonly skryto = computed(() => ['/sken', '/sken-cisel', '/z-obrazku', '/kontrola'].includes(this.cesta().split('?')[0]!));
  protected readonly datum = formatujDatum;
  protected readonly kc = formatujKc;

  constructor() {
    this.router.events.pipe(takeUntilDestroyed()).subscribe(e => {
      if (e instanceof NavigationStart) this.prechazi.set(true);
      else if (e instanceof NavigationEnd) { this.cesta.set(e.urlAfterRedirects); this.prechazi.set(false); }
      else if (e instanceof NavigationCancel || e instanceof NavigationError) this.prechazi.set(false);
    });
    const viditelnost = () => this.viditelna.set(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', viditelnost);
    inject(DestroyRef).onDestroy(() => document.removeEventListener('visibilitychange', viditelnost));
    effect(() => {
      const neprectene = this.oznameni.neprectene();
      const otevreny = this.dialogy.otevreny();
      const dialog = this.dialog();
      if (otevreny === dialog) {
        const platne = new Set(neprectene.map(p => p.id));
        const zustava = untracked(this.zobrazeno).filter(p => platne.has(p.id));
        untracked(() => {
          this.zobrazeno.set(zustava);
          if (zustava.length === 0 && !this.pracuje()) dialog.zavri();
        });
        return;
      }
      if (!this.stav.nacteno() || !this.oznameni.dialog() || !this.viditelna() || !this.dialogy.aktivni()
        || this.prechazi() || this.skryto() || this.cesta().split('?')[0] === '/tiket/novy'
        || this.dialogy.upravuje() || otevreny) return;
      const nove = neprectene.filter(p => p.vyhra && !this.jizZobrazeno.has(p.id));
      if (nove.length === 0) return;
      untracked(() => {
        this.zobrazeno.set(nove);
        // Po vykreslení obsahu, aby showModal zaostřilo skutečné tlačítko.
        requestAnimationFrame(() => {
          if (this.destroyRef.destroyed || this.prechazi() || this.skryto() || this.cesta().split('?')[0] === '/tiket/novy'
            || this.dialogy.upravuje() || !this.viditelna() || !this.dialogy.aktivni() || !this.oznameni.dialog()) return;
          if (!this.oznameni.neprectene().some(p => nove.some(n => n.id === p.id))) return;
          if (dialog.otevri()) nove.forEach(p => this.jizZobrazeno.add(p.id));
        });
      });
    });
  }

  protected nazev(id: string): string {
    const t = this.stav.tikety().find(t => t.id === id);
    return t ? `${t.nazev ? t.nazev + ' · ' : ''}${nazevHry(t.hra)}` : 'Tiket';
  }

  protected async potvrd(polozky: readonly OznameniVysledku[]): Promise<void> {
    if (this.pracuje()) return;
    this.pracuje.set(true);
    const uspech = await this.oznameni.potvrdit(polozky.map(p => p.id));
    this.pracuje.set(false);
    if (uspech) this.dialog().zavri(true);
  }

  protected async otevriTiket(id: string, polozky: readonly OznameniVysledku[]): Promise<void> {
    if (this.pracuje()) return;
    this.pracuje.set(true);
    const uspech = await this.oznameni.potvrdit(polozky.filter(p => p.tiketId === id).map(p => p.id));
    this.pracuje.set(false);
    if (uspech) {
      this.dialog().zavri(true);
      await this.router.navigate(['/tiket', id]);
    }
  }

  protected async obnov(): Promise<void> {
    this.pracuje.set(true);
    await this.oznameni.aktualizuj(this.stav.vysledky(), this.stav.vysledky());
    this.pracuje.set(false);
  }

  protected async jenPanel(e: Event): Promise<void> {
    const pole = e.target as HTMLInputElement;
    this.pracuje.set(true);
    await this.oznameni.nastavDialog(!pole.checked);
    pole.checked = !this.oznameni.dialog();
    this.pracuje.set(false);
  }
}
