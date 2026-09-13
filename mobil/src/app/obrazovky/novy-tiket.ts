import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  DELKA_KODU_DOPLNKOVE_HRY,
  DNY_LOSOVANI,
  dnyZVyberu,
  ROZSAHY,
  zkontrolujTiket,
  type Den,
  type Hra,
  type Sloupec,
  type Tiket,
} from '@kontrola-tiketu/jadro';
import { prectiCisla } from '@kontrola-tiketu/ocr';
import { HRY, nazevDne, nazevDoplnkoveHry, nazevHry } from '../data/format.js';
import { NactenaCisla, NaskenovanyTiket } from '../data/sken.js';
import { Stav } from '../data/stav.js';

interface Radek {
  cisla: string;
  /** Euročísla (Eurojackpot) nebo číslo z druhého osudí (Euromiliony). */
  druheOsudi: string;
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
@Component({
  selector: 'app-novy-tiket',
  imports: [RouterLink],
  template: `
    <form (submit)="uloz($event)">
      <fieldset>
        <legend>Hra</legend>
        @for (h of hry; track h) {
          <label><input type="radio" name="hra" [attr.value]="h"
            [checked]="hra() === h" (change)="zmenHru(h)" /> {{ nazevHry(h) }}</label>
        }
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

      <!--
        Tiket může platit jen na některé dny losování. Výchozí jsou všechny — tak se sází
        nejčastěji a tak se tiket choval, než výběr přibyl.
      -->
      <fieldset>
        <legend>Dny slosování</legend>
        @for (den of nabidkaDnu(); track den) {
          <label><input type="checkbox" name="dny" [value]="den"
            [checked]="zaskrtnuteDny().includes(den)"
            (change)="prepniDen(den, $any($event.target).checked)" /> {{ nazevDne(den) }}</label>
        }
      </fieldset>

      <label>Cena tiketu v Kč (nepovinné)
        <input type="number" min="0" step="1" inputmode="numeric" placeholder="např. 400"
          [value]="cena()" (input)="cena.set($any($event.target).value)" />
      </label>

      <label>{{ nazevDoplnkoveHry(hra()) }} — {{ delkaKodu() === 5 ? 'pět' : 'šest' }} číslic (nepovinné)
        <input type="text" inputmode="numeric" [attr.maxlength]="delkaKodu()"
          [placeholder]="delkaKodu() === 5 ? 'např. 37960' : 'např. 236412'"
          [value]="doplnkova()" (input)="doplnkova.set($any($event.target).value)" />
      </label>

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
          @if (opravene.length > 0) {
            Rozpoznávač musel opravit: {{ opravene.join(', ') }}.
          }
        </p>
      }

      <h2>Sloupce</h2>
      @for (radek of radky(); track $index) {
        <div class="sloupec">
          <span class="poradi">{{ $index + 1 }}.</span>
          <input type="text" inputmode="numeric" [value]="radek.cisla"
            [attr.aria-label]="'Čísla sloupce ' + ($index + 1)"
            [placeholder]="napoveda().cisla"
            (input)="zmenCisla($index, $any($event.target).value)" />
          @if (napoveda().druheOsudi; as druhe) {
            <input type="text" inputmode="numeric" class="euro" [value]="radek.druheOsudi"
              [attr.aria-label]="napoveda().druheOsudiNazev" [placeholder]="druhe"
              (input)="zmenDruheOsudi($index, $any($event.target).value)" />
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

      <!--
        Tlačítko se jmenuje podle toho, proč ho uživatel mačká, ne podle toho, co dělá uvnitř.
        Uložení je vedlejší efekt, důvod je zjistit, jestli tiket vyhrál.
      -->
      <button type="submit" class="ulozit" [disabled]="problemy().length > 0">
        Zkontrolovat tiket
      </button>
      <p class="pod-tlacitkem">Tiket se zároveň uloží do seznamu, ať ho můžeš zkontrolovat i po dalších losováních.</p>
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
  `,
})
export class NovyTiket {
  private readonly stav = inject(Stav);
  private readonly router = inject(Router);

  /**
   * Sériové číslo z naskenovaného čárového kódu, pokud uživatel přišel ze skenu.
   * Zobrazuje se, aby bylo vidět, že sken vyšel, a šlo ho porovnat s papírem.
   * (Číslo klubové karty se z kódu nikdy nečte — není ani v návratovém typu.)
   */
  private readonly naskenovany = inject(NaskenovanyTiket);
  protected readonly serioveCislo = this.naskenovany.precti();

  /** Čísla rozpoznaná ze snímku. Jsou jen návrh — uživatel je tu potvrzuje a opravuje. */
  private readonly rozpoznane = inject(NactenaCisla).vyzvedni();

  protected readonly hra = signal<Hra>(this.rozpoznane?.hra ?? 'eurojackpot');
  protected readonly prvni = signal(
    this.rozpoznane?.hlavicka.datum ?? new Date().toISOString().slice(0, 10),
  );
  protected readonly pocet = signal(this.rozpoznane?.hlavicka.pocetSlosovani ?? 1);
  // Den v závorce hlavičky se sem zatím nepropisuje: bez tiketu vsazeného na vybrané dny
  // nevíme, jestli znamená den prvního slosování, nebo výběr dnů.
  protected readonly zaskrtnuteDny = signal<readonly Den[]>(DNY_LOSOVANI[this.hra()]);
  protected readonly nabidkaDnu = computed(() => DNY_LOSOVANI[this.hra()]);
  protected readonly nazevDne = nazevDne;
  protected readonly nazevHry = nazevHry;
  protected readonly nazevDoplnkoveHry = nazevDoplnkoveHry;
  protected readonly hry = HRY;
  protected readonly napoveda = computed(() => napoveda(this.hra()));
  protected readonly delkaKodu = computed(() => DELKA_KODU_DOPLNKOVE_HRY[this.hra()]);
  protected readonly doplnkova = signal(this.rozpoznane?.kodDoplnkoveHry ?? '');
  protected readonly cena = signal(
    this.rozpoznane?.cenaKc === null || this.rozpoznane?.cenaKc === undefined
      ? ''
      : String(this.rozpoznane.cenaKc),
  );
  protected readonly radky = signal<Radek[]>(
    this.rozpoznane === null || this.rozpoznane.sloupce.length === 0
      ? [{ cisla: '', druheOsudi: '' }]
      : this.rozpoznane.sloupce.map((s) => ({
          cisla: s.cisla.join(' '),
          druheOsudi: s.druheOsudi.join(' '),
        })),
  );

  /** Útržky, které bylo potřeba opravit. Uživateli se zvýrazní, ať je zkontroluje. */
  protected readonly opravene = (this.rozpoznane?.sloupce ?? []).flatMap((s) => s.opravene);

  protected readonly navrh = computed<Tiket>(() => {
    const hra = this.hra();
    const sloupce: Sloupec[] = this.radky().map((radek): Sloupec => {
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

    return {
      // Sériové číslo z kódu je nejlepší identifikátor — díky němu druhý sken téhož tiketu
      // nevytvoří duplicitu. Ručně zadaný tiket ho nemá, tak si vyrobí vlastní.
      id:
        this.serioveCislo ??
        `rucni-${this.prvni()}-${sloupce.map((s) => s.cisla.join('.')).join('_')}`,
      hra,
      sloupce,
      slosovani: {
        prvni: this.prvni(),
        pocet: this.pocet(),
        dny: dnyZVyberu(hra, this.zaskrtnuteDny()),
      },
      kodDoplnkoveHry: this.doplnkova().trim() === '' ? null : this.doplnkova().trim(),
      cenaKc: this.cena().trim() === '' ? null : Number(this.cena()),
      vlozeno: new Date().toISOString(),
    };
  });

  protected readonly problemy = computed(() => zkontrolujTiket(this.navrh()));

  protected readonly rozpoznanoZeSnimku = this.rozpoznane !== null;

  protected zmenHru(hra: Hra): void {
    this.hra.set(hra);
    this.zaskrtnuteDny.set(DNY_LOSOVANI[hra]);
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

  protected pridej(): void {
    if (this.radky().length >= NEJVIC_SLOUPCU[this.hra()]) return;
    this.radky.update((r) => [...r, { cisla: '', druheOsudi: '' }]);
  }

  protected odeber(index: number): void {
    this.radky.update((r) => r.filter((_, i) => i !== index));
  }

  protected async uloz(udalost: Event): Promise<void> {
    udalost.preventDefault();
    if (this.problemy().length > 0) return;
    const tiket = this.navrh();
    await this.stav.ulozTiket(tiket);
    // Průchozí údaje ze skenu už splnily účel.
    this.naskenovany.zapomen();
    await this.router.navigate(['/tiket', tiket.id]);
  }
}
