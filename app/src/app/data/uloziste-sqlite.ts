/**
 * Šifrované úložiště na zařízení.
 *
 * SQLCipher přes @capacitor-community/sqlite. Passphrase drží plugin v
 * EncryptedSharedPreferences pod klíčem z Android Keystore (MasterKey, AES256_GCM) —
 * ověřeno v implementaci pluginu, ne převzato z dokumentace.
 *
 * Passphrase se generuje při prvním spuštění z kryptografického generátoru a nikde se
 * nezobrazuje ani nezapisuje jinam. Není odvozená od ničeho, co by šlo uhodnout.
 *
 * Objekty se ukládají jako JSON. Model žije v jádře a nemá smysl ho rozepisovat do sloupců,
 * které by se musely udržovat dvakrát; databáze je navíc celá šifrovaná, takže dotazovat se
 * napříč obsahem tiketů stejně není k čemu.
 */

import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from '@capacitor-community/sqlite';
import type { SazbyExtra6, Tah, Tiket } from '@kontrola-tiketu/jadro';
import type { Uloziste } from './uloziste.js';

const NAZEV_DB = 'kontrola-tiketu';
const VERZE_SCHEMATU = 1;

/** Délka passphrase v bajtech. 32 bajtů je 256 bitů entropie. */
const DELKA_KLICE = 32;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS tikety (
  id TEXT PRIMARY KEY NOT NULL,
  vlozeno TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tahy (
  klic TEXT PRIMARY KEY NOT NULL,
  datum TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sazby (
  platnostOd TEXT PRIMARY KEY NOT NULL,
  data TEXT NOT NULL
);
`;

function vygenerujPassphrase(): string {
  const bajty = new Uint8Array(DELKA_KLICE);
  crypto.getRandomValues(bajty);
  return [...bajty].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export class UlozisteSqlite implements Uloziste {
  private readonly spojeni = new SQLiteConnection(CapacitorSQLite);
  private db: SQLiteDBConnection | null = null;

  /**
   * Otevře databázi a při prvním spuštění vyrobí passphrase.
   *
   * Musí proběhnout dřív než cokoliv jiného. Když selže, aplikace se nesmí tvářit, že
   * funguje — nešifrované náhradní úložiště by bylo horší než chyba.
   */
  async pripoj(): Promise<void> {
    if (this.db !== null) return;

    const ulozeno = await this.spojeni.isSecretStored();
    if (ulozeno.result !== true) {
      await this.spojeni.setEncryptionSecret(vygenerujPassphrase());
    }

    this.db = await this.spojeni.createConnection(
      NAZEV_DB,
      true, // šifrovaná
      'secret', // passphrase z bezpečného úložiště, ne z kódu
      VERZE_SCHEMATU,
      false,
    );
    await this.db.open();
    await this.db.execute(SCHEMA);
  }

  private get spojeniDb(): SQLiteDBConnection {
    if (this.db === null) {
      throw new Error('Databáze není otevřená. Nejdřív zavolej pripoj().');
    }
    return this.db;
  }

  private async precti<T>(dotaz: string): Promise<T[]> {
    const odpoved = await this.spojeniDb.query(dotaz);
    return (odpoved.values ?? []).map((radek) => JSON.parse((radek as { data: string }).data) as T);
  }

  async nactiTikety(): Promise<Tiket[]> {
    return this.precti<Tiket>('SELECT data FROM tikety ORDER BY vlozeno DESC');
  }

  async ulozTiket(tiket: Tiket): Promise<void> {
    // Klíčem je lokální id ze sériového čísla, takže druhý sken téhož tiketu ho jen přepíše.
    await this.spojeniDb.run(
      'INSERT INTO tikety (id, vlozeno, data) VALUES (?, ?, ?) ' +
        'ON CONFLICT(id) DO UPDATE SET vlozeno = excluded.vlozeno, data = excluded.data',
      [tiket.id, tiket.vlozeno, JSON.stringify(tiket)],
    );
  }

  async smazTiket(id: string): Promise<void> {
    await this.spojeniDb.run('DELETE FROM tikety WHERE id = ?', [id]);
  }

  async nactiTahy(): Promise<Tah[]> {
    return this.precti<Tah>('SELECT data FROM tahy ORDER BY datum ASC, klic ASC');
  }

  async ulozTahy(tahy: readonly Tah[]): Promise<void> {
    const prikazy = tahy.map((tah) => ({
      statement:
        'INSERT INTO tahy (klic, datum, data) VALUES (?, ?, ?) ' +
        'ON CONFLICT(klic) DO UPDATE SET data = excluded.data',
      values: [`${tah.hra}|${tah.datum}`, tah.datum, JSON.stringify(tah)],
    }));
    if (prikazy.length > 0) await this.spojeniDb.executeSet(prikazy);
  }

  async nactiSazby(): Promise<SazbyExtra6[]> {
    return this.precti<SazbyExtra6>('SELECT data FROM sazby ORDER BY platnostOd ASC');
  }

  async ulozSazby(sazby: readonly SazbyExtra6[]): Promise<void> {
    const prikazy = sazby.map((s) => ({
      statement:
        'INSERT INTO sazby (platnostOd, data) VALUES (?, ?) ' +
        'ON CONFLICT(platnostOd) DO UPDATE SET data = excluded.data',
      values: [s.platnostOd, JSON.stringify(s)],
    }));
    if (prikazy.length > 0) await this.spojeniDb.executeSet(prikazy);
  }
}
