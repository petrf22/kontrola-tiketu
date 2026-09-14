import { Component, computed, input } from '@angular/core';
import { formatujKc } from '../data/format.js';

/** Poloměr a tloušťka prstence v jednotkách `viewBox` 0 0 120 120. */
const POLOMER = 48;
const TLOUSTKA = 14;
const OBVOD = 2 * Math.PI * POLOMER;
/** Mezera mezi výsečemi v barvě pozadí, aby se nesly jako dvě části, ne jedna skvrna. */
const MEZERA = 2;

/**
 * Koláč Vsazeno × Vyhráno s bilancí uprostřed.
 *
 * Kreslí se vlastním SVG, bez knihovny grafů — aplikace nemá mít závislost navíc a dvě výseče
 * jsou dva kruhy s `stroke-dasharray`. Částky jsou vždy i napsané v legendě, takže barva
 * nenese význam sama.
 */
@Component({
  selector: 'app-kolac',
  template: `
    <figure>
      <svg viewBox="0 0 120 120" role="img" [attr.aria-label]="popis()">
        <circle class="stopa" cx="60" cy="60" [attr.r]="polomer" [attr.stroke-width]="tloustka" />
        @if (vysece(); as v) {
          <g transform="rotate(-90 60 60)">
            @if (v.vsazeno > 0) {
              <circle class="vsazeno" cx="60" cy="60" [attr.r]="polomer" [attr.stroke-width]="tloustka"
                [attr.stroke-dasharray]="v.vsazeno + ' ' + obvod">
                <title>Vsazeno {{ formatujKc(vsazenoKc()) }}</title>
              </circle>
            }
            @if (v.vyhrano > 0) {
              <circle class="vyhrano" cx="60" cy="60" [attr.r]="polomer" [attr.stroke-width]="tloustka"
                [attr.stroke-dasharray]="v.vyhrano + ' ' + obvod" [attr.stroke-dashoffset]="-v.posun">
                <title>Vyhráno {{ formatujKc(vyhranoKc()) }}</title>
              </circle>
            }
          </g>
        }
        <text x="60" y="56" class="bilance">{{ bilanceText() }}</text>
        <text x="60" y="72" class="popisek">bilance</text>
      </svg>
      <figcaption>
        <span class="nazev">{{ nazev() }}</span>
        <span class="radek"><i class="vzorek vsazeno"></i> Vsazeno <b>{{ formatujKc(vsazenoKc()) }}</b></span>
        <span class="radek"><i class="vzorek vyhrano"></i> Vyhráno <b>{{ formatujKc(vyhranoKc()) }}</b></span>
      </figcaption>
    </figure>
  `,
  styles: `
    figure { display: flex; align-items: center; gap: 1rem; margin: 0; }
    svg { width: 7.5rem; flex: none; }
    :host(.velky) svg { width: 10rem; }
    circle { fill: none; }
    .stopa { stroke: var(--barva-plocha); }
    circle.vsazeno { stroke: var(--barva-vsazeno); }
    circle.vyhrano { stroke: var(--barva-vyhrano); }
    text { text-anchor: middle; fill: var(--barva-text); font-variant-numeric: tabular-nums; }
    .bilance { font-size: 13px; font-weight: 600; }
    :host(.velky) .bilance { font-size: 12px; }
    .popisek { font-size: 8px; fill: var(--barva-text-tlumeny); text-transform: uppercase; letter-spacing: 0.05em; }
    figcaption { display: grid; gap: 0.2rem; font-size: 0.85rem; min-width: 0; }
    .nazev { font-weight: 600; font-size: 1rem; }
    .radek { color: var(--barva-text-tlumeny); }
    .radek b { color: var(--barva-text); font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .vzorek {
      display: inline-block; width: 0.7rem; height: 0.7rem; margin-right: 0.2rem;
      border-radius: 2px; vertical-align: -0.05rem;
    }
    .vzorek.vsazeno { background: var(--barva-vsazeno); }
    .vzorek.vyhrano { background: var(--barva-vyhrano); }
  `,
})
export class Kolac {
  readonly nazev = input.required<string>();
  readonly vsazenoKc = input.required<number>();
  readonly vyhranoKc = input.required<number>();

  protected readonly polomer = POLOMER;
  protected readonly tloustka = TLOUSTKA;
  protected readonly obvod = OBVOD;
  protected readonly formatujKc = formatujKc;

  /** Délky výsečí po obvodu. `null`, když není co kreslit — zůstane jen šedá stopa. */
  protected readonly vysece = computed(() => {
    const vsazeno = Math.max(0, this.vsazenoKc());
    const vyhrano = Math.max(0, this.vyhranoKc());
    const celkem = vsazeno + vyhrano;
    if (celkem === 0) return null;
    const oba = vsazeno > 0 && vyhrano > 0;
    const delka = (castka: number) => Math.max(0, (castka / celkem) * OBVOD - (oba ? MEZERA : 0));
    return { vsazeno: delka(vsazeno), vyhrano: delka(vyhrano), posun: (vsazeno / celkem) * OBVOD };
  });

  protected readonly bilanceText = computed(() => {
    const bilance = this.vyhranoKc() - this.vsazenoKc();
    return `${bilance > 0 ? '+' : ''}${formatujKc(bilance)}`;
  });

  protected readonly popis = computed(
    () =>
      `${this.nazev()}: vsazeno ${formatujKc(this.vsazenoKc())}, vyhráno ${formatujKc(this.vyhranoKc())}, bilance ${this.bilanceText()}`,
  );
}
