import { Component, ElementRef, computed, inject, linkedSignal, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  DELKA_KODU_DOPLNKOVE_HRY,
  DNY_LOSOVANI,
  dnyZVyberu,
  prekryvy,
  rozpisCenyTiketu,
  ROZSAHY,
  stejnaSazka,
  vyberSlosovani,
  zkontrolujTiket,
  type Den,
  type Hra,
  type Sloupec,
  type Tiket,
} from '@kontrola-tiketu/jadro';
import { prectiCisla, vsazeneDny } from '@kontrola-tiketu/ocr';
import {
  cenaZaSlosovaniZPapiru,
  konecPodlePapiru,
  prectiCastku,
  sestavKontrolu,
  type Papir,
} from '../data/kontrola.js';
import {
  formatujDatum,
  formatujKc,
  HRY,
  mistoVeSloupci,
  nazevDne,
  nazevDoplnkoveHry,
  nazevHry,
  pocetSlosovani,
  popisProblemu,
  popisRozpisuCeny,
  popisRozsahuKontroly,
  type PoleSloupce,
} from '../data/format.js';
import { NactenaCisla, NaskenovanyTiket } from '../data/sken.js';
import { Stav } from '../data/stav.js';
import { NazevTiketu } from './nazev-tiketu.js';

interface Radek {
  cisla: string;
  /** Euročísla (Eurojackpot) nebo číslo z druhého osudí (Euromiliony). */
  druheOsudi: string;
  /**
   * Jestli už uživatel pole opustil. Do té doby se jeho chyby neukazují — prázdný sloupec
   * by jinak hlásil chyby hned po otevření formuláře. Příznak žije v řádku, aby se při
   * odebrání sloupce posunul s ním.
   */
  dotceno: Record<PoleSloupce, boolean>;
}

const PRAZDNY_RADEK: Radek = { cisla: '', druheOsudi: '', dotceno: { cisla: false, druhe: false } };

/**
 * Cesty, které mají v šabloně vlastní hlášku u pole. Souhrnný seznam je pak jen záchrana pro
 * cestu, na kterou žádné pole nesedí — jinak by se tatáž chyba vypsala dvakrát.
 */
const CESTY_POLI = [
  'slosovani.prvni', 'slosovani.pocet', 'kodDoplnkoveHry', 'cenaKc',
  'kontrola.od', 'kontrola.do', 'kontrola.cenaZaSlosovaniKc',
] as const;

/** Patří chyba na cestě `cesta` poli, které vypisuje chyby pro `pole` a všechno pod ním? */
function patriPoli(cesta: string, pole: string): boolean {
  return cesta === pole || cesta.startsWith(pole + '.') || cesta.startsWith(pole + '[');
}

/**
 * Kolik sloupců formulář dovolí přidat. Euromiliony: jedna až devět sázek na sázence
 * (herní plán, Euromiliony bod 2).
 */
const NEJVIC_SLOUPCU: Readonly<Record<Hra, number>> = {
  eurojackpot: 6,
  sportka: ROZSAHY.sportka.cisla.pocet + 4,
  euromiliony: 9,
};

/** Nápověda v polích sloupce, odvozená z rozsahů jádra. */
function napoveda(hra: Hra): { cisla: string; druheOsudi: string | null; druheOsudiNazev: string } {
  switch (hra) {
    case 'eurojackpot': {
      const { cisla, eurocisla } = ROZSAHY.eurojackpot;
      return {
        cisla: `${cisla.pocet} čísel z ${cisla.min}–${cisla.max}`,
        druheOsudi: `${eurocisla.pocet} z ${eurocisla.min}–${eurocisla.max}`,
        druheOsudiNazev: 'Euročísla',
      };
    }
    case 'euromiliony': {
      const { cisla, druheOsudi } = ROZSAHY.euromiliony;
      return {
        cisla: `${cisla.pocet} čísel z ${cisla.min}–${cisla.max}`,
        druheOsudi: `${druheOsudi.pocet} z ${druheOsudi.min}–${druheOsudi.max}`,
        druheOsudiNazev: 'Číslo z druhého osudí',
      };
    }
    case 'sportka': {
      const { cisla } = ROZSAHY.sportka;
      return { cisla: `${cisla.pocet} čísel z ${cisla.min}–${cisla.max}`, druheOsudi: null, druheOsudiNazev: '' };
    }
  }
}

/**
 * Ruční zadání tiketu.
 *
 * Zadání žádá, aby ruční zadání bylo plnohodnotná alternativa skenu, ne nouzovka. Proto je
 * to samostatná obrazovka dostupná z hlavní nabídky, ne až záchrana po nepovedeném skenu.
 * Stejný formulář poslouží i pro potvrzení naOCRovaných čísel.
 */
function stejneDny(a: readonly Den[] | null, b: readonly Den[] | null): boolean {
  return a === b || (a !== null && b !== null && a.length === b.length && a.every((d, i) => d === b[i]));
}

@Component({
  selector: 'app-novy-tiket',
  imports: [RouterLink, NazevTiketu],
  template: `
    <a class="zpet" routerLink="/pridat">← Přidat tiket</a>
    <h2>{{ rozpoznanoZeSnimku ? 'Potvrdit údaje z fotky' : 'Zadat tiket' }}</h2>
    <form (submit)="uloz($event)" novalidate>
      <app-nazev-tiketu [hodnota]="nazevPole()" (zmena)="nazev.set($event)" />
      <fieldset>
        <legend>Hra</legend>
        @for (h of hry; track h) {
          <label><input type="radio" name="hra" [attr.value]="h"
            [checked]="hra() === h" (change)="zmenHru(h)" /> {{ nazevHry(h) }}</label>
        }
      </fieldset>

      @if (chybiDatum()) {
        <p class="upozorneni">
          Datum prvního slosování se z fotky nepřečetlo — opiš ho prosím z tiketu, z řádku
          SLOSOVÁNÍ. Bez něj by se tiket vyhodnotil proti jinému tahu.
        </p>
      }

      <div class="dvojice">
        <label>První slosování
          <input data-cesta="slosovani.prvni" type="date" [value]="prvni()" (input)="prvni.set($any($event.target).value)" required />
        @for (chyba of chybyPole('slosovani.prvni'); track $index) { <span class="chyba-pole">{{ chyba }}</span> }
          </label>
        <label>Počet slosování
          <input data-cesta="slosovani.pocet" type="number" min="1" max="52" [value]="pocet()"
            (input)="pocet.set(+$any($event.target).value)" required />
        @for (chyba of chybyPole('slosovani.pocet'); track $index) { <span class="chyba-pole">{{ chyba }}</span> }
          </label>
      </div>

      <!--
        Tiket může platit jen na některé dny losování. Výchozí jsou všechny — tak se sází
        nejčastěji. Jedno slosování má den podle data, tiket z fotky dny podle hlavičky.
      -->
      <fieldset>
        <legend>Dny slosování</legend>
        @switch (puvodDnu()) {
          @case ('datum') {
            <p class="tlumene">Jedno slosování — den předvyplněný podle data.</p>
          }
          @case ('zavorka') {
            <p class="tlumene">Předvyplněno podle dnů v řádku SLOSOVÁNÍ na tiketu.</p>
          }
        }
        @for (den of nabidkaDnu(); track den) {
          <label><input data-cesta="slosovani.dny" type="checkbox" name="dny" [value]="den"
            [checked]="zaskrtnuteDny().includes(den)"
            (change)="prepniDen(den, $any($event.target).checked)" /> {{ nazevDne(den) }}</label>
        }
      </fieldset>

      @if (serioveCislo) {
        <p class="ze-skenu">
          <strong>Sériové číslo z čárového kódu:</strong>
          <span class="cislo">{{ serioveCislo }}</span><br />
          Porovnej ho prosím s číslem vytištěným na tiketu. Slouží jen k tomu, aby se tentýž
          tiket nezaložil dvakrát.<br />
          <span class="tlumene">
            Vsazená čísla ani kód doplňkové hry se z čárového kódu přečíst nedají — jsou
            v jeho šifrované části.
          </span>
          @if (!rozpoznanoZeSnimku) {
            <br /><a routerLink="/sken-cisel">Vyfotit čísla z tiketu</a>
            <span class="tlumene"> — sériové číslo zůstane zachované.</span>
          }
        </p>
      }

      @if (rozpoznanoZeSnimku && !serioveCislo) {
        <p class="ze-snimku">
          Z fotky se nepodařilo přečíst čárový kód, takže tiket nedostane sériové číslo
          a nepůjde poznat, že jde o tentýž tiket, kdyby ses ho pokusil přidat znovu.
          Můžeš <a routerLink="/sken">naskenovat samotný kód</a>, nebo to nechat být.
        </p>
      }

      @if (rozpoznanoZeSnimku) {
        <p class="ze-snimku">
          Čísla jsou rozpoznaná ze snímku — projdi je prosím proti papíru.
          @if (hraZFotky && hraPodle.length > 0) {
            {{ nazevHry(hraZFotky) }} podle: {{ hraPodle.join(', ') }}.
          }
          @if (opravene.length > 0) {
            Rozpoznávač musel opravit: {{ opravene.join(', ') }}.
          }
        </p>
      }

      <!--
        Diagnostika pro případ, že fotka něco nepřečetla. Text je jen tady na obrazovce
        (FLAG_SECURE), nikam se neukládá ani neloguje a s odchodem z formuláře zmizí.
        Díky ní jde selhání popsat přesně a udělat z něj test podle skutečného tiketu.
      -->
      @if (diagnostika.length > 0) {
        <details class="diagnostika">
          <summary>Co rozpoznávač z fotky přečetl</summary>
          <p class="tlumene">
            Řádky mimo sloupce a sloupce k ověření, tak jak je vrátil rozpoznávač. Zůstávají jen na téhle obrazovce a nikam se
            neukládají.
          </p>
          <ul>
            @for (radek of diagnostika; track $index) {
              <li class="cislo">{{ radek }}</li>
            }
          </ul>
        </details>
      }

      <h2>Sloupce</h2>
      @for (radek of radky(); track $index) {
        <div class="sloupec" [class.bez-druheho]="hra() === 'sportka'">
          <span class="poradi">{{ $index + 1 }}.</span>
          <input type="text" inputmode="numeric" [value]="radek.cisla" [attr.data-cesta]="'sloupce[' + $index + '].cisla'"
            [attr.aria-invalid]="chybyPole('sloupce[' + $index + '].cisla').length > 0"
            [attr.aria-label]="'Čísla sloupce ' + ($index + 1)"
            [placeholder]="napoveda().cisla"
            (input)="zmenCisla($index, $any($event.target).value)"
            (blur)="dotkni($index, 'cisla')" />
          @if (napoveda().druheOsudi; as druhe) {
            <input type="text" inputmode="numeric" class="euro" [value]="radek.druheOsudi" [attr.data-cesta]="'sloupce[' + $index + '].' + (hra() === 'eurojackpot' ? 'eurocisla' : 'druheOsudi')"
              [attr.aria-label]="napoveda().druheOsudiNazev" [placeholder]="druhe"
              (input)="zmenDruheOsudi($index, $any($event.target).value)"
              (blur)="dotkni($index, 'druhe')" />
          }
          @for (chyba of chybyPole('sloupce[' + $index + ']'); track $index) { <p class="chyba-pole">{{ chyba }}</p> }
          @if (radky().length > 1) {
            <button type="button" class="odebrat" (click)="odeber($index)" aria-label="Odebrat sloupec">×</button>
          }
        </div>
      }
      <button type="button" class="pridat" (click)="pridej()">Přidat sloupec</button>

      @if (nepokryteProblemy().length > 0) {
        <ul class="problemy">
          @for (problem of nepokryteProblemy(); track problem.cesta + problem.kod) {
            <li>{{ popisProblemu(problem) }}</li>
          }
        </ul>
      }

      <!--
        Rozsah kontroly je až dole: týká se toho, co s tiketem aplikace dělá, ne toho, co je
        na papíře. Předvyplní se podle tiketu; kdo sází pořád stejná čísla, rozšíří ho
        do minulosti nebo nechá konec prázdný a tiket se kontroluje s každým losováním.
      -->
      <label>{{ nazevDoplnkoveHry(hra()) }} — {{ delkaKodu() === 5 ? 'pět' : 'šest' }} číslic (nepovinné)
        <input data-cesta="kodDoplnkoveHry" type="text" inputmode="numeric" [attr.maxlength]="delkaKodu()"
          [placeholder]="delkaKodu() === 5 ? 'např. 37960' : 'např. 236412'"
          [value]="doplnkova()" (input)="doplnkova.set($any($event.target).value)" />
      @for (chyba of chybyPole('kodDoplnkoveHry'); track $index) { <span class="chyba-pole">{{ chyba }}</span> }
          </label>

      <label>Cena tiketu v Kč (nepovinné)
        <input data-cesta="cenaKc" type="number" min="0" step="any" inputmode="decimal" placeholder="např. 400"
          [value]="cenaPole()" (input)="cena.set($any($event.target).value)" />
      @for (chyba of chybyPole('cenaKc'); track $index) { <span class="chyba-pole">{{ chyba }}</span> }
          </label>
      @if (nesouhlasCeny(); as rozpis) {
        <p class="upozorneni">
          {{ rozpoznanoZeSnimku && cena() === cenaZeSnimku ? 'Cena přečtená z tiketu' : 'Zadaná cena' }}
          nesedí s ceníkem: {{ popisRozpisuCeny(hra(), rozpis) }}. Zkontroluj počet sloupců,
          {{ nazevDoplnkoveHry(hra()) }} a počet slosování.
        </p>
      } @else if (cena() === null && rozpisCeny(); as rozpis) {
        <p class="napoveda">Spočítáno podle ceníku: {{ popisRozpisuCeny(hra(), rozpis) }}.</p>
      }

      <details [open]="virtualni()">
        <summary>Rozsah kontroly{{ virtualni() ? ' · virtuální tiket' : '' }}</summary>
      <fieldset class="rozsah">
        <legend>Rozsah kontroly</legend>
        <div class="dvojice">
          <label>Od
            <input data-cesta="kontrola.od" type="date" [value]="odKontroly()"
              (input)="kontrolaOd.set($any($event.target).value)" />
          @for (chyba of chybyPole('kontrola.od'); track $index) { <span class="chyba-pole">{{ chyba }}</span> }
          </label>
          <label>Do
            <input data-cesta="kontrola.do" type="date" [value]="doKontroly() ?? ''"
              (input)="zmenDoKontroly($any($event.target).value)" />
          @for (chyba of chybyPole('kontrola.do'); track $index) { <span class="chyba-pole">{{ chyba }}</span> }
          </label>
        </div>
        <div class="tlacitka-rozsahu">
          @if (doKontroly() !== null) {
            <button type="button" (click)="bezKonce.set(true)">Kontrolovat bez konce</button>
          }
          @if (virtualni()) {
            <button type="button" (click)="podleTiketu()">Podle tiketu</button>
          }
        </div>

        @if (virtualni()) {
          <label>Cena za jedno slosování v Kč
            <input data-cesta="kontrola.cenaZaSlosovaniKc" type="number" min="0" step="any" inputmode="decimal"
              [placeholder]="cenaZaSlosovaniZCeniku() === null ? 'např. 400' : 'podle ceníku'"
              [value]="cenaZaSlosovaniPole()" (input)="cenaZaSlosovani.set($any($event.target).value)" />
          @for (chyba of chybyPole('kontrola.cenaZaSlosovaniKc'); track $index) { <span class="chyba-pole">{{ chyba }}</span> }
          </label>
          <p class="napoveda">
            Tiket bude <strong>virtuální</strong> — kontroluje se {{ popisRozsahuKontroly({ od: odKontroly(), do: doKontroly() }) }},
            podle vybraných dnů slosování, ne podle toho, na kolik slosování platí papír.
            @if (doKontroly() === null) {
              S každým dalším staženým losováním se zkontroluje znovu.
            }
            Stažené výsledky zatím pokrývají {{ pocetSlosovani(pokryto()) }}.
            @if (cenaZaSlosovaniKc() !== null) {
              Každé slosování se započte za zadanou cenu.
            } @else if (cenaZaSlosovaniZCeniku() !== null) {
              Bez zadané ceny se každé slosování započte za cenu podle ceníku platnou v jeho den
              (k {{ formatujDatum(prvni()) }} {{ formatujKc(cenaZaSlosovaniZCeniku()!) }}).
            } @else {
              Bez ceny se tiket do vsazených částek v přehledu nezapočte.
            }
          </p>
        } @else {
          <p class="napoveda">
            Předvyplněno podle tiketu. Změň začátek, nebo smaž konec, a tiket se bude kontrolovat
            i na další slosování — hodí se, když sázíš pořád stejná čísla.
          </p>
        }
      </fieldset>

      </details>

      @if (prekryv().length > 0) {
        <p class="upozorneni">
          Stejnou sázku už má uložený tiket na {{ pocetSlosovani(prekryv().length) }}
          ({{ prekryv().map(formatujDatum).join(', ') }}). Výhry i vsazené částky těch slosování
          se v přehledu započítají dvakrát.
        </p>
      }

      <!--
        Tlačítko se jmenuje podle toho, proč ho uživatel mačká, ne podle toho, co dělá uvnitř.
        Uložení je vedlejší efekt, důvod je zjistit, jestli tiket vyhrál.
      -->
      @if (chybaUlozeni(); as chyba) { <p role="alert" class="chyba-akce">{{ chyba }}</p> }
      <button type="submit" class="ulozit" [disabled]="uklada()">
        Zkontrolovat tiket
      </button>
      <p class="pod-tlacitkem">Tiket se zároveň uloží do seznamu, ať ho můžeš zkontrolovat i po dalších losováních.</p>
    </form>
  `,
  styles: `
    .chyba-pole { display: block; color: var(--barva-chyba); grid-column: 1 / -1; margin: .25rem 0; font-size: .85rem; }
    input[aria-invalid=true] { border-color: var(--barva-chyba); }
    form { display: grid; gap: 1rem; }
    fieldset { min-width: 0; border: 1px solid var(--barva-ram); border-radius: .75rem; padding: .85rem; }
    fieldset > label:has(input[type=radio]), fieldset > label:has(input[type=checkbox]) { display: flex; align-items: center; min-height: 48px; gap: .5rem; }
    label { display: block; font-size: 0.85rem; }
    input[type='text'], input[type='date'], input[type='number'] {
      width: 100%; min-width: 0; padding: 0.45rem; margin-top: 0.2rem;
      border: 1px solid var(--barva-ram); border-radius: 4px;
      background: var(--barva-plocha); color: inherit; font: inherit;
    }
    .dvojice { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    .rozsah { display: grid; gap: 0.6rem; }
    .tlacitka-rozsahu { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .tlacitka-rozsahu:empty { display: none; }
    .tlacitka-rozsahu button {
      padding: 0.35rem 0.7rem; border: 1px solid var(--barva-ram); border-radius: 4px;
      background: var(--barva-plocha); color: inherit; font: inherit; font-size: 0.85rem; cursor: pointer;
    }
    .napoveda { margin: 0; font-size: 0.8rem; line-height: 1.45; color: var(--barva-text-tlumeny); }
    form h2 { margin: 0.5rem 0 0; font-size: 1.1rem; }
    .sloupec { display: grid; grid-template-columns: 1.25rem minmax(0, 1fr) minmax(4rem, 6rem) auto; gap: .4rem; align-items: center; }
    .sloupec.bez-druheho { grid-template-columns: 1.25rem minmax(0, 1fr) auto; }
    .sloupec .poradi { grid-column: 1; grid-row: 1; }
    .sloupec input:not(.euro) { grid-column: 2; grid-row: 1; }
    .sloupec .euro { grid-column: 3; grid-row: 1; }
    .sloupec .odebrat { grid-column: 4; grid-row: 1; }
    .sloupec.bez-druheho .odebrat { grid-column: 3; }
    @media (max-width: 480px) {
      .dvojice { grid-template-columns: minmax(0, 1fr); }
      .sloupec { grid-template-columns: 1.25rem minmax(0, 1fr) auto; }
      .sloupec .euro { grid-column: 2; grid-row: 2; }
      .sloupec .odebrat { grid-column: 3; }
    }
    .poradi { width: 1.5rem; color: var(--barva-text-tlumeny); font-variant-numeric: tabular-nums; }
    .euro { max-width: 8rem; }
    .odebrat, .pridat, .ulozit {
      padding: 0.45rem 0.8rem; border: 1px solid var(--barva-ram); border-radius: 4px;
      background: var(--barva-plocha); color: inherit; font: inherit; cursor: pointer;
    }
    .ulozit { background: var(--barva-duraz); color: var(--barva-pozadi); border-color: transparent; }
    .problemy { margin: 0; padding-left: 1.1rem; color: var(--barva-chyba); font-size: 0.85rem; }
    .pod-tlacitkem {
      margin: -0.5rem 0 0; font-size: 0.78rem; color: var(--barva-text-tlumeny);
    }
    .ze-snimku, .ze-skenu {
      margin: 0; padding: 0.6rem 0.75rem; background: var(--barva-plocha);
      border-left: 3px solid var(--barva-duraz); font-size: 0.85rem; line-height: 1.5;
    }
    .cislo {
      font-family: ui-monospace, monospace; font-size: 1rem;
      letter-spacing: 0.06em; word-break: break-all;
    }
    .tlumene { color: var(--barva-text-tlumeny); }
    .upozorneni {
      margin: 0; padding: 0.6rem 0.75rem; background: var(--barva-plocha);
      border-left: 3px solid var(--barva-chyba); font-size: 0.85rem; line-height: 1.5;
    }
    .diagnostika { font-size: 0.85rem; }
    .diagnostika summary { cursor: pointer; color: var(--barva-text-tlumeny); }
    .diagnostika ul { margin: 0.4rem 0 0; padding-left: 1.1rem; }
    .diagnostika .cislo { font-size: 0.8rem; }
  `,
})
export class NovyTiket {
  private readonly stav = inject(Stav);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly uklada = signal(false);
  protected readonly chybaUlozeni = signal<string | null>(null);
  private readonly router = inject(Router);

  /**
   * Sériové číslo z naskenovaného čárového kódu, pokud uživatel přišel ze skenu.
   * Zobrazuje se, aby bylo vidět, že sken vyšel, a šlo ho porovnat s papírem.
   * (Číslo klubové karty se z kódu nikdy nečte — není ani v návratovém typu.)
   */
  private readonly naskenovany = inject(NaskenovanyTiket);
  protected readonly serioveCislo = this.naskenovany.precti();
  protected readonly nazev = signal<string | null>(null);
  protected readonly nazevPole = computed(() => this.nazev() ??
    this.stav.tikety().find(t => t.id === this.serioveCislo)?.nazev ?? '');

  /** Čísla rozpoznaná ze snímku. Jsou jen návrh — uživatel je tu potvrzuje a opravuje. */
  private readonly nacteny = inject(NactenaCisla).vyzvedni();
  private readonly rozpoznane = this.nacteny?.cteni ?? null;
  /** Čím se hra z fotky poznala. Zobrazuje se, ať je špatně určená hra hned vidět. */
  protected readonly hraPodle = this.nacteny?.hraPodle ?? [];
  protected readonly hraZFotky = this.rozpoznane?.hra ?? null;

  // Hra z fotky má přednost; po samotném skenu kódu poslouží hra z jeho hlavičky.
  protected readonly hra = signal<Hra>(
    this.rozpoznane?.hra ?? this.naskenovany.prectiHru() ?? 'eurojackpot',
  );
  // Ruční zadání předvyplní dnešek. Tiket z fotky ne: nepřečtené datum musí zůstat prázdné,
  // jinak by se tiket potichu vyhodnotil proti dnešnímu tahu místo toho na papíře.
  protected readonly prvni = signal(
    this.rozpoznane === null
      ? new Date().toISOString().slice(0, 10)
      : (this.rozpoznane.hlavicka.datum ?? ''),
  );
  protected readonly chybiDatum = computed(() => this.rozpoznane !== null && this.prvni() === '');
  protected readonly pocet = signal(this.rozpoznane?.hlavicka.pocetSlosovani ?? 1);
  /**
   * Vsazené dny odvozené z formuláře, nebo `null` pro všechny (`vsazeneDny`): jedno slosování
   * podle data, víc slosování podle závorky z fotky, když výběr dokazuje. Počítá se z toho, co
   * ve formuláři právě je, takže den sleduje i ručně zadané nebo opravené datum.
   */
  private readonly odvozeneDny = computed(
    () =>
      vsazeneDny(
        {
          pocetSlosovani: this.pocet(),
          dny: this.rozpoznane?.hlavicka.dny ?? null,
          datum: this.prvni() === '' ? null : this.prvni(),
        },
        this.hra(),
      ),
    { equal: stejneDny },
  );
  /**
   * Zaškrtnuté dny. Předvyplní se z `odvozeneDny` (jinak všechny dny hry) a vrátí se k nim,
   * jen když se odvozené dny opravdu změní — ruční výběr přežije třeba přepsání ceny i počtu
   * slosování, který na odvozených dnech nic nemění.
   */
  protected readonly zaskrtnuteDny = linkedSignal<readonly Den[]>(
    () => this.odvozeneDny() ?? DNY_LOSOVANI[this.hra()],
  );
  protected readonly puvodDnu = computed(() =>
    this.odvozeneDny() === null ? null : this.pocet() === 1 ? 'datum' : 'zavorka',
  );
  protected readonly nabidkaDnu = computed(() => DNY_LOSOVANI[this.hra()]);
  protected readonly nazevDne = nazevDne;
  protected readonly nazevHry = nazevHry;
  protected readonly nazevDoplnkoveHry = nazevDoplnkoveHry;
  protected readonly hry = HRY;
  protected readonly napoveda = computed(() => napoveda(this.hra()));
  protected readonly delkaKodu = computed(() => DELKA_KODU_DOPLNKOVE_HRY[this.hra()]);
  protected readonly doplnkova = signal(this.rozpoznane?.kodDoplnkoveHry ?? '');
  /** Cena přečtená z fotky, jak ji formulář předvyplnil. */
  protected readonly cenaZeSnimku =
    this.rozpoznane?.cenaKc === null || this.rozpoznane?.cenaKc === undefined
      ? null
      : String(this.rozpoznane.cenaKc);
  /** Co je v poli ceny napsané. `null` = uživatel nic nezadal, pole se plní z ceníku. */
  protected readonly cena = signal<string | null>(this.cenaZeSnimku);
  protected readonly radky = signal<Radek[]>(
    this.rozpoznane === null || this.rozpoznane.sloupce.length === 0
      ? [PRAZDNY_RADEK]
      : // Čísla ze snímku se mají projít hned, proto jsou jejich chyby vidět od začátku.
        this.rozpoznane.sloupce.map((s) => ({
          cisla: s.cisla.join(' '),
          druheOsudi: s.druheOsudi.join(' '),
          dotceno: { cisla: true, druhe: true },
        })),
  );

  /** Řádky z fotky, které se nepoužily, a sloupce s problémem nebo opravou. */
  protected readonly diagnostika: readonly string[] =
    this.rozpoznane === null
      ? []
      : [
          ...this.rozpoznane.nepouziteRadky,
          ...this.rozpoznane.sloupce
            .filter((s) => s.problemy.length > 0 || s.opravene.length > 0)
            .map((s) => s.text),
        ];

  /** Útržky, které bylo potřeba opravit. Uživateli se zvýrazní, ať je zkontroluje. */
  protected readonly opravene = (this.rozpoznane?.sloupce ?? []).flatMap((s) => s.opravene);

  private readonly kodDoplnkoveHry = computed(() =>
    this.doplnkova().trim() === '' ? null : this.doplnkova().trim(),
  );

  /**
   * Cena tiketu podle ceníku. Počítá se z formuláře, ne z návrhu tiketu — návrh cenu
   * obsahuje, takže by na sobě závisely dokola.
   */
  protected readonly rozpisCeny = computed(() =>
    rozpisCenyTiketu(
      {
        hra: this.hra(),
        sloupce: this.sloupce(),
        slosovani: { prvni: this.prvni(), pocet: this.pocet(), dny: null },
        kodDoplnkoveHry: this.kodDoplnkoveHry(),
      },
      this.stav.ceny(),
    ),
  );
  protected readonly cenaPole = computed(() => this.cena() ?? String(this.rozpisCeny()?.celkemKc ?? ''));
  /** Rozpis ceny, když zadaná nebo přečtená cena nesedí s ceníkem. */
  protected readonly nesouhlasCeny = computed(() => {
    const rozpis = this.rozpisCeny();
    const zadana = this.cena() === null ? null : prectiCastku(this.cena()!);
    return rozpis !== null && zadana !== null && zadana !== rozpis.celkemKc ? rozpis : null;
  });

  // Rozsah kontroly. Dokud ho uživatel nezmění, řídí se papírem: `null` znamená „podle tiketu“.
  protected readonly kontrolaOd = signal<string | null>(null);
  private readonly kontrolaDo = signal<string | null>(null);
  protected readonly bezKonce = signal(false);
  protected readonly cenaZaSlosovani = signal<string | null>(null);

  private readonly papir = computed<Papir>(() => ({
    hra: this.hra(),
    slosovani: { prvni: this.prvni(), pocet: this.pocet(), dny: dnyZVyberu(this.hra(), this.zaskrtnuteDny()) },
    cenaKc: prectiCastku(this.cenaPole()),
  }));

  private readonly konecPodleTiketu = computed(() => konecPodlePapiru(this.papir(), this.stav.tahy()));
  protected readonly odKontroly = computed(() => this.kontrolaOd() ?? this.prvni());
  protected readonly doKontroly = computed(() =>
    this.bezKonce() ? null : (this.kontrolaDo() ?? this.konecPodleTiketu() ?? ''),
  );
  /**
   * Výchozí cena za slosování virtuálního tiketu: prázdná, když ceník cenu zná — pak se každé
   * slosování počítá za cenu platnou v jeho den. Jinak podle papíru.
   */
  protected readonly cenaZaSlosovaniVychozi = computed(() =>
    this.rozpisCeny() !== null ? null : cenaZaSlosovaniZPapiru(this.papir()),
  );
  /** Kolik stojí jedno slosování podle ceníku k datu prvního slosování, pro nápovědu v poli. */
  protected readonly cenaZaSlosovaniZCeniku = computed(() => {
    const rozpis = this.rozpisCeny();
    return rozpis === null ? null : rozpis.celkemKc / rozpis.slosovani;
  });
  protected readonly cenaZaSlosovaniPole = computed(
    () => this.cenaZaSlosovani() ?? String(this.cenaZaSlosovaniVychozi() ?? ''),
  );
  protected readonly cenaZaSlosovaniKc = computed(() => prectiCastku(this.cenaZaSlosovaniPole()));

  private readonly kontrola = computed(() =>
    this.prvni() === ''
      ? null
      : sestavKontrolu(this.papir(), this.odKontroly(), this.doKontroly(), this.cenaZaSlosovaniKc(), this.stav.tahy()),
  );
  protected readonly virtualni = computed(() => this.kontrola() !== null);

  /** Kolik slosování z rozsahu už mají stažené výsledky. */
  protected readonly pokryto = computed(() => vyberSlosovani(this.navrh(), this.stav.tahy()).pouzite.length);

  /** Slosování, na která už stejnou sázku kontroluje jiný uložený tiket. */
  protected readonly prekryv = computed(() => {
    const navrh = this.navrh();
    const stejne = this.stav.tikety().filter((t) => t.id !== navrh.id && stejnaSazka(t, navrh));
    if (stejne.length === 0) return [];
    const data = (prekryvy([navrh, ...stejne], this.stav.tahy()).get(navrh.id) ?? []).flatMap((p) => p.data);
    return [...new Set(data)].sort();
  });

  private readonly sloupce = computed<readonly Sloupec[]>(() => {
    const hra = this.hra();
    return this.radky().map((radek): Sloupec => {
      const cisla = prectiCisla(radek.cisla).map((c) => c.hodnota);
      const druhe = prectiCisla(radek.druheOsudi).map((c) => c.hodnota);
      switch (hra) {
        case 'eurojackpot':
          return { hra, cisla, eurocisla: druhe };
        case 'euromiliony':
          return { hra, cisla, druheOsudi: druhe };
        case 'sportka':
          return { hra, cisla };
      }
    });
  });

  protected readonly navrh = computed<Tiket>(() => {
    const hra = this.hra();
    const sloupce = this.sloupce();
    const kontrola = this.kontrola();
    return {
      ...(kontrola === null ? {} : { kontrola }),
      ...(this.nazev() === null ? {} : { nazev: this.nazev() }),
      // Sériové číslo z kódu je nejlepší identifikátor — díky němu druhý sken téhož tiketu
      // nevytvoří duplicitu. Ručně zadaný tiket ho nemá, tak si vyrobí vlastní.
      // Virtuální tiket má vlastní předponu, jinak by ho ručně zadaný papírový tiket se stejnými
      // čísly a datem přepsal.
      id:
        this.serioveCislo ??
        `${kontrola === null ? 'rucni' : 'virtualni'}-${this.prvni()}-${sloupce.map((s) => s.cisla.join('.')).join('_')}`,
      hra,
      sloupce,
      slosovani: {
        prvni: this.prvni(),
        pocet: this.pocet(),
        dny: dnyZVyberu(hra, this.zaskrtnuteDny()),
      },
      kodDoplnkoveHry: this.kodDoplnkoveHry(),
      cenaKc: this.papir().cenaKc,
      vlozeno: new Date().toISOString(),
    };
  });

  protected readonly problemy = computed(() => {
    const problemy = zkontrolujTiket(this.navrh());
    if (!this.prvni()) problemy.push({ kod: 'spatne-datum', cesta: 'slosovani.prvni', zprava: 'Vyplň datum prvního slosování.' });
    const cena = this.cena();
    if (cena !== null && cena.trim() !== '' && (prectiCastku(cena) === null || prectiCastku(cena)! < 0)) {
      problemy.push({ kod: 'spatna-cena', cesta: 'cenaKc', zprava: 'Cena musí být nezáporná částka.' });
    }
    return problemy;
  });

  /** Stisk „Zkontrolovat tiket“ ukáže všechny chyby, i v polích, kam uživatel nesáhl. */
  private readonly odeslano = signal(false);

  /**
   * Chyby sloupce se ukážou až po opuštění pole. Ostatní hned — výchozí hodnoty jsou platné,
   * takže chyba tam vznikne jen úpravou.
   */
  protected readonly viditelneProblemy = computed(() => {
    if (this.odeslano()) return this.problemy();
    const radky = this.radky();
    return this.problemy().filter((problem) => {
      const misto = mistoVeSloupci(problem.cesta);
      return misto === null || radky[misto.index]?.dotceno[misto.pole] === true;
    });
  });

  protected chybyPole(cesta: string): string[] {
    return this.viditelneProblemy().filter(p => patriPoli(p.cesta, cesta)).map(p => popisProblemu(p));
  }

  /** Chyby, které nevypisuje žádné pole — ty a jen ty patří do souhrnného seznamu. */
  protected readonly nepokryteProblemy = computed(() => {
    const sloupce = this.radky().map((_, i) => `sloupce[${i}]`);
    return this.viditelneProblemy().filter(
      p => ![...CESTY_POLI, ...sloupce].some(pole => patriPoli(p.cesta, pole)),
    );
  });

  protected readonly popisProblemu = popisProblemu;
  protected readonly popisRozpisuCeny = popisRozpisuCeny;

  protected readonly rozpoznanoZeSnimku = this.rozpoznane !== null;

  protected readonly formatujDatum = formatujDatum;
  protected readonly formatujKc = formatujKc;
  protected readonly pocetSlosovani = pocetSlosovani;
  protected readonly popisRozsahuKontroly = popisRozsahuKontroly;

  /** Smazané datum konce znamená kontrolu bez konce. */
  protected zmenDoKontroly(hodnota: string): void {
    this.bezKonce.set(hodnota === '');
    this.kontrolaDo.set(hodnota === '' ? null : hodnota);
  }

  protected podleTiketu(): void {
    this.kontrolaOd.set(null);
    this.kontrolaDo.set(null);
    this.bezKonce.set(false);
    this.cenaZaSlosovani.set(null);
  }

  protected zmenHru(hra: Hra): void {
    this.hra.set(hra);
    // Jiná hra má jiné dny losování; výběr se vrátí k výchozímu i tehdy, když se odvozené dny
    // náhodou nezměnily (u obou her `null`).
    this.zaskrtnuteDny.set(this.odvozeneDny() ?? DNY_LOSOVANI[hra]);
  }

  protected prepniDen(den: Den, zaskrtnuto: boolean): void {
    this.zaskrtnuteDny.update((dny) =>
      zaskrtnuto ? [...dny.filter((d) => d !== den), den] : dny.filter((d) => d !== den),
    );
  }

  protected zmenCisla(index: number, hodnota: string): void {
    this.radky.update((r) => r.map((radek, i) => (i === index ? { ...radek, cisla: hodnota } : radek)));
  }

  protected zmenDruheOsudi(index: number, hodnota: string): void {
    this.radky.update((r) =>
      r.map((radek, i) => (i === index ? { ...radek, druheOsudi: hodnota } : radek)),
    );
  }

  protected dotkni(index: number, pole: PoleSloupce): void {
    if (this.radky()[index]?.dotceno[pole] !== false) return;
    this.radky.update((r) =>
      r.map((radek, i) => (i === index ? { ...radek, dotceno: { ...radek.dotceno, [pole]: true } } : radek)),
    );
  }

  protected pridej(): void {
    if (this.radky().length >= NEJVIC_SLOUPCU[this.hra()]) return;
    this.radky.update((r) => [...r, PRAZDNY_RADEK]);
  }

  protected odeber(index: number): void {
    this.radky.update((r) => r.filter((_, i) => i !== index));
  }

  /** Rozbalí sekci, ve které pole leží, a zaostří ho — jinak by chyba zůstala skrytá. */
  private odkryjAZaostri(pole: HTMLElement | undefined): void {
    const rozsah = pole?.closest('details');
    if (rozsah) rozsah.open = true;
    pole?.focus();
  }

  protected async uloz(udalost: Event): Promise<void> {
    udalost.preventDefault();
    this.odeslano.set(true);
    if (this.uklada()) return;
    if (this.problemy().length > 0 || this.prvni() === '') {
      requestAnimationFrame(() => {
        const cesta = this.problemy()[0]?.cesta ?? 'slosovani.prvni';
        this.odkryjAZaostri([...this.element.nativeElement.querySelectorAll<HTMLElement>('[data-cesta]')]
          .find(el => cesta.startsWith(el.dataset['cesta']!)));
      });
      return;
    }
    const form = udalost.target as HTMLFormElement;
    // Nejdřív checkValidity: bublinu na skrytém prvku prohlížeč neukáže, takže se sekce
    // s neplatným polem musí rozbalit dřív, než o hlášku požádáme.
    if (!form.checkValidity()) {
      this.odkryjAZaostri(form.querySelector<HTMLElement>('input:invalid, select:invalid, textarea:invalid') ?? undefined);
      form.reportValidity();
      return;
    }
    const tiket = this.navrh();
    this.uklada.set(true);
    this.chybaUlozeni.set(null);
    try {
      await this.stav.ulozTiket(tiket);
    } catch {
      this.chybaUlozeni.set('Tiket se nepodařilo uložit. Zadané údaje zůstaly ve formuláři.');
      return;
    } finally { this.uklada.set(false); }
    // Průchozí údaje ze skenu už splnily účel.
    this.naskenovany.zapomen();
    await this.router.navigate(['/tiket', tiket.id]);
  }
}
