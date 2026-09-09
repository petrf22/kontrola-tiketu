import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  BarcodeFormat,
  BarcodeScanner,
  type Barcode,
} from '@capacitor-mlkit/barcode-scanning';
import { ChybaCarovehoKodu, prectiCarovyKod } from '@kontrola-tiketu/ocr';
import { NaskenovanyTiket } from '../data/sken.js';
import { maTrvaleUloziste } from '../data/tokeny.js';

/**
 * Sken čárového kódu tiketu.
 *
 * Používá se proudový režim (`startScan`), ne pohodlnější `scan()`. Ten totiž jede přes
 * modul Google Play, který se stahuje ze sítě — a aplikace síť nemá a mít nemá.
 * Snímky se tak zpracovávají za běhu a nikam se neukládají.
 *
 * Kód slouží k jedinému účelu: získat sériové číslo jako lokální identifikátor tiketu.
 * Vsazená čísla v něm čitelná nejsou a číslo klubové karty se zahazuje.
 */
@Component({
  selector: 'app-sken',
  imports: [RouterLink],
  template: `
    @if (!naZarizeni) {
      <p class="poznamka">
        Sken funguje jen v aplikaci na telefonu. V prohlížeči zadej tiket ručně.
      </p>
    } @else {
      <p class="poznamka">
        Obvykle tuhle obrazovku nepotřebuješ — <a routerLink="/sken-cisel">vyfocení tiketu</a>
        přečte čísla i čárový kód najednou. Hodí se, když fotka kód nezachytila, nebo když
        nechceš pořizovat snímek vůbec: tady se nic neukládá ani dočasně.
      </p>
      @if (!skenuje()) {
        <button type="button" (click)="spust()">Spustit sken</button>
      } @else {
        <button type="button" (click)="zastav()">Zrušit</button>
      }
    }

    @if (chyba(); as text) {
      <p class="chyba">{{ text }}</p>
    }
  `,
  styles: `
    .poznamka { color: var(--barva-text-tlumeny); font-size: 0.9rem; }
    .chyba { color: var(--barva-chyba); }
    button {
      padding: 0.5rem 0.9rem; border: 1px solid var(--barva-ram); border-radius: 4px;
      background: var(--barva-plocha); color: inherit; font: inherit; cursor: pointer;
    }
  `,
  host: { '[class.skenuje]': 'skenuje()' },
})
export class Sken {
  private readonly router = inject(Router);
  private readonly naskenovany = inject(NaskenovanyTiket);

  protected readonly naZarizeni = maTrvaleUloziste();
  protected readonly skenuje = signal(false);
  protected readonly chyba = signal<string | null>(null);

  protected async spust(): Promise<void> {
    this.chyba.set(null);
    try {
      const opravneni = await BarcodeScanner.requestPermissions();
      if (opravneni.camera !== 'granted' && opravneni.camera !== 'limited') {
        this.chyba.set('Bez přístupu ke kameře sken nepůjde. Tiket můžeš zadat ručně.');
        return;
      }

      this.skenuje.set(true);
      document.body.classList.add('skenuje');

      const posluchac = await BarcodeScanner.addListener('barcodesScanned', (udalost) => {
        const kod = udalost.barcodes[0];
        if (kod !== undefined) void this.zpracuj(kod, posluchac.remove.bind(posluchac));
      });

      await BarcodeScanner.startScan({ formats: [BarcodeFormat.Pdf417] });
    } catch (potiz) {
      this.skenuje.set(false);
      document.body.classList.remove('skenuje');
      this.chyba.set(potiz instanceof Error ? potiz.message : String(potiz));
    }
  }

  protected async zastav(): Promise<void> {
    await BarcodeScanner.stopScan();
    await BarcodeScanner.removeAllListeners();
    this.skenuje.set(false);
    document.body.classList.remove('skenuje');
  }

  private async zpracuj(kod: Barcode, odeberPosluchac: () => Promise<void>): Promise<void> {
    // Čtečka vrací rawValue jako undefined, protože payload tiketu není platný text.
    // Bajty ale dodá, a ty jsou přesně to, co je potřeba — struktura pak sedí na offsety
    // ze zadání. Přicházejí jako znaménkové Java bajty, proto maskování na 0–255.
    const bajty = kod.bytes;
    if (bajty === undefined || bajty.length === 0) {
      this.chyba.set('Kód se přečetl, ale bez dat. Zkus lepší záběr.');
      return;
    }

    let serioveCislo: string | null = null;
    try {
      serioveCislo = prectiCarovyKod(Uint8Array.from(bajty, (b) => b & 0xff)).serioveCislo;
    } catch (potiz) {
      this.chyba.set(
        potiz instanceof ChybaCarovehoKodu
          ? `Kód se přečetl, ale nevypadá jako tiket Allwyn: ${potiz.message}`
          : String(potiz),
      );
      return;
    }

    await odeberPosluchac();
    await this.zastav();
    this.naskenovany.uloz(serioveCislo);
    await this.router.navigate(['/tiket/novy']);
  }
}
