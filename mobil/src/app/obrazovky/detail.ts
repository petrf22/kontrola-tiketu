import { NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, computed, effect, inject, input, linkedSignal, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  platnyCenik,
  rozpisCenyTiketu,
  type Tiket,
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
  dnesniDatum,
  formatujDatumCas,
  formatujKc,
  nazevDne,
  nazevDoplnkoveHry,
  nazevHry,
  nazevPoradiDoplnkoveHry,
  pocetSloupcu,
  pocetSlosovani,
  popisDnuSlosovani,
  popisRozpisuCeny,
  popisRozsahuKontroly,
} from '../data/format.js';
import { Stav } from '../data/stav.js';
import { NazevTiketu } from './nazev-tiketu.js';
import { cekaniNaSlosovani, historieTiketu, neuplneSlosovani, sUpravenouCenou, type FiltrHistorie } from '../data/zobrazeniTiketu.js';

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
type Uprava = 'zadna' | 'ukonceni' | 'rozsah' | 'cena' | 'nazev';

@Component({
  selector: 'app-detail',
  imports: [NgTemplateOutlet, RouterLink, NazevTiketu],
  template: `
    @if (tiket(); as t) {
      <div class="akce-tiketu">
        <a routerLink="/" [queryParams]="t.archivovany ? {archiv: '1'} : {}">← {{ t.archivovany ? 'Archiv' : 'Tikety' }}</a>
        <details class="nabidka-akci" (click)="zavriAkce($event)">
          <summary>Akce tiketu</summary>
          <div>
            <button type="button" [disabled]="uklada()" (click)="zacniUpravuNazvu()">Pojmenovat tiket</button>
            <button type="button" [disabled]="uklada()" (click)="zacniUpravuCeny()">Upravit cenu</button>
            <button type="button" [disabled]="uklada()" (click)="zacniUpravuRozsahu()">Upravit rozsah kontroly</button>
            @if (t.kontrola?.do === null) {
              <button type="button" [disabled]="uklada()" (click)="zacniUkonceni()">Ukončit kontrolu</button>
            } @else if (t.kontrola) {
              <button type="button" [disabled]="uklada()" (click)="pokracujBezKonce()">Pokračovat bez konce</button>
            }
            <button type="button" [disabled]="uklada()" (click)="archivuj()">{{ t.archivovany ? 'Vrátit z archivu' : 'Archivovat' }}</button>
            <button type="button" class="smazat" [disabled]="uklada()" (click)="otevriMazani()">Smazat tiket</button>
            <button type="button">Zavřít nabídku</button>
          </div>
        </details>
      </div>
      <h2>{{ t.nazev ? t.nazev + ' · ' : '' }}{{ nazevHry(t.hra) }} @if (t.kontrola) { <span class="stitek">virtuální</span> }</h2>
      @if (t.archivovany) {
        <p class="info">V archivu. Tiket se dál započítává do bilance.
          @if (t.kontrola?.do === null) { Průběžná kontrola pokračuje. }
        </p>
      }
      @if (zpravaAkce(); as zprava) {
        <p class="zprava-akce" role="status">{{ zprava }}
          @if (vratitelnyArchiv() !== null) { <button type="button" [disabled]="uklada()" (click)="vratArchiv()">Zpět</button> }
        </p>
      }
      @if (chybaAkce(); as chyba) { <p class="chyba-akce" role="alert">{{ chyba }}</p> }
      <p class="popis">
        {{ pocetSloupcu(t.sloupce.length) }} ·
        @if (t.kontrola; as k) { Kontrola {{ popisRozsahuKontroly(k) }} }
        @else { {{ pocetSlosovani(t.slosovani.pocet) }} od {{ formatujDatum(t.slosovani.prvni) }} }
        {{ t.slosovani.dny ? ' · ' + popisDnuSlosovani(t.slosovani.dny) : '' }}
      </p>
      <ng-container *ngTemplateOutlet="upravaRozsahu; context: { $implicit: t }" />
      @if (uprava() === 'nazev') {
        <form class="uprava" (submit)="ulozNazev($event)">
          <app-nazev-tiketu [hodnota]="novyNazev()" (zmena)="novyNazev.set($event)" />
          <div class="tlacitka"><button type="submit" class="hlavni" [disabled]="uklada()">Uložit název</button><button type="button" (click)="uprava.set('zadna')">Zrušit</button></div>
        </form>
      }
      @if (uprava() === 'cena') {
        <form class="uprava" (submit)="ulozCenu($event)">
          <label>{{ t.kontrola ? 'Cena za jedno slosování v Kč' : 'Cena celého tiketu v Kč' }}
            <input type="text" inputmode="decimal" [value]="novaCena()" (input)="novaCena.set($any($event.target).value)" aria-describedby="napoveda-ceny" />
          </label>
          <p id="napoveda-ceny" class="tlumene">Prázdné pole použije ceník. Zadaná cena má přednost.</p>
          @if (t.kontrola) {
            @if (rozpisZaSlosovani(); as r) {
              <p class="tlumene">Cena jednoho slosování podle ceníku: {{ popisRozpisuCeny(t.hra, r) }}.</p>
            }
          } @else if (rozpisCeny(); as r) {
            <p class="tlumene">Cena papírového tiketu podle ceníku: {{ formatujKc(r.celkemKc) }} ({{ r.sloupcu }} × {{ formatujKc(r.sloupecKc) }}@if (r.doplnkovaHraKc !== null) { + {{ formatujKc(r.doplnkovaHraKc) }} } za slosování, {{ pocetSlosovani(r.slosovani) }}).</p>
          }
          <div class="tlacitka"><button type="submit" class="hlavni" [disabled]="uklada()">Uložit cenu</button><button type="button" (click)="uprava.set('zadna')">Zrušit</button></div>
        </form>
      }
      @if (vysledek(); as v) {
        <dl class="souhrn-tiketu">
          <div>
            <dt>{{ t.kontrola ? 'Vsazeno' : 'Cena tiketu' }}</dt>
            <dd>{{ v.vsazenoKc === null ? 'Neznámá' : formatujKc(v.vsazenoKc) }}</dd>
          </div>
          @if (!cekani()) {
            <div>
              <dt>Výhra</dt>
              <dd [class.nejisty]="!v.soucetJisty">{{ formatujKc(v.celkemKc) }}@if (!v.soucetJisty) { * }</dd>
            </div>
            <div>
              <dt>Bilance</dt>
              <dd [class.zisk]="v.bilanceKc !== null && v.bilanceKc > 0">{{ v.bilanceKc === null ? 'Nelze určit' : (v.bilanceKc > 0 ? '+' : '') + formatujKc(v.bilanceKc) }}</dd>
            </div>
          }
        </dl>

        <p class="tlumene">
          @if (t.kontrola) {
            @if (t.kontrola.cenaZaSlosovaniKc !== null) {
              {{ pocetSlosovani(v.slosovani.length) }} × {{ formatujKc(t.kontrola.cenaZaSlosovaniKc) }} za slosování.
            } @else { Cena podle ceníku platného pro jednotlivá slosování. }
          } @else { {{ t.cenaKc === null ? 'Cena podle ceníku.' : 'Cena z tiketu nebo ručně upravená.' }} }
          @if (v.vsazenoKc === null && !cekani()) { Cena není známá, bilanci nelze spočítat. }
        </p>
        @if (cekani(); as c) {
          @if (c.duvod === 'pred-slosovanim') {
            <p class="info cekani">
              Tiket zatím nebyl slosován — {{ t.kontrola ? 'kontrola začíná' : 'první slosování je' }}
              {{ formatujDatum(c.od) }}. Výhru a bilanci uvidíš po slosování, až si stáhneš výsledky.
            </p>
          } @else {
            <p class="varovani cekani">
              Slosování {{ t.kontrola ? 'od' : 'z' }} {{ formatujDatum(c.od) }} už proběhlo, ale výsledky
              v aplikaci zatím nejsou. <a routerLink="/import">Aktualizovat výsledky</a>.
            </p>
          }
        } @else if (!v.soucetJisty) { <p class="info">Průběžný výsledek: výhra ani bilance nejsou konečné.</p> }
        @if (!t.kontrola && t.cenaKc !== null && rozpisCeny(); as r) {
          @if (t.cenaKc !== r.celkemKc) { <p class="varovani">Cena se liší od ceníku ({{ formatujKc(r.celkemKc) }}). Používá se zadaná cena.</p> }
        }

        @if (!cekani()) {
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



          @if (v.chybejicichSlosovani > 0) {
            <p class="varovani">
              Chybí výsledky {{ v.chybejicichSlosovani }} slosování, takže tohle není konečná
              částka. <a routerLink="/import">Aktualizovat výsledky</a>.
            </p>
          }
        }

        <details class="obsah-tiketu">
          <summary>Vsazená čísla · {{ pocetSloupcu(t.sloupce.length) }}</summary>
          <ol>
            @for (sloupec of t.sloupce; track $index) {
              <li>{{ sloupec.cisla.join(' · ') }}
                @if (druheOsudi(sloupec).length > 0) { <strong> + {{ druheOsudi(sloupec).join(' · ') }}</strong> }
              </li>
            }
          </ol>
          @if (t.kodDoplnkoveHry) { <p>{{ nazevDoplnkoveHry(t.hra) }}: {{ t.kodDoplnkoveHry }}</p> }
        </details>
        @if (!cekani()) {
          <h3>Historie slosování</h3>
          <div class="prepinace" aria-label="Filtr historie">
            <button type="button" [attr.aria-pressed]="filtrHistorie() === 'vsechna'" (click)="zmenFiltr('vsechna')">Všechna</button>
            <button type="button" [attr.aria-pressed]="filtrHistorie() === 'vyherni'" (click)="zmenFiltr('vyherni')">Výherní</button>
            <button type="button" [attr.aria-pressed]="filtrHistorie() === 'neuplna'" (click)="zmenFiltr('neuplna')">Neúplná</button>
          </div>
          <p class="tlumene">Zobrazeno {{ zobrazenaSlosovani().length }} z {{ historie().length }} slosování.</p>
          @for (slosovani of zobrazenaSlosovani(); track slosovani.datum) {
            <details class="historie-radek" [open]="!t.kontrola && v.slosovani.length === 1">
              <summary>
                {{ formatujDatum(slosovani.datum) }}{{ denSlosovani(slosovani) }}
                <span>{{ slosovani.vyhry.length ? 'Výhra ' + formatujKc(slosovani.celkemKc) : 'Bez výhry' }}</span>
                @if (neuplne(slosovani)) { <small>Neúplné vyhodnocení</small> }
              </summary>
              <ng-container *ngTemplateOutlet="sekce; context: { $implicit: slosovani }" />
            </details>
          } @empty { <p class="tlumene">Tomuto filtru zatím neodpovídá žádné slosování.</p> }
          @if (zobrazenaSlosovani().length < historie().length) {
            <button type="button" class="rozbalit" (click)="limitHistorie.update(dalsiStrana)">Načíst dalších 20</button>
          }

          @if (!v.soucetJisty) {
            <p class="poznamka">* Součet není úplný — viz poznámky výše.</p>
          }
        }
      }

      <ng-template #sekce let-slosovani>
        <section>


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
                <button type="button" class="hlavni" [disabled]="uklada()" (click)="ulozRozsah()">Ukončit</button>
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
                <label>Cena za jedno slosování v Kč (prázdné = podle ceníku)
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
                <button type="button" class="hlavni" [disabled]="uklada()" (click)="ulozRozsah()">Uložit rozsah</button>
                @if (t.kontrola) {
                  <button type="button" (click)="podleTiketu()">Podle tiketu</button>
                }
                <button type="button" (click)="uprava.set('zadna')">Zpět</button>
              </div>
            </div>
          }
        }
      </ng-template>

      <details>
        <summary>{{ t.kontrola ? 'Původní tiket a údaje' : 'Údaje o tiketu' }}</summary>
        <p>{{ pocetSlosovani(t.slosovani.pocet) }} od {{ formatujDatum(t.slosovani.prvni) }} · Cena papírového tiketu: {{ t.cenaKc === null ? 'Neznámá' : formatujKc(t.cenaKc) }}</p>
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

      </details>
      <dialog #dialogMazani class="potvrzeni" aria-labelledby="potvrzeni-text">
        <p id="potvrzeni-text">Opravdu smazat tenhle tiket? Vrátit to nepůjde.</p>
        <div>
          <button type="button" class="smazat" [disabled]="uklada()" (click)="smaz()">Ano, smazat</button>
          <button type="button" autofocus (click)="ponechat()">Ponechat</button>
        </div>
      </dialog>
    } @else {
      <p>Tiket nenalezen.</p>
    }
  `,
  styles: `
    .nabidka-akci { position: relative; margin: 0; border: 0; padding: 0; }
    .nabidka-akci > div { position: fixed; right: max(1rem, calc((100vw - 44rem) / 2)); bottom: calc(6rem + env(safe-area-inset-bottom)); z-index: 6; max-height: calc(100dvh - 8rem - env(safe-area-inset-bottom) - env(safe-area-inset-top)); overflow-y: auto; display: grid; width: min(20rem, calc(100vw - 2rem)); padding: .5rem; gap: .25rem; background: var(--barva-pozadi); border: 1px solid var(--barva-ram); border-radius: .75rem; box-shadow: 0 .5rem 1.5rem #0003; }
    .nabidka-akci button { text-align: left; }
    .historie-radek summary span, .historie-radek summary small { display: block; font-weight: 400; margin-left: 1.1rem; }
    .historie-radek summary small { color: var(--barva-text-tlumeny); }
    .obsah-tiketu li { padding: .4rem 0; overflow-wrap: anywhere; }

    h2 { overflow-wrap: anywhere; }
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
    @media (max-width: 480px) { .dvojice { grid-template-columns: minmax(0, 1fr); } }
    .chyba { margin: 0; color: var(--barva-chyba); font-size: 0.85rem; }
    .tlacitka { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0.5rem 0; }
    .tlacitka button.hlavni { background: var(--barva-duraz); color: var(--barva-pozadi); border-color: transparent; }
    .rozbalit { margin-top: 1.25rem; width: 100%; }
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
    .cislo.shoda { background: var(--barva-duraz); color: var(--barva-pozadi); font-weight: 600; }
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
    .smazat { color: var(--barva-chyba); }
    .potvrzeni {
      max-width: 22rem; border: 1px solid var(--barva-chyba); border-radius: 6px;
      background: var(--barva-pozadi); color: inherit;
    }
    .potvrzeni::backdrop { background: #0008; }
    .potvrzeni p { margin: 0; }
    .potvrzeni div { display: flex; justify-content: flex-end; gap: 0.5rem; }
  `,
})
export class Detail {
  readonly id = input.required<string>();

  protected readonly stav = inject(Stav);
  private readonly router = inject(Router);

  protected readonly tiket = computed(() => this.stav.tikety().find((t) => t.id === this.id()));

  /**
   * Potvrzení mazání. HTML `<dialog>` je modál uvnitř webview: neblokuje ho jako `window.confirm`
   * a na rozdíl od nativního dialogu (samostatné okno) ho kryje FLAG_SECURE aktivity.
   */
  private readonly dialogMazani = viewChild<ElementRef<HTMLDialogElement>>('dialogMazani');

  protected readonly formatujDatum = formatujDatum;
  protected readonly formatujDatumCas = formatujDatumCas;
  protected readonly formatujKc = formatujKc;
  protected readonly pocetSlosovani = pocetSlosovani;
  protected readonly popisRozpisuCeny = popisRozpisuCeny;
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

  /** Tiket bez jediného vyhodnoceného slosování — místo nulové výhry a záporné bilance se čeká. */
  protected readonly cekani = computed(() => {
    const t = this.tiket(), v = this.vysledek();
    return t === undefined || v === null ? null : cekaniNaSlosovani(t, v, dnesniDatum());
  });

  protected readonly prekryvyTiketu = computed(() => this.stav.prekryvy().get(this.id()) ?? []);

  protected readonly filtrHistorie = linkedSignal<FiltrHistorie>(() => { this.id(); return 'vsechna'; });
  protected readonly limitHistorie = linkedSignal(() => { this.id(); return 20; });
  protected readonly historie = computed(() => historieTiketu(this.vysledek()?.slosovani ?? [], this.filtrHistorie()));
  protected readonly zobrazenaSlosovani = computed(() => this.historie().slice(0, this.limitHistorie()));
  protected readonly dalsiStrana = (n: number) => n + 20;
  protected readonly neuplne = neuplneSlosovani;
  protected readonly druheOsudi = druheOsudiSloupce;
  protected zmenFiltr(filtr: FiltrHistorie): void {
    this.filtrHistorie.set(filtr);
    this.limitHistorie.set(20);
  }
  protected readonly novyNazev = signal('');

  protected zacniUpravuNazvu(): void {
    this.novyNazev.set(this.tiket()?.nazev ?? '');
    this.uprava.set('nazev');
  }

  protected async ulozNazev(e: Event): Promise<void> {
    e.preventDefault();
    const t = this.tiket();
    if (!t) return;
    if (await this.provedAkci(() => this.stav.ulozTiket({ ...t, nazev: this.novyNazev() }))) {
      this.uprava.set('zadna');
      this.zpravaAkce.set('Název byl uložen.');
    }
  }

  protected readonly novaCena = signal('');
  protected readonly rozpisCeny = computed(() => {
    const t = this.tiket();
    return t ? rozpisCenyTiketu(t, this.stav.ceny()) : null;
  });

  /**
   * Týž rozpis přepočtený na jedno slosování. Virtuální tiket se zadává cenou za slosování,
   * takže rozpis za celý papír by mluvil o jiné veličině, než je v poli nad ním.
   */
  protected readonly rozpisZaSlosovani = computed(() => {
    const r = this.rozpisCeny();
    return r === null ? null : { ...r, slosovani: 1, celkemKc: r.sloupcu * r.sloupecKc + (r.doplnkovaHraKc ?? 0) };
  });
  protected readonly uklada = signal(false);
  protected readonly chybaAkce = signal<string | null>(null);
  protected readonly zpravaAkce = signal<string | null>(null);
  protected readonly vratitelnyArchiv = signal<boolean | null>(null);

  constructor() {
    effect(() => {
      this.id();
      this.uprava.set('zadna');
      this.vratitelnyArchiv.set(null);
      this.zpravaAkce.set(null);
      this.chybaAkce.set(null);
    });
  }

  protected zavriAkce(e: Event): void {
    if ((e.target as HTMLElement).closest('button')) (e.currentTarget as HTMLDetailsElement).open = false;
  }

  /**
   * Chyba ukládání zůstane viditelná; oznámení úspěchu až po zápisu. Hlášku i nabídku vrácení
   * maže hned na začátku, aby po neúspěchu nezůstala svítit vedle chyby z minulé akce.
   */
  private async provedAkci(akce: () => Promise<void>): Promise<boolean> {
    if (this.uklada()) return false;
    this.uklada.set(true);
    this.chybaAkce.set(null);
    this.zpravaAkce.set(null);
    this.vratitelnyArchiv.set(null);
    const id = this.id();
    try {
      await akce();
      if (id !== this.id()) return false;
      return true;
    }
    catch { this.chybaAkce.set('Změnu se nepodařilo uložit. Zkus to znovu.'); return false; }
    finally { this.uklada.set(false); }
  }

  protected async archivuj(): Promise<void> {
    const t = this.tiket();
    if (!t) return;
    if (await this.provedAkci(() => this.stav.ulozTiket({ ...t, archivovany: !t.archivovany }))) {
      this.vratitelnyArchiv.set(!!t.archivovany);
      this.zpravaAkce.set(t.archivovany ? 'Tiket byl vrácen mezi aktuální.' : 'Tiket byl přesunut do archivu.');
    }
  }

  protected async vratArchiv(): Promise<void> {
    const t = this.tiket(), archivovany = this.vratitelnyArchiv();
    if (!t || archivovany === null) return;
    if (await this.provedAkci(() => this.stav.ulozTiket({ ...t, archivovany }))) this.zpravaAkce.set('Přesun byl vrácen.');
  }

  protected zacniUpravuCeny(): void {
    const t = this.tiket();
    if (!t) return;
    this.novaCena.set(String((t.kontrola ? t.kontrola.cenaZaSlosovaniKc : t.cenaKc) ?? ''));
    this.uprava.set('cena');
  }

  protected async ulozCenu(e: Event): Promise<void> {
    e.preventDefault();
    const t = this.tiket();
    if (!t) return;
    let upraveny: Tiket;
    try { upraveny = sUpravenouCenou(t, this.novaCena()); }
    catch (chyba) { this.chybaAkce.set((chyba as Error).message); return; }
    if (await this.provedAkci(() => this.stav.ulozTiket(upraveny))) {
      this.uprava.set('zadna');
      this.zpravaAkce.set('Cena byla uložena.');
    }
  }

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
    // Nový rozsah se počítá podle ceníku, když ho ceník pro první slosování zná; jinak podle papíru.
    const cenikZna = platnyCenik(this.stav.ceny(), tiket.hra, tiket.slosovani.prvni) !== null;
    const cena = k !== undefined ? k.cenaZaSlosovaniKc : cenikZna ? null : cenaZaSlosovaniZPapiru(tiket);
    this.upravaCena.set(cena === null ? '' : String(cena));
    this.overitUpravu.set(false);
    this.uprava.set('rozsah');
  }

  protected async ulozRozsah(): Promise<void> {
    this.overitUpravu.set(true);
    const tiket = this.upravenyTiket();
    if (tiket === undefined || this.problemyUpravy().length > 0) return;
    if (await this.provedAkci(() => this.stav.ulozTiket(tiket))) this.uprava.set('zadna');
  }

  protected async pokracujBezKonce(): Promise<void> {
    const tiket = this.tiket();
    if (tiket?.kontrola === undefined) return;
    await this.provedAkci(() => this.stav.ulozTiket(sRozsahem(tiket, { ...tiket.kontrola!, do: null })));
  }

  protected async podleTiketu(): Promise<void> {
    const tiket = this.tiket();
    if (tiket === undefined) return;
    if (await this.provedAkci(() => this.stav.ulozTiket(sRozsahem(tiket, null)))) this.uprava.set('zadna');
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

  protected otevriMazani(): void {
    this.dialogMazani()?.nativeElement.showModal();
  }

  protected ponechat(): void {
    this.dialogMazani()?.nativeElement.close();
  }

  protected async smaz(): Promise<void> {
    this.dialogMazani()?.nativeElement.close();
    if (await this.provedAkci(() => this.stav.smazTiket(this.id()))) await this.router.navigate(['/']);
  }
}
