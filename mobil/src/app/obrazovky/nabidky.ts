import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-pridat-tiket', imports: [RouterLink],
  template: `
    <a class="zpet" routerLink="/">← Tikety</a>
    <h2>Přidat tiket</h2>
    <p class="tlumene">Vyber, jak chceš zadat údaje z tiketu.</p>
    <div class="nabidka">
      <a class="hlavni" routerLink="/sken-cisel">Vyfotit tiket <small>Čísla i kód z jedné fotky, potom kontrola údajů.</small></a>
      <a routerLink="/tiket/novy">Zadat ručně <small>Plnohodnotné zadání papírového i virtuálního tiketu.</small></a>
      <a routerLink="/sken">Naskenovat samotný kód <small>Načte označení tiketu. Vsazená čísla pak doplníš.</small></a>
    </div>
  `,
})
export class PridatTiket {}

@Component({
  selector: 'app-dalsi', imports: [RouterLink],
  template: `
    <h2>Další</h2>
    <div class="nabidka">
      <a routerLink="/import">Výsledky losování <small>Aktualizace výsledků a import ze souboru.</small></a>
      <a routerLink="/o-aplikaci">O aplikaci <small>Soukromí, verze a informace o aplikaci.</small></a>
    </div>
  `,
})
export class Dalsi {}
