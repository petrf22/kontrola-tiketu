import { Component, DestroyRef, ElementRef, Injectable, inject, input, output, signal, viewChild } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

/** Společné místo pro systémové Zpět a odkládání oznámení během úprav. */
@Injectable({ providedIn: 'root' })
export class Dialogy {
  readonly otevreny = signal<Dialog | null>(null);
  readonly upravuje = signal(false);

  zpet(): boolean {
    const dialog = this.otevreny();
    if (!dialog) return false;
    dialog.zavri();
    return true;
  }
}

@Component({
  selector: 'app-dialog',
  template: `
    <dialog #okno [class.spodni]="spodni()" [attr.aria-label]="nadpis()"
      (cancel)="$event.preventDefault(); zavri()" (close)="uklid()"
      (click)="pozadi($event)">
      <h2>{{ nadpis() }}</h2>
      <ng-content />
    </dialog>
  `,
  styles: `
    dialog { width: min(30rem, calc(100% - 2rem)); max-height: calc(100dvh - 2rem - env(safe-area-inset-top) - env(safe-area-inset-bottom));
      overflow: auto; overscroll-behavior: contain; padding: 1rem; border: 1px solid var(--barva-ram);
      border-radius: 1rem; background: var(--barva-pozadi); color: var(--barva-text); }
    dialog::backdrop { background: #0009; }
    dialog.spodni { margin-bottom: max(1rem, env(safe-area-inset-bottom)); }
    h2 { margin: 0 0 1rem; font-size: 1.25rem; }
  `,
})
export class Dialog {
  readonly nadpis = input.required<string>();
  readonly spodni = input(false);
  readonly zavritPozadim = input(false);
  readonly pracuje = input(false);
  readonly zavreno = output<void>();
  private readonly okno = viewChild.required<ElementRef<HTMLDialogElement>>('okno');
  private readonly dialogy = inject(Dialogy);
  private obnova: (() => void) | null = null;

  constructor() {
    inject(Router).events.pipe(takeUntilDestroyed()).subscribe(e => {
      if (e instanceof NavigationStart) this.zavri(true);
    });
    inject(DestroyRef).onDestroy(() => this.uklid());
  }

  otevri(): boolean {
    if (this.obnova) return true;
    if (this.dialogy.otevreny()) return false;
    const okno = this.okno().nativeElement;
    const spoustec = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const y = window.scrollY;
    const body = document.body;
    const puvodni = { position: body.style.position, top: body.style.top, width: body.style.width, overflow: body.style.overflow };
    const overflowHtml = document.documentElement.style.overflow;
    okno.showModal();
    body.style.position = 'fixed';
    body.style.top = `-${y}px`;
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    this.obnova = () => {
      Object.assign(body.style, puvodni);
      document.documentElement.style.overflow = overflowHtml;
      window.scrollTo({ top: y, behavior: 'instant' });
      if (spoustec?.isConnected) spoustec.focus({ preventScroll: true });
    };
    this.dialogy.otevreny.set(this);
    return true;
  }

  zavri(vynutit = false): void {
    if (this.pracuje() && !vynutit) return;
    if (!this.obnova) return;
    this.okno().nativeElement.close();
    this.uklid();
  }

  protected pozadi(e: MouseEvent): void {
    if (!this.zavritPozadim() || e.target !== this.okno().nativeElement) return;
    const r = this.okno().nativeElement.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) this.zavri();
  }

  protected uklid(): void {
    if (!this.obnova) return;
    const obnova = this.obnova;
    this.obnova = null;
    obnova();
    this.dialogy.otevreny.set(null);
    this.zavreno.emit();
  }
}
