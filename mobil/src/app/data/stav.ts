/**
 * Stav aplikace nad úložištěm.
 *
 * Drží tikety, tahy a sazby, umí je uložit a vyhodnotit. Obrazovky se tak nemusí starat
 * o pořadí operací ani o slučování importů a stažení.
 */

import { Injectable, computed, inject, signal } from '@angular/core';
import {
  duplicity,
  prekryvy,
  sloucTahy,
  vyhodnotTiket,
  type CenikHry,
  type Prekryv,
  type SazbyEurosance,
  type SazbyExtra6,
  type Tah,
  type Tiket,
  type VysledekTiketu,
} from '@kontrola-tiketu/jadro';
import { maTrvaleUloziste, SIT, ULOZISTE } from './tokeny.js';
import { nactiVysledky, shrnutiImportu, type VysledekImportu } from './import.js';
import { stahniVysledky, type KontrolaServeru } from './stahovani.js';
import { shrnutiStazeni, zpracujStazene } from './vysledkyZeServeru.js';
import { seskupPodleNazvu, upravNazev } from './nazvyTiketu.js';
import { nactenyFiltrSeznamu, VYCHOZI_FILTR_SEZNAMU, type FiltrSeznamu } from './zobrazeniTiketu.js';
import { Oznameni } from './oznameni.js';

const KLIC_FILTRU_SEZNAMU = 'filtrSeznamu';

/**
 * Tiket by se uložil vedle jiného se stejnými sloupci na totéž slosování. Výhry i vsazené
 * částky by se pak počítaly dvakrát — typicky druhý sken téhož papíru, když jeden z nich
 * nepřečetl čárový kód a tikety tak dostaly různá id.
 */
export class DuplicitniTiket extends Error {
  constructor(readonly duplicity: readonly Prekryv[]) {
    super('Tiket se stejnými sloupci na stejná slosování už je uložený.');
    this.name = 'DuplicitniTiket';
  }
}

export interface Zprava {
  readonly uspech: boolean;
  readonly zprava: string;
}

@Injectable({ providedIn: 'root' })
export class Stav {
  private readonly uloziste = inject(ULOZISTE);
  private readonly sit = inject(SIT);
  readonly oznameni = inject(Oznameni);

  readonly tikety = signal<readonly Tiket[]>([]);
  readonly skupinyNazvu = computed(() => seskupPodleNazvu(this.tikety(), t => t.nazev));
  readonly tahy = signal<readonly Tah[]>([]);
  readonly sazby = signal<readonly SazbyExtra6[]>([]);
  readonly sazbyEurosance = signal<readonly SazbyEurosance[]>([]);
  readonly ceny = signal<readonly CenikHry[]>([]);
  readonly nacteno = signal(false);

  /** Filtr seznamu tiketů, jak ho uživatel naposledy nastavil. */
  readonly filtrSeznamu = signal<FiltrSeznamu>(VYCHOZI_FILTR_SEZNAMU);

  /** Proč se úložiště nepodařilo otevřít. `null`, když je všechno v pořádku. */
  readonly chybaUloziste = signal<string | null>(null);

  /** Uloží se data doopravdy, nebo jen do paměti do zavření aplikace? */
  readonly trvaleUloziste = maTrvaleUloziste();

  /** Do kdy má aplikace výsledky. Uživatel tak ví, jestli má smysl něco doimportovat. */
  readonly vysledkyDo = computed(() => this.tahy().at(-1)?.datum ?? null);

  /**
   * Vyhodnocení všech tiketů podle id. Seznam, detail i přehled ho sdílejí, takže se tiket
   * kontrolovaný přes stovky slosování nepřepočítává pro každou obrazovku znovu.
   */
  readonly vysledky = computed<ReadonlyMap<string, VysledekTiketu>>(
    () => new Map(this.tikety().map((tiket) => [tiket.id, this.vyhodnot(tiket)])),
  );

  /**
   * Duplicitní tikety — stejné sloupce na stejná slosování, započítaly by se dvakrát. Nové se
   * uložit nedají, ukazují se ty z dřívějška.
   */
  readonly prekryvy = computed<ReadonlyMap<string, readonly Prekryv[]>>(() =>
    prekryvy(this.tikety(), this.tahy()),
  );

  /** Právě se stahují výsledky ze serveru. */
  readonly stahuje = signal(false);

  /** Co server hlásil o poslední kontrole losování. `null`, dokud se stažení nepovedlo. */
  readonly kontrolaServeru = signal<KontrolaServeru | null>(null);

  /** Jak dopadl poslední pokus o stažení — pro obrazovku výsledků. */
  readonly posledniStazeni = signal<Zprava | null>(null);

  private fronta: Promise<unknown> = Promise.resolve();

  async nacti(): Promise<void> {
    try {
      await this.uloziste.pripoj?.();
    } catch (chyba) {
      this.chybaUloziste.set(
        `Nepodařilo se otevřít šifrovanou databázi: ${chyba instanceof Error ? chyba.message : String(chyba)}`,
      );
      this.nacteno.set(true);
      return;
    }

    const [tikety, tahy, sazby, sazbyEurosance, ceny, filtr] = await Promise.all([
      this.uloziste.nactiTikety(),
      this.uloziste.nactiTahy(),
      this.uloziste.nactiSazby(),
      this.uloziste.nactiSazbyEurosance(),
      this.uloziste.nactiCeny(),
      this.uloziste.nactiNastaveni(KLIC_FILTRU_SEZNAMU),
    ]);
    this.filtrSeznamu.set(nactenyFiltrSeznamu(filtr));
    this.tikety.set(tikety);
    this.tahy.set(tahy);
    this.sazby.set(sazby);
    this.sazbyEurosance.set(sazbyEurosance);
    this.ceny.set(ceny);
    await this.oznameni.nacti(this.vysledky());
    this.nacteno.set(true);
  }

  async ulozFiltrSeznamu(zmena: Partial<FiltrSeznamu>): Promise<void> {
    this.filtrSeznamu.update(f => ({ ...f, ...zmena }));
    await this.uloziste.ulozNastaveni(KLIC_FILTRU_SEZNAMU, this.filtrSeznamu());
  }

  /**
   * Uloží tiket. Když by vznikla duplicita, nic neuloží a vyhodí {@link DuplicitniTiket};
   * tikety v `nahradit` se po uložení smažou — tak se úplnější sken prosadí místo staršího.
   * Duplicitu, kterou tiket měl už před úpravou, uložení netrestá: přejmenovat nebo
   * archivovat se musí dát i tiket z doby před touto kontrolou.
   */
  ulozTiket(tiket: Tiket, { nahradit = [] }: { readonly nahradit?: readonly string[] } = {}): Promise<void> {
    return this.vyhradne(async () => {
      const pred = this.vysledky();
      const tikety = this.tikety();
      const puvodni = tikety.find(t => t.id === tiket.id);
      const drivejsi = new Set(puvodni === undefined ? [] : duplicity(puvodni, tikety, this.tahy()).map(d => d.tiketId));
      const nove = duplicity(tiket, tikety, this.tahy()).filter(d => !nahradit.includes(d.tiketId) && !drivejsi.has(d.tiketId));
      if (nove.length > 0) throw new DuplicitniTiket(nove);

      const nahrazeny = tikety.find(t => t.id !== tiket.id && nahradit.includes(t.id));
      const ulozeny: Tiket = {
        ...tiket,
        // Nový sken bez názvu zachová původní; explicitní null nebo prázdný text jej odstraní.
        nazev: upravNazev(tiket.nazev === undefined ? (puvodni?.nazev ?? nahrazeny?.nazev) : tiket.nazev),
        archivovany: tiket.archivovany ?? puvodni?.archivovany ?? false,
      };
      await this.uloziste.ulozTiket(ulozeny);
      const smazane = new Set<string>();
      try {
        for (const id of nahradit) if (id !== tiket.id) { await this.uloziste.smazTiket(id); smazane.add(id); }
      } finally {
        // Tiket už je uložený. Upozornění musí jeho úpravu znát i po chybě, jinak by ji
        // příští stažení ohlásilo jako nové výsledky.
        let chybaNacteni: unknown = null;
        try {
          this.tikety.set(await this.uloziste.nactiTikety());
        } catch (chyba) {
          chybaNacteni = chyba;
          this.tikety.set([...tikety.filter(t => t.id !== tiket.id && !smazane.has(t.id)), ulozeny]);
        }
        await this.oznameni.aktualizuj(pred, this.vysledky(), [tiket.id, ...nahradit]);
        if (chybaNacteni !== null) throw chybaNacteni;
      }
    });
  }

  smazTiket(id: string): Promise<void> {
    return this.vyhradne(async () => {
      const pred = this.vysledky();
      await this.uloziste.smazTiket(id);
      this.tikety.set(await this.uloziste.nactiTikety());
      await this.oznameni.aktualizuj(pred, this.vysledky(), [id]);
    });
  }

  /**
   * Naimportuje soubor s výsledky. Vrací větu pro uživatele — ať už se povedlo, nebo ne.
   */
  async importuj(text: string): Promise<{ uspech: boolean; zprava: string }> {
    const vysledek: VysledekImportu = nactiVysledky(text);
    if (vysledek.stav === 'chyba') {
      return { uspech: false, zprava: vysledek.duvod };
    }

    await this.vyhradne(async () => {
      const pred = this.vysledky();
      // Do úložiště jen nové tahy — úložiště je doplní, nemusí přepisovat celý seznam.
      await this.uloziste.ulozTahy(vysledek.tahy);
      this.tahy.set(sloucTahy(this.tahy(), vysledek.tahy));

      await this.ulozSazby(vysledek);
      await this.oznameni.aktualizuj(pred, this.vysledky());
    });

    return { uspech: true, zprava: shrnutiImportu(vysledek) };
  }

  /**
   * Stáhne ze serveru všechny balíky výsledků, které se od minula změnily.
   *
   * Spouští se po otevření aplikace a tlačítkem na obrazovce výsledků. Selhání je běžný
   * stav — telefon bývá offline — a nesmí rozbít nic, co už aplikace má.
   */
  async stahniVysledky(): Promise<Zprava> {
    if (this.chybaUloziste() !== null) {
      return this.zapis({ uspech: false, zprava: 'Bez databáze se výsledky nemají kam uložit.' });
    }
    if (this.stahuje()) return { uspech: false, zprava: 'Stahování už běží.' };

    this.stahuje.set(true);
    try {
      const stazeno = await stahniVysledky(this.sit, await this.uloziste.nactiHashe());
      if (stazeno.stav === 'chyba') return this.zapis({ uspech: false, zprava: stazeno.duvod });

      // Síť proběhla mimo frontu; uložení tiketu tak na stahování nečeká.
      return await this.vyhradne(async () => {
        const zpracovano = zpracujStazene(this.tahy(), stazeno.nove);
        if (zpracovano.stav === 'chyba') return this.zapis({ uspech: false, zprava: zpracovano.duvod });

        const pred = this.vysledky();
        for (const balik of zpracovano.baliky) {
          await this.uloziste.ulozTahy(balik.tahy);
          await this.ulozSazby(balik);
          // Hash až po datech: kdyby aplikace mezitím spadla, balík se příště stáhne znovu.
          await this.uloziste.ulozHash(balik.soubor, balik.hash);
          this.tahy.set(sloucTahy(this.tahy(), balik.tahy));
        }

        await this.oznameni.aktualizuj(pred, this.vysledky());
        this.kontrolaServeru.set(stazeno.manifest.kontrola);
        return this.zapis({ uspech: true, zprava: shrnutiStazeni(zpracovano.pribylo, zpracovano.zmeneno) });
      });
    } catch (chyba) {
      return this.zapis({
        uspech: false,
        zprava: `Výsledky se nepodařilo uložit: ${chyba instanceof Error ? chyba.message : String(chyba)}`,
      });
    } finally {
      this.stahuje.set(false);
    }
  }

  /** Uloží sazby doplňkových her a ceník z balíku. Balík bez nich dosavadní nepřepíše. */
  private async ulozSazby(balik: {
    readonly sazbyExtra6: readonly SazbyExtra6[];
    readonly sazbyEurosance: readonly SazbyEurosance[];
    readonly ceny: readonly CenikHry[];
  }): Promise<void> {
    if (balik.sazbyExtra6.length > 0) {
      await this.uloziste.ulozSazby(balik.sazbyExtra6);
      this.sazby.set(balik.sazbyExtra6);
    }
    if (balik.sazbyEurosance.length > 0) {
      await this.uloziste.ulozSazbyEurosance(balik.sazbyEurosance);
      this.sazbyEurosance.set(balik.sazbyEurosance);
    }
    if (balik.ceny.length > 0) {
      await this.uloziste.ulozCeny(balik.ceny);
      this.ceny.set(balik.ceny);
    }
  }

  /**
   * Změny tiketů a výsledků jedna po druhé. Jinak by uložení tiketu uprostřed stahování
   * srovnalo upozornění proti tahům, které stahování ještě neohlásilo, a výhru umlčelo.
   */
  private vyhradne<T>(akce: () => Promise<T>): Promise<T> {
    const beh = this.fronta.then(akce);
    this.fronta = beh.catch(() => {});
    return beh;
  }

  private zapis(zprava: Zprava): Zprava {
    this.posledniStazeni.set(zprava);
    return zprava;
  }

  vyhodnot(tiket: Tiket): VysledekTiketu {
    return vyhodnotTiket(tiket, this.tahy(), this.sazby(), this.sazbyEurosance(), this.ceny());
  }
}
