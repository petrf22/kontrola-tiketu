import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  DELKA_KODU_DOPLNKOVE_HRY,
  DNY_LOSOVANI,
  dnyZVyberu,
  prekryvy,
  ROZSAHY,
  stejnaSazka,
  vyberSlosovani,
  zkontrolujTiket,
  type Den,
  type Hra,
  type Sloupec,
  type Tiket,
} from '@kontrola-tiketu/jadro';
import { prectiCisla } from '@kontrola-tiketu/ocr';
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
  popisRozsahuKontroly,
  type PoleSloupce,
} from '../data/format.js';
import { NactenaCisla, NaskenovanyTiket } from '../data/sken.js';
import { Stav } from '../data/stav.js';

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

      @if (chybiDatum()) {
        <p class="upozorneni">
          Datum prvního slosování se z fotky nepřečetlo — opiš ho prosím z tiketu, z řádku
          SLOSOVÁNÍ. Bez něj by se tiket vyhodnotil proti jinému tahu.
        </p>
      }

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
        <div class="sloupec">
          <span class="poradi">{{ $index + 1 }}.</span>
          <input type="text" inputmode="numeric" [value]="radek.cisla"
            [attr.aria-label]="'Čísla sloupce ' + ($index + 1)"
            [placeholder]="napoveda().cisla"
            (input)="zmenCisla($index, $any($event.target).value)"
            (blur)="dotkni($index, 'cisla')" />
          @if (napoveda().druheOsudi; as druhe) {
            <input type="text" inputmode="numeric" class="euro" [value]="radek.druheOsudi"
              [attr.aria-label]="napoveda().druheOsudiNazev" [placeholder]="druhe"
              (input)="zmenDruheOsudi($index, $any($event.target).value)"
              (blur)="dotkni($index, 'druhe')" />
          }
          @if (radky().length > 1) {
            <button type="button" class="odebrat" (click)="odeber($index)" aria-label="Odebrat sloupec">×</button>
          }
        </div>
      }
      <button type="button" class="pridat" (click)="pridej()">Přidat sloupec</button>

      @if (viditelneProblemy().length > 0) {
        <ul class="problemy">
          @for (problem of viditelneProblemy(); track problem.cesta + problem.kod) {
            <li>{{ popisProblemu(problem) }}</li>
          }
        </ul>
      }

      <!--
        Rozsah kontroly je až dole: týká se toho, co s tiketem aplikace dělá, ne toho, co je
        na papíře. Předvyplní se podle tiketu; kdo sází pořád stejná čísla, rozšíří ho
        do minulosti nebo nechá konec prázdný a tiket se kontroluje s každým losováním.
      -->
      <fieldset class="rozsah">
        <legend>Rozsah kontroly</legend>
        <div class="dvojice">
          <label>Od
            <input type="date" [value]="odKontroly()"
              (input)="kontrolaOd.set($any($event.target).value)" />
          </label>
          <label>Do
            <input type="date" [value]="doKontroly() ?? ''"
              (input)="zmenDoKontroly($any($event.target).value)" />
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
            <input type="number" min="0" step="any" inputmode="decimal"
              [placeholder]="cenaZaSlosovaniVychozi() === null ? 'např. 400' : ''"
              [value]="cenaZaSlosovaniPole()" (input)="cenaZaSlosovani.set($any($event.target).value)" />
          </label>
          <p class="napoveda">
            Tiket bude <strong>virtuální</strong> — kontroluje se {{ popisRozsahuKontroly({ od: odKontroly(), do: doKontroly() }) }},
            podle vybraných dnů slosování, ne podle toho, na kolik slosování platí papír.
            @if (doKontroly() === null) {
              S každým dalším staženým losováním se zkontroluje znovu.
            }
            Stažené výsledky zatím pokrývají {{ pocetSlosovani(pokryto()) }}.
            @if (cenaZaSlosovaniKc() === null) {
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
      <button type="submit" class="ulozit">
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
    .rozsah { display: grid; gap: 0.6rem; }
    .tlacitka-rozsahu { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .tlacitka-rozsahu:empty { display: none; }
    .tlacitka-rozsahu button {
      padding: 0.35rem 0.7rem; border: 1px solid var(--barva-ram); border-radius: 4px;
      background: var(--barva-plocha); color: inherit; font: inherit; font-size: 0.85rem; cursor: pointer;
    }
    .napoveda { margin: 0; font-size: 0.8rem; line-height: 1.45; color: var(--barva-text-tlumeny); }
    h2 { margin: 0.5rem 0 0; font-size: 1rem; }
    .sloupec { display: flex; gap: 0.4rem; align-items: center; }
    .poradi { width: 1.5rem; color: var(--barva-text-tlumeny); font-variant-numeric: tabular-nums; }
    .euro { max-width: 8rem; }
    .odebrat, .pridat, .ulozit {
      padding: 0.45rem 0.8rem; border: 1px solid var(--barva-ram); border-radius: 4px;
      background: var(--barva-plocha); color: inherit; font: inherit; cursor: pointer;
    }
    .ulozit { background: var(--barva-duraz); color: #fff; border-color: transparent; }
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
  // Ruční zadání předvyplní dnešek. Tiket z fotky ne: nepřečtené datum musí zůstat prázdné,
  // jinak by se tiket potichu vyhodnotil proti dnešnímu tahu místo toho na papíře.
  protected readonly prvni = signal(
    this.rozpoznane === null
      ? new Date().toISOString().slice(0, 10)
      : (this.rozpoznane.hlavicka.datum ?? ''),
  );
  protected readonly chybiDatum = computed(() => this.rozpoznane !== null && this.prvni() === '');
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

  // Rozsah kontroly. Dokud ho uživatel nezmění, řídí se papírem: `null` znamená „podle tiketu“.
  protected readonly kontrolaOd = signal<string | null>(null);
  private readonly kontrolaDo = signal<string | null>(null);
  protected readonly bezKonce = signal(false);
  protected readonly cenaZaSlosovani = signal<string | null>(null);

  private readonly papir = computed<Papir>(() => ({
    hra: this.hra(),
    slosovani: { prvni: this.prvni(), pocet: this.pocet(), dny: dnyZVyberu(this.hra(), this.zaskrtnuteDny()) },
    cenaKc: prectiCastku(this.cena()),
  }));

  private readonly konecPodleTiketu = computed(() => konecPodlePapiru(this.papir(), this.stav.tahy()));
  protected readonly odKontroly = computed(() => this.kontrolaOd() ?? this.prvni());
  protected readonly doKontroly = computed(() =>
    this.bezKonce() ? null : (this.kontrolaDo() ?? this.konecPodleTiketu() ?? ''),
  );
  protected readonly cenaZaSlosovaniVychozi = computed(() => cenaZaSlosovaniZPapiru(this.papir()));
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

    const kontrola = this.kontrola();
    return {
      ...(kontrola === null ? {} : { kontrola }),
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
      kodDoplnkoveHry: this.doplnkova().trim() === '' ? null : this.doplnkova().trim(),
      cenaKc: this.papir().cenaKc,
      vlozeno: new Date().toISOString(),
    };
  });

  protected readonly problemy = computed(() => zkontrolujTiket(this.navrh()));

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

  protected readonly popisProblemu = popisProblemu;

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

  protected async uloz(udalost: Event): Promise<void> {
    udalost.preventDefault();
    this.odeslano.set(true);
    if (this.problemy().length > 0 || this.prvni() === '') return;
    const tiket = this.navrh();
    await this.stav.ulozTiket(tiket);
    // Průchozí údaje ze skenu už splnily účel.
    this.naskenovany.zapomen();
    await this.router.navigate(['/tiket', tiket.id]);
  }
}
