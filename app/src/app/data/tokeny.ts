import { InjectionToken } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { UlozisteSqlite } from './uloziste-sqlite.js';
import { UlozisteVPameti, type Uloziste } from './uloziste.js';

/**
 * Na zařízení šifrovaná databáze, v prohlížeči paměť.
 *
 * V prohlížeči se schválně nepoužívá žádné trvalé úložiště. IndexedDB ani localStorage
 * nejsou šifrované a tikety do nich nepatří — vývoj v prohlížeči si vystačí s pamětí.
 */
export const ULOZISTE = new InjectionToken<Uloziste>('uloziste', {
  providedIn: 'root',
  factory: () => (Capacitor.isNativePlatform() ? new UlozisteSqlite() : new UlozisteVPameti()),
});

/** Běží aplikace na zařízení, kde se data opravdu uloží? */
export function maTrvaleUloziste(): boolean {
  return Capacitor.isNativePlatform();
}
