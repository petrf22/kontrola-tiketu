import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  zkontrolujTiket,
  type Hra,
  type Problem,
  type Sloupec,
  type VysledekSlosovani,
  type VysledekTiketu,
  type Vyhra,
} from '@kontrola-tiketu/jadro';
import {
  cenaZaSlosovaniZPapiru,
  konecPodlePapiru,
  prectiCastku,
  sestavKontrolu,
  sRozsahem,
} from '../data/kontrola.js';
import {
  formatujDatum,
  formatujDatumCas,
  formatujKc,
  nazevDne,
  nazevDoplnkoveHry,
  nazevHry,
  nazevPoradiDoplnkoveHry,
  pocetSloupcu,
  pocetSlosovani,
  popisDnuSlosovani,
  popisRozsahuKontroly,
} from '../data/format.js';
import { Stav } from '../data/stav.js';

/** Kolik koncových číslic se u kterého pořadí shoduje. */
const DELKA_SHODY: Readonly<Record<string, number>> = {
  sestecisli: 6,
  peticisli: 5,
  ctyrcisli: 4,
  trojcisli: 3,
  dvojcisli: 2,
  'koncove-cislo': 1,
  // Sousední číslo se žádnou číslicí neshoduje — je o jednu vedle, proto nula.
  'sousedni-cislo': 0,
};

const POPIS_VYHRADY: Readonly<Record<string, string>> = {
  'delene-prvni-poradi': 'při více než dvou výhrách se první pořadí dělí, částka je horní odhad',
  'chybi-v-tabulce': 'listina tohle pořadí neuvádí',
};

/** Euročísla, nebo číslo z druhého osudí; Sportka druhé osudí nemá. */
function druheOsudiSloupce(sloupec: Sloupec | undefined): readonly number[] {
  if (sloupec === undefined || sloupec.hra === 'sportka') return [];
  return sloupec.hra === 'eurojackpot' ? sloupec.eurocisla : sloupec.druheOsudi;
}

/** Která úprava rozsahu je rozdělaná. Dvoukrokově místo systémového dialogu — ten blokuje webview. */
type Uprava = 'zadna' | 'ukonceni' | 'rozsah';

@Component({
  selector: 'app-detail',
  imports: [NgTemplateOutlet, RouterLink],
  template: `
    @if (tiket(); as t) {
      <h2>
        {{ nazevHry(t.hra) }}
        @if (t.kontrola) { <span class="stitek">virtuální</span> }
      </h2>
      <p class="popis">
        {{ pocetSloupcu(t.sloupce.length) }}, {{ t.slosovani.pocet }} slosování od
        {{ formatujDatum(t.slosovani.prvni) }}{{ t.slosovani.dny ? ', ' + popisDnuSlosovani(t.slosovani.dny) : '' }}.
        @if (t.kodDoplnkoveHry) {
          <br />{{ nazevDoplnkoveHry(t.hra) }}: {{ t.kodDoplnkoveHry }}
        }
        @if (t.kontrola; as k) {
          <br /><strong>Kontrola {{ popisRozsahuKontroly(k) }}</strong>
        }
      </p>

      @if (vysledek(); as v) {
        <p class="soucet" [class.nejisty]="!v.soucetJisty">
          <span class="popisek">Výhra</span>
          <strong>{{ formatujKc(v.celkemKc) }}</strong>
          @if (!v.soucetJisty) { <span class="hvezda">*</span> }
        </p>

        @if (v.bilanceKc !== null) {
          <p class="bilance" [class.zisk]="v.bilanceKc > 0">
            <span class="popisek">Bilance</span>
            <strong>{{ v.bilanceKc > 0 ? '+' : '' }}{{ formatujKc(v.bilanceKc) }}</strong>
            @if (t.kontrola?.cenaZaSlosovaniKc != null) {
              <span class="tazene">
                vsazeno {{ v.slosovani.length }} × {{ formatujKc(t.kontrola!.cenaZaSlosovaniKc!) }}
              </span>
            } @else {
              <span class="tazene">tiket stál {{ formatujKc(t.cenaKc ?? 0) }}</span>
            }
          </p>
        } @else if (t.kontrola) {
          <p class="tazene">Bez ceny za slosování se bilance nedá spočítat.</p>
        }

        @if (v.pokracuje) {
          <p class="info">
            Zkontrolováno {{ pocetSlosovani(v.slosovani.length) }}.
            Kontroluje se dál s každým dalším staženým slosováním.
          </p>
        }

        @for (p of prekryvyTiketu(); track p.tiketId) {
          <p class="varovani">
            Stejnou sázku má i <a [routerLink]="['/tiket', p.tiketId]">jiný tiket</a>
            na {{ pocetSlosovani(p.data.length) }}. Výhry i vsazené částky těch slosování se
            v přehledu započítají dvakrát.
          </p>
        }

        <ng-container *ngTemplateOutlet="upravaRozsahu; context: { $implicit: t }" />

        @if (v.chybejicichSlosovani > 0) {
          <p class="varovani">
            Chybí výsledky {{ v.chybejicichSlosovani }} slosování, takže tohle není konečná
            částka. „Nevyhrál jsi“ a „zatím nevím“ nejsou totéž — doimportuj novější výsledky.
          </p>
        }

        @for (slosovani of zobrazenaSlosovani().hlavni; track slosovani.datum) {
          <ng-container *ngTemplateOutlet="sekce; context: { $implicit: slosovani }" />
        }

        @if (zobrazenaSlosovani().bezVyhry.length > 0) {
          @if (!ukazatBezVyhry()) {
            <button type="button" class="rozbalit" (click)="ukazatBezVyhry.set(true)">
              Ukázat {{ pocetSlosovani(zobrazenaSlosovani().bezVyhry.length) }} bez výhry
            </button>
          } @else {
            <button type="button" class="rozbalit" (click)="ukazatBezVyhry.set(false)">
              Skrýt slosování bez výhry
            </button>
            @for (slosovani of zobrazenaSlosovani().bezVyhry; track slosovani.datum) {
              <ng-container *ngTemplateOutlet="sekce; context: { $implicit: slosovani }" />
            }
          }
        }

        @if (!v.soucetJisty) {
          <p class="poznamka">* Součet není úplný — viz poznámky výše.</p>
        }
      }

      <ng-template #sekce let-slosovani>
        <section>
          <h3>{{ formatujDatum(slosovani.datum) }}{{ denSlosovani(slosovani) }}</h3>

          <!--
            Vsazená čísla se zvýrazněnými shodami. Bez nich se nedá zkontrolovat, jestli
            aplikace tiket přečetla správně — a právě to je u naOCRovaného tiketu potřeba.
          -->
          <ol class="sloupce">
            @for (radek of sloupceKZobrazeni(slosovani); track radek.index) {
              <li>
                <span class="cisla">
                  @for (c of radek.cisla; track $index) {
                    <span class="cislo" [class.shoda]="c.shoda">{{ c.hodnota }}</span>
                  }
                </span>
                @if (radek.druheOsudi.length > 0) {
                  <span class="cisla euro">
                    @for (c of radek.druheOsudi; track $index) {
                      <span class="cislo" [class.shoda]="c.shoda">{{ c.hodnota }}</span>
                    }
                  </span>
                }
                <span class="poradi">{{ radek.popis }}</span>
              </li>
            }
          </ol>

          @if (doplnkovaKZobrazeni(slosovani); as d) {
            <div class="doplnkova">
              <span class="nazev">{{ d.nazev }}</span>
              <span class="cisla">
                @for (c of d.tvoje; track $index) {
                  <span class="cislo" [class.shoda]="c.shoda">{{ c.hodnota }}</span>
                }
              </span>
              @if (d.vylosovane) {
                <span class="tazene">vylosováno {{ d.vylosovane }}</span>
              }
              @if (d.sousedni) {
                <span class="tazene">koncové číslo o jednu vedle</span>
              }
            </div>
          }

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
      </ng-template>

      <!--
        Úprava rozsahu kontroly. Virtuální tiket bez konce jde ukončit k datu, kdy se přestalo
        sázet; ukončený zase pustit dál. Rozsah jde změnit i u papírového tiketu.
      -->
      <ng-template #upravaRozsahu let-t>
        @switch (uprava()) {
          @case ('ukonceni') {
            <div class="uprava">
              <label>Poslední kontrolované slosování
                <input type="date" [value]="upravaDo()" (input)="upravaDo.set($any($event.target).value)" />
              </label>
              @for (problem of problemyUpravy(); track problem.cesta + problem.kod) {
                <p class="chyba">{{ problem.zprava }}</p>
              }
              <div class="tlacitka">
                <button type="button" class="hlavni" (click)="ulozRozsah()">Ukončit</button>
                <button type="button" (click)="uprava.set('zadna')">Zpět</button>
              </div>
            </div>
          }
          @case ('rozsah') {
            <div class="uprava">
              <div class="dvojice">
                <label>Od
                  <input type="date" [value]="upravaOd()" (input)="upravaOd.set($any($event.target).value)" />
                </label>
                <label>Do (prázdné = bez konce)
                  <input type="date" [value]="upravaDo()" (input)="upravaDo.set($any($event.target).value)" />
                </label>
              </div>
              @if (upravenyTiket()?.kontrola) {
                <label>Cena za jedno slosování v Kč
                  <input type="number" min="0" step="any" inputmode="decimal"
                    [value]="upravaCena()" (input)="upravaCena.set($any($event.target).value)" />
                </label>
              } @else {
                <p class="tazene">Rozsah odpovídá tiketu — tiket se kontroluje podle papíru.</p>
              }
              @for (problem of problemyUpravy(); track problem.cesta + problem.kod) {
                <p class="chyba">{{ problem.zprava }}</p>
              }
              <div class="tlacitka">
                <button type="button" class="hlavni" (click)="ulozRozsah()">Uložit rozsah</button>
                @if (t.kontrola) {
                  <button type="button" (click)="podleTiketu()">Podle tiketu</button>
                }
                <button type="button" (click)="uprava.set('zadna')">Zpět</button>
              </div>
            </div>
          }
          @default {
            <div class="tlacitka">
              @if (t.kontrola?.do === null) {
                <button type="button" (click)="zacniUkonceni()">Ukončit kontrolu</button>
              } @else if (t.kontrola) {
                <button type="button" (click)="pokracujBezKonce()">Pokračovat bez konce</button>
              }
              <button type="button" (click)="zacniUpravuRozsahu()">Upravit rozsah kontroly</button>
            </div>
          }
        }
      </ng-template>

      <dl class="puvod">
        @if (serioveCislo(); as cislo) {
          <dt>Sériové číslo z čárového kódu</dt>
          <dd class="serie">{{ cislo }}</dd>
        }
        <dt>Přidáno</dt>
        <dd>{{ formatujDatumCas(t.vlozeno) }}</dd>
      </dl>

      <p class="overeni">
        Čísla si můžeš ověřit na
        <a [href]="odkazNaVysledky()" target="_blank" rel="noopener noreferrer">stránkách Allwyn</a>.
        Odkaz otevře prohlížeč; aplikace sama na stránky Allwyn nechodí a nic jim neposílá.
      </p>

      @if (!mazani()) {
        <button type="button" class="smazat" (click)="mazani.set(true)">Smazat tiket</button>
      } @else {
        <div class="potvrzeni">
          <p>Opravdu smazat tenhle tiket? Vrátit to nepůjde.</p>
          <button type="button" class="smazat" (click)="smaz()">Ano, smazat</button>
          <button type="button" (click)="mazani.set(false)">Ponechat</button>
        </div>
      }
    } @else {
      <p>Tiket nenalezen.</p>
    }
  `,
  styles: `
    .popis { color: var(--barva-text-tlumeny); font-size: 0.85rem; }
    .stitek {
      margin-left: 0.4rem; padding: 0.05rem 0.45rem; border: 1px solid var(--barva-duraz);
      border-radius: 999px; color: var(--barva-duraz); font-size: 0.7rem; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.05em; vertical-align: middle;
    }
    .info {
      padding: 0.6rem 0.75rem; background: var(--barva-plocha);
      border-left: 3px solid var(--barva-ok); font-size: 0.85rem;
    }
    .uprava {
      display: grid; gap: 0.6rem; margin: 0.75rem 0; padding: 0.75rem;
      border: 1px solid var(--barva-ram); border-radius: 4px;
    }
    .uprava label { display: block; font-size: 0.85rem; }
    .uprava input {
      width: 100%; padding: 0.45rem; margin-top: 0.2rem;
      border: 1px solid var(--barva-ram); border-radius: 4px;
      background: var(--barva-plocha); color: inherit; font: inherit;
    }
    .dvojice { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    .chyba { margin: 0; color: var(--barva-chyba); font-size: 0.85rem; }
    .tlacitka { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0.5rem 0; }
    .tlacitka button, .rozbalit {
      padding: 0.45rem 0.8rem; border: 1px solid var(--barva-ram); border-radius: 4px;
      background: transparent; color: inherit; font: inherit; cursor: pointer;
    }
    .tlacitka button.hlavni { background: var(--barva-duraz); color: #fff; border-color: transparent; }
    .rozbalit { margin-top: 1.25rem; width: 100%; }
    .soucet {
      display: flex; align-items: baseline; gap: 0.5rem;
      font-size: 1.6rem; margin: 0.5rem 0; font-variant-numeric: tabular-nums;
    }
    .bilance {
      display: flex; align-items: baseline; gap: 0.5rem; flex-wrap: wrap;
      margin: 0 0 0.5rem; font-size: 1.1rem; font-variant-numeric: tabular-nums;
      color: var(--barva-text-tlumeny);
    }
    .bilance.zisk strong { color: var(--barva-ok); }
    .soucet .popisek, .bilance .popisek {
      font-size: 0.85rem; font-weight: 400; color: var(--barva-text-tlumeny);
      text-transform: uppercase; letter-spacing: 0.05em;
    }
    .soucet.nejisty strong { color: var(--barva-text-tlumeny); }
    .varovani {
      padding: 0.6rem 0.75rem; background: var(--barva-plocha);
      border-left: 3px solid var(--barva-duraz); font-size: 0.85rem;
    }
    section { margin-top: 1.25rem; }
    h3 { margin: 0 0 0.35rem; font-size: 0.95rem; }
    .bez-vyhry { margin: 0; color: var(--barva-text-tlumeny); font-size: 0.85rem; }
    .sloupce { list-style: none; margin: 0 0 0.75rem; padding: 0; }
    .sloupce li {
      display: flex; flex-wrap: wrap; align-items: center; gap: 0.25rem 0.5rem;
      padding: 0.3rem 0; border-bottom: 1px solid var(--barva-ram);
    }
    .cisla { display: flex; gap: 0.25rem; }
    .cisla.euro { padding-left: 0.5rem; border-left: 1px solid var(--barva-ram); }
    .cislo {
      min-width: 1.9rem; padding: 0.15rem 0.3rem; border-radius: 4px;
      background: var(--barva-plocha); text-align: center;
      font-variant-numeric: tabular-nums; font-size: 0.9rem;
    }
    .cislo.shoda { background: var(--barva-duraz); color: #fff; font-weight: 600; }
    .sloupce .poradi { margin-left: auto; font-size: 0.8rem; color: var(--barva-text-tlumeny); }
    .doplnkova {
      display: flex; flex-wrap: wrap; align-items: center; gap: 0.3rem 0.6rem;
      margin-bottom: 0.75rem; padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--barva-ram);
    }
    .doplnkova .nazev { font-size: 0.85rem; color: var(--barva-text-tlumeny); }
    .tazene { font-size: 0.75rem; color: var(--barva-text-tlumeny); }
    .vyhry { list-style: none; margin: 0; padding: 0; }
    .vyhry li {
      display: grid; grid-template-columns: 1fr auto; gap: 0 1rem;
      padding: 0.35rem 0; border-bottom: 1px solid var(--barva-ram);
    }
    .castka { font-variant-numeric: tabular-nums; }
    .vyhrada { grid-column: 1 / -1; color: var(--barva-text-tlumeny); font-size: 0.75rem; }
    .poznamka { font-size: 0.8rem; color: var(--barva-text-tlumeny); }
    .serie { font-family: ui-monospace, monospace; letter-spacing: 0.04em; }
    .puvod {
      margin: 1.75rem 0 0; padding-top: 0.75rem;
      border-top: 1px solid var(--barva-ram); font-size: 0.8rem;
    }
    .puvod dt { color: var(--barva-text-tlumeny); }
    .puvod dd { margin: 0 0 0.5rem; }
    .overeni {
      margin-top: 1.5rem; font-size: 0.8rem; color: var(--barva-text-tlumeny);
    }
    .smazat, .potvrzeni button {
      margin-top: 0.5rem; padding: 0.45rem 0.8rem; border: 1px solid var(--barva-ram);
      border-radius: 4px; background: transparent; color: inherit;
      font: inherit; cursor: pointer;
    }
    .smazat { color: var(--barva-chyba); }
    .potvrzeni {
      margin-top: 1.5rem; padding: 0.75rem; border: 1px solid var(--barva-chyba);
      border-radius: 4px; display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center;
    }
    .potvrzeni p { width: 100%; margin: 0; font-size: 0.9rem; }
  `,
})
export class Detail {
  readonly id = input.required<string>();

  protected readonly stav = inject(Stav);
  private readonly router = inject(Router);

  protected readonly tiket = computed(() => this.stav.tikety().find((t) => t.id === this.id()));

  /** Rozdělané mazání. Dvoukrokové potvrzení místo systémového dialogu — ten blokuje webview. */
  protected readonly mazani = signal(false);

  protected readonly formatujDatum = formatujDatum;
  protected readonly formatujDatumCas = formatujDatumCas;
  protected readonly formatujKc = formatujKc;
  protected readonly pocetSlosovani = pocetSlosovani;
  protected readonly popisRozsahuKontroly = popisRozsahuKontroly;
  protected readonly nazevHry = nazevHry;
  protected readonly nazevDoplnkoveHry = nazevDoplnkoveHry;
  protected readonly popisDnuSlosovani = popisDnuSlosovani;
  protected readonly pocetSloupcu = pocetSloupcu;

  /**
   * Sériové číslo tiketu, pokud pochází z čárového kódu.
   *
   * Ručně zadaný tiket má vyrobené id, které uživateli nic neřekne, tak se nezobrazuje.
   * Číslo klubové karty tu není a být nemůže — do modelu se nikdy nedostane.
   */
  protected readonly serioveCislo = computed(() => {
    const id = this.tiket()?.id ?? '';
    return /^\d{20}$/.test(id) ? id : null;
  });

  protected readonly odkazNaVysledky = computed(
    () => `https://www.allwyn.cz/loterie/${this.tiket()?.hra ?? 'eurojackpot'}/kontrola-a-vysledky`,
  );

  protected denSlosovani(slosovani: VysledekSlosovani): string {
    const hra = this.tiket()?.hra;
    const tah = this.stav.tahy().find((t) => t.datum === slosovani.datum && t.hra === hra);
    return tah === undefined ? '' : ` (${nazevDne(tah.den)})`;
  }

  protected readonly vysledek = computed<VysledekTiketu | null>(
    () => this.stav.vysledky().get(this.id()) ?? null,
  );

  protected readonly prekryvyTiketu = computed(() => this.stav.prekryvy().get(this.id()) ?? []);

  /** Slosování bez výhry jsou u virtuálního tiketu schovaná — za tři roky jich jsou stovky. */
  protected readonly ukazatBezVyhry = signal(false);

  /**
   * Papírový tiket ukazuje slosování, jak jdou po sobě. Virtuální od nejnovějšího a ta bez
   * výhry až na požádání.
   */
  protected readonly zobrazenaSlosovani = computed(() => {
    const vsechna = this.vysledek()?.slosovani ?? [];
    if (this.tiket()?.kontrola === undefined) return { hlavni: vsechna, bezVyhry: [] };
    const odNejnovejsiho = [...vsechna].reverse();
    return {
      hlavni: odNejnovejsiho.filter((s) => s.vyhry.length > 0),
      bezVyhry: odNejnovejsiho.filter((s) => s.vyhry.length === 0),
    };
  });

  protected readonly uprava = signal<Uprava>('zadna');
  protected readonly upravaOd = signal('');
  protected readonly upravaDo = signal('');
  protected readonly upravaCena = signal('');
  private readonly overitUpravu = signal(false);

  /** Tiket, jak by vypadal po uložení rozdělané úpravy. */
  protected readonly upravenyTiket = computed(() => {
    const tiket = this.tiket();
    if (tiket === undefined) return undefined;
    const doData = this.upravaDo() === '' ? null : this.upravaDo();
    const kontrola = sestavKontrolu(tiket, this.upravaOd(), doData, prectiCastku(this.upravaCena()), this.stav.tahy());
    return sRozsahem(tiket, kontrola);
  });

  protected readonly problemyUpravy = computed<readonly Problem[]>(() => {
    const tiket = this.upravenyTiket();
    if (tiket === undefined || !this.overitUpravu()) return [];
    const problemy = zkontrolujTiket(tiket).filter((p) => p.cesta.startsWith('kontrola'));
    if (this.uprava() === 'ukonceni' && this.upravaDo() === '') {
      // Prázdné datum by tiket nechalo běžet dál — opak toho, co tlačítko slibuje.
      problemy.push({ kod: 'spatne-datum', zprava: 'Vyber datum, kdy kontrola skončí.', cesta: 'kontrola.do' });
    }
    return problemy;
  });

  /** Poslední slosování hry, pro které má aplikace výsledky. */
  private posledniZnameSlosovani(hra: Hra): string | null {
    return this.stav.tahy().reduce<string | null>(
      (max, t) => (t.hra === hra && (max === null || t.datum > max) ? t.datum : max),
      null,
    );
  }

  protected zacniUkonceni(): void {
    const tiket = this.tiket();
    if (tiket?.kontrola === undefined) return;
    this.upravaOd.set(tiket.kontrola.od);
    this.upravaCena.set(String(tiket.kontrola.cenaZaSlosovaniKc ?? ''));
    // Poslední slosování, které tiket opravdu zkontroloval — u tiketu jen na úterý to nemá být pátek.
    const posledni = this.vysledek()?.slosovani.at(-1)?.datum ?? this.posledniZnameSlosovani(tiket.hra);
    this.upravaDo.set(posledni ?? new Date().toISOString().slice(0, 10));
    this.overitUpravu.set(false);
    this.uprava.set('ukonceni');
  }

  protected zacniUpravuRozsahu(): void {
    const tiket = this.tiket();
    if (tiket === undefined) return;
    const k = tiket.kontrola;
    this.upravaOd.set(k?.od ?? tiket.slosovani.prvni);
    this.upravaDo.set(k === undefined ? (konecPodlePapiru(tiket, this.stav.tahy()) ?? '') : (k.do ?? ''));
    const cena = k === undefined ? cenaZaSlosovaniZPapiru(tiket) : k.cenaZaSlosovaniKc;
    this.upravaCena.set(cena === null ? '' : String(cena));
    this.overitUpravu.set(false);
    this.uprava.set('rozsah');
  }

  protected async ulozRozsah(): Promise<void> {
    this.overitUpravu.set(true);
    const tiket = this.upravenyTiket();
    if (tiket === undefined || this.problemyUpravy().length > 0) return;
    await this.stav.ulozTiket(tiket);
    this.uprava.set('zadna');
  }

  protected async pokracujBezKonce(): Promise<void> {
    const tiket = this.tiket();
    if (tiket?.kontrola === undefined) return;
    await this.stav.ulozTiket(sRozsahem(tiket, { ...tiket.kontrola, do: null }));
  }

  protected async podleTiketu(): Promise<void> {
    const tiket = this.tiket();
    if (tiket === undefined) return;
    await this.stav.ulozTiket(sRozsahem(tiket, null));
    this.uprava.set('zadna');
  }

  /**
   * Poskládá vsazená čísla s příznakem, jestli padla.
   *
   * U Sportky hraje sloupec v obou tazích, takže se shody sloučí — číslo se zvýrazní,
   * když padlo aspoň v jednom. Kolik se trefilo v kterém tahu, je vidět v seznamu výher.
   */
  protected sloupceKZobrazeni(slosovani: VysledekSlosovani) {
    const tiket = this.tiket();
    if (tiket === undefined) return [];

    return slosovani.sloupce.map((s) => {
      const sloupec: Sloupec | undefined = tiket.sloupce[s.index];
      const trefene = new Set<number>(
        s.hra === 'sportka' ? s.vysledky.flatMap((v) => v.shoda.cisla) : s.vysledek.shoda.hlavniCisla,
      );
      const trefeneDruhe = new Set<number>(
        s.hra === 'eurojackpot'
          ? s.vysledek.shoda.euroCisla
          : s.hra === 'euromiliony'
            ? s.vysledek.shoda.druheCisla
            : [],
      );

      const oznac = (cisla: readonly number[], kde: ReadonlySet<number>) =>
        cisla.map((hodnota) => ({ hodnota, shoda: kde.has(hodnota) }));

      const poradi =
        s.hra === 'sportka'
          ? (s.vysledky.map((v) => v.poradi).filter((p) => p !== null)[0] ?? null)
          : s.vysledek.poradi;

      return {
        index: s.index,
        cisla: oznac(sloupec?.cisla ?? [], trefene),
        druheOsudi: oznac(druheOsudiSloupce(sloupec), trefeneDruhe),
        popis: poradi === null ? '—' : `pořadí ${poradi}`,
      };
    });
  }

  /**
   * Kód doplňkové hry se zvýrazněnou shodnou koncovkou.
   *
   * Vyhodnocuje se shodou koncových číslic, takže se dá ukázat přesně ta část kódu, která
   * padla. Sedmé pořadí je výjimka — sousední číslo se neshoduje se žádnou číslicí, proto
   * se nezvýrazňuje nic a místo toho se to napíše slovy.
   */
  protected doplnkovaKZobrazeni(slosovani: VysledekSlosovani) {
    const tiket = this.tiket();
    const kod = tiket?.kodDoplnkoveHry;
    if (tiket === undefined || kod == null) return null;

    const vyhra = slosovani.vyhry.find((v) => v.zdroj === 'doplnkova-hra');
    const shodnych = vyhra === undefined ? 0 : (DELKA_SHODY[vyhra.poradi] ?? 0);

    const tah = this.stav.tahy().find((t) => t.datum === slosovani.datum && t.hra === tiket.hra);
    const vylosovane =
      tah === undefined
        ? null
        : tah.hra === 'eurojackpot'
          ? tah.extra6
          : tah.hra === 'euromiliony'
            ? tah.eurosance
            : (tah.sance?.cislice ?? null);

    return {
      nazev: nazevDoplnkoveHry(tiket.hra),
      // Shoda se počítá od konce, proto se index porovnává s délkou.
      tvoje: [...kod].map((hodnota, i) => ({ hodnota, shoda: i >= kod.length - shodnych })),
      vylosovane,
      sousedni: vyhra?.poradi === 'sousedni-cislo',
    };
  }

  protected popisVyhry(vyhra: Vyhra): string {
    const casti: string[] = [];
    if (vyhra.zdroj === 'bonus') casti.push('Bonus');
    else if (vyhra.zdroj === 'doplnkova-hra') casti.push('Doplňková hra');
    else casti.push(`Sloupec ${(vyhra.indexSloupce ?? 0) + 1}`);

    if (vyhra.poradiTahu !== null) casti.push(`${vyhra.poradiTahu}. tah`);

    // Bonus žádné pořadí nemá — jeho klíč je jen „bonus“, takže by z toho vyšlo
    // „Bonus · pořadí bonus“. Doplňková hra má místo římské číslice název koncovky.
    if (vyhra.zdroj === 'doplnkova-hra') casti.push(nazevPoradiDoplnkoveHry(vyhra.poradi));
    else if (vyhra.zdroj !== 'bonus') casti.push(`pořadí ${vyhra.poradi}`);

    return casti.join(' · ');
  }

  protected popisVyhrady(vyhrada: string): string {
    const hra: Hra = this.tiket()?.hra ?? 'eurojackpot';
    if (vyhrada === 'chybi-sazby') {
      return `chybí sazby ${nazevDoplnkoveHry(hra)} — stáhni nebo naimportuj novější výsledky`;
    }
    return POPIS_VYHRADY[vyhrada] ?? vyhrada;
  }

  protected async smaz(): Promise<void> {
    await this.stav.smazTiket(this.id());
    await this.router.navigate(['/']);
  }
}
