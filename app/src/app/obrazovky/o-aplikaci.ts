import { Component } from '@angular/core';
import { formatujDatum } from '../data/format.js';
import { HISTORIE, VERZE } from '../data/verze.generated.js';

/**
 * Verze a historie změn. Obojí je zabudované v bundlu (`verze.generated.ts` generuje
 * `npm run verze` z kořenového CHANGELOG.md), takže se kvůli téhle obrazovce nikam nechodí
 * a nic se nečte ze souborů. Na síť smí jen stažení výsledků (`data/stahovani.ts`).
 */
@Component({
  selector: 'app-o-aplikaci',
  template: `
    <p class="verze">Verze {{ verze }}</p>

    <p>
      Kontrola papírových tiketů Eurojackpotu a Sportky na vlastním zařízení. Na síť aplikace
      chodí jen pro veřejné výsledky losování — stáhne je celé, pro každého stejně, a tikety
      vyhodnotí až v telefonu. Nikam tedy neodesílá, které tikety držíš ani jestli jsi vyhrál.
    </p>

    <p class="upozorneni">
      Vyhodnocení je neoficiální a nezávazné. Aplikace nenahrazuje kontrolu tiketu — závazná
      je vždy kontrola na terminálu Allwyn. Výhru lze uplatnit pouze tam, s platným papírovým
      tiketem a ve stanovené lhůtě.
    </p>

    <h2>Soukromí</h2>
    <ul class="soukromi">
      <li>žádná analytika, hlášení pádů ani telemetrie</li>
      <li>tikety jsou v šifrované databázi, klíč drží Android Keystore</li>
      <li>nic se nedostane do cloudové zálohy</li>
      <li>obrazovky jsou chráněné proti náhledům v přepínači aplikací</li>
      <li>snímek pořízený kvůli přečtení čísel se hned maže a do galerie se nedostane</li>
      <li>číslo klubové karty z čárového kódu se zahazuje</li>
      <li>žádá jen o fotoaparát a o přístup k internetu kvůli výsledkům</li>
      <li>spojit se umí jedině se serverem výsledků — k jiným adresám systém spojení nepustí</li>
      <li>výsledky stahuje celé a pro všechny stejně, bez vsazených čísel i sériových čísel tiketů</li>
    </ul>

    <h2>Co je nového</h2>
    @for (vydani of historie; track vydani.verze) {
      <section class="vydani">
        <h3>{{ vydani.verze }} <span class="datum">{{ formatujDatum(vydani.datum) }}</span></h3>
        @for (sekce of vydani.sekce; track sekce.nazev) {
          <h4>{{ sekce.nazev }}</h4>
          <ul>
            @for (polozka of sekce.polozky; track polozka) {
              <li>{{ polozka }}</li>
            }
          </ul>
        }
      </section>
    }
  `,
  styles: `
    .verze { margin: 0 0 1rem; font-weight: 600; }
    .upozorneni {
      padding: 0.6rem 0.75rem;
      border-left: 3px solid var(--barva-duraz);
      background: var(--barva-plocha);
      font-size: 0.85rem;
      line-height: 1.4;
    }
    h2 { margin: 1.75rem 0 0.5rem; font-size: 1.05rem; }
    ul { margin: 0.25rem 0; padding-left: 1.2rem; }
    li { margin: 0.2rem 0; line-height: 1.4; }
    .soukromi { font-size: 0.9rem; }
    .vydani { margin-bottom: 1.25rem; }
    .vydani h3 { margin: 0.75rem 0 0.25rem; font-size: 0.95rem; }
    .vydani h4 {
      margin: 0.5rem 0 0.1rem;
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--barva-text-tlumeny);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .datum { font-weight: 400; color: var(--barva-text-tlumeny); }
  `,
})
export class OAplikaci {
  protected readonly verze = VERZE;
  protected readonly historie = HISTORIE;
  protected readonly formatujDatum = formatujDatum;
}
