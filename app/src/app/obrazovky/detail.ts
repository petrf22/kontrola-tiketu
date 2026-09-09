import { Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { Sloupec, VysledekSlosovani, VysledekTiketu, Vyhra } from '@kontrola-tiketu/jadro';
import { formatujDatum, formatujDatumCas, nazevDne } from '../data/format.js';
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
        {{ t.sloupce.length }} sloupců, {{ t.slosovani.pocet }} slosování od
        {{ formatujDatum(t.slosovani.prvni) }}.
        @if (t.kodDoplnkoveHry) {
          <br />{{ t.hra === 'eurojackpot' ? 'Extra 6' : 'Šance' }}: {{ t.kodDoplnkoveHry }}
        }
        @if (serioveCislo(); as cislo) {
          <br />Sériové číslo z čárového kódu: <span class="serie">{{ cislo }}</span>
        }
        <br />Přidáno {{ formatujDatumCas(t.vlozeno) }}.
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
                  @if (radek.eurocisla.length > 0) {
                    <span class="cisla euro">
                      @for (c of radek.eurocisla; track $index) {
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
        }

        @if (!v.soucetJisty) {
          <p class="poznamka">* Součet není úplný — viz poznámky výše.</p>
        }
      }

      <p class="overeni">
        Čísla si můžeš ověřit na
        <a [href]="odkazNaVysledky()" target="_blank" rel="noopener noreferrer">stránkách Allwyn</a>.
        Odkaz otevře prohlížeč — aplikace sama na síť nechodí a nemá k tomu ani oprávnění.
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
    .soucet { font-size: 1.6rem; margin: 0.5rem 0; font-variant-numeric: tabular-nums; }
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

  protected readonly odkazNaVysledky = computed(() =>
    this.tiket()?.hra === 'sportka'
      ? 'https://www.allwyn.cz/loterie/sportka/kontrola-a-vysledky'
      : 'https://www.allwyn.cz/loterie/eurojackpot/kontrola-a-vysledky',
  );

  protected denSlosovani(slosovani: VysledekSlosovani): string {
    const tah = this.stav.tahy().find((t) => t.datum === slosovani.datum);
    return tah === undefined ? '' : ` (${nazevDne(tah.den)})`;
  }

  protected readonly vysledek = computed<VysledekTiketu | null>(() => {
    const tiket = this.tiket();
    return tiket === undefined ? null : this.stav.vyhodnot(tiket);
  });

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
        s.hra === 'eurojackpot'
          ? s.vysledek.shoda.hlavniCisla
          : s.vysledky.flatMap((v) => v.shoda.cisla),
      );
      const trefeneEuro = new Set<number>(
        s.hra === 'eurojackpot' ? s.vysledek.shoda.euroCisla : [],
      );

      const oznac = (cisla: readonly number[], kde: ReadonlySet<number>) =>
        cisla.map((hodnota) => ({ hodnota, shoda: kde.has(hodnota) }));

      const poradi =
        s.hra === 'eurojackpot'
          ? s.vysledek.poradi
          : s.vysledky.map((v) => v.poradi).filter((p) => p !== null)[0] ?? null;

      return {
        index: s.index,
        cisla: oznac(sloupec?.cisla ?? [], trefene),
        eurocisla: oznac(
          sloupec !== undefined && sloupec.hra === 'eurojackpot' ? sloupec.eurocisla : [],
          trefeneEuro,
        ),
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
      tah === undefined ? null : tah.hra === 'eurojackpot' ? tah.extra6 : (tah.sance?.cislice ?? null);

    return {
      nazev: tiket.hra === 'eurojackpot' ? 'Extra 6' : 'Šance',
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
