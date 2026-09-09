/**
 * Rozhraní úložiště.
 *
 * Aplikace pracuje jen s tímhle rozhraním, takže se dá vyměnit implementace, aniž by se
 * sáhlo na obrazovky. Ostrá implementace musí být podle zadání šifrovaná (SQLCipher, klíč
 * v Android Keystore) — viz UlozisteVPameti níž, kde je stav popsaný.
 */

import type { SazbyExtra6, Tah, Tiket } from '@kontrola-tiketu/jadro';

export interface Uloziste {
  /**
   * Otevře úložiště. Volá se jednou před vším ostatním.
   *
   * Když selže, aplikace se nesmí tvářit, že funguje — nešifrované náhradní úložiště by
   * bylo horší než hlášená chyba.
   */
  pripoj?(): Promise<void>;

  nactiTikety(): Promise<Tiket[]>;
  ulozTiket(tiket: Tiket): Promise<void>;
  smazTiket(id: string): Promise<void>;

  nactiTahy(): Promise<Tah[]>;
  ulozTahy(tahy: readonly Tah[]): Promise<void>;

  nactiSazby(): Promise<SazbyExtra6[]>;
  ulozSazby(sazby: readonly SazbyExtra6[]): Promise<void>;
}

/**
 * Úložiště v paměti.
 *
 * Slouží pro vývoj v prohlížeči a pro testy. **Nic nepřežije zavření aplikace** a záměrně
 * to nic nikam nezapisuje: dokud není hotové šifrované úložiště, je lepší o data přijít
 * než je nechat nešifrovaná na disku.
 */
export class UlozisteVPameti implements Uloziste {
  private tikety = new Map<string, Tiket>();
  private tahy: Tah[] = [];
  private sazby: SazbyExtra6[] = [];

  async nactiTikety(): Promise<Tiket[]> {
    return [...this.tikety.values()].sort((a, b) => b.vlozeno.localeCompare(a.vlozeno));
  }

  async ulozTiket(tiket: Tiket): Promise<void> {
    // Klíčem je lokální id ze sériového čísla, takže druhý sken téhož tiketu ho jen přepíše.
    this.tikety.set(tiket.id, tiket);
  }

  async smazTiket(id: string): Promise<void> {
    this.tikety.delete(id);
  }

  async nactiTahy(): Promise<Tah[]> {
    return [...this.tahy];
  }

  async ulozTahy(tahy: readonly Tah[]): Promise<void> {
    this.tahy = [...tahy];
  }

  async nactiSazby(): Promise<SazbyExtra6[]> {
    return [...this.sazby];
  }

  async ulozSazby(sazby: readonly SazbyExtra6[]): Promise<void> {
    this.sazby = [...sazby];
  }
}
