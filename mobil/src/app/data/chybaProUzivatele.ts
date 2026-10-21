/**
 * Text chyby, který smí do rozhraní.
 *
 * Nativní pluginy (kamera, ML Kit, SQLCipher) odmítají s anglickou hláškou. Most Capacitoru
 * z nich vždy dělá `CapacitorException`, kdežto naše vlastní chyby jsou obyčejné `Error`
 * s českou zprávou. Podle třídy se tedy dají odlišit bez slovníku anglických vět, který by
 * s každou aktualizací pluginu zastaral.
 */

import { CapacitorException } from '@capacitor/core';

/** Zpráva z naší chyby, nebo náhradní česká věta, když chyba přišla z nativního pluginu. */
export function chybaProUzivatele(potiz: unknown, nahradni: string): string {
  return potiz instanceof Error && !(potiz instanceof CapacitorException) ? potiz.message : nahradni;
}
